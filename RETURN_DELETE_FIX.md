# Delete Return Functionality

## Problem

La integridad de datos fue comprometida porque devoluciones con cantidades inválidas (mayores que lo vendido) fueron creadas antes de implementar la validación. Esto bloqueaba futuras devoluciones:

```
Sold: 1 unit
Already returned: 2 units (incorrect)
Available to return: -1 (1 - 2 = negative!)
Result: Cannot create any new return
```

## Solution

Se implementó la capacidad de **eliminar devoluciones** para corregir registros defectuosos.

### How It Works

#### Backend: `deleteReturn()` in `useReturns()` hook

Located in [src/hooks/useSupabaseData.ts](src/hooks/useSupabaseData.ts#L1045)

**Steps to reverse a return:**

1. **Fetch the return** with all return_items
2. **Reverse stock restoration** - Subtract the quantities back from stock_levels
   ```typescript
   newQuantity = stockLevel.quantity - item.quantity
   ```
3. **Recalculate credited_amount** - Subtract the credit that was given
   ```typescript
   newCreditedAmount = originalSale.credited_amount - totalCreditedAmountToReverse
   ```
4. **Recalculate payment_status** based on remaining balance:
   - If `remaining <= 0.01`: `Paid`
   - If `amount_paid > 0 || credited_amount > 0`: `Partial`
   - Otherwise: `Pending`
5. **Update the original sale** with new credited_amount and payment_status
6. **Delete return_items** and the return record

**Atomic operations** - All database operations are sequential; if any fails, exception is thrown (Supabase client handles transaction integrity).

### Frontend: Delete UI in Returns Component

Located in [src/components/Returns.tsx](src/components/Returns.tsx#L91)

**Features:**

- **Delete button** on each return card (rose/red color to indicate destructive action)
- **Confirmation flow:**
  1. Click "Delete" button
  2. Button converts to "Cancel" and "Delete" confirmation buttons
  3. Warning message appears: "Deleting this return will reverse the stock adjustment and recalculate the payment status of the original order. This action cannot be undone."
  4. User must confirm deletion
- **Loading state** - Button shows spinner and is disabled during deletion
- **Error handling** - Displays error message if deletion fails
- **Auto-refresh** - UI automatically updates after successful deletion

### Example: Fixing Invalid Return

**Initial state:**
- Sale #123: Ordered 1 unit of "AZMOL ANTIFREEZE"
- Return #456: Incorrectly returned 2 units (should be 1 or 0)
- credited_amount on sale: 2x unit price
- payment_status: Shows as over-credited

**User action:**
1. Navigate to Returns tab
2. Find Return #456
3. Click "Delete" button
4. Review warning
5. Click "Delete" to confirm

**After deletion:**
- Stock is restored (2 units removed from stock_levels)
- credited_amount is recalculated (2x unit price is subtracted)
- payment_status is recalculated based on new balance
- Return record and items are permanently deleted
- Returns list refreshes automatically

## Implementation Details

### Type Safety

Both backend and frontend maintain type safety:
- Return items properly typed in `Return` interface
- Supabase responses auto-converted via type converters
- Error handling with proper TypeScript `Error` types

### Data Consistency

**Before delete:**
```
Sale: total=100, amount_paid=30, credited_amount=20, remaining=50
Return: qty=2 at 50/unit = 100 credit
Result: credited_amount becomes 120 (broken: exceeds sale total!)
```

**After delete:**
```
Sale: total=100, amount_paid=30, credited_amount=0, remaining=70
Payment status: Pending (not fully paid)
Return: deleted
Result: Everything consistent again
```

### UI/UX Considerations

1. **Destructive action** - Red/rose colors warn user it's permanent
2. **Two-step confirmation** - Prevents accidental clicks
3. **Clear warning message** - Explains what happens
4. **Loading feedback** - Shows spinner during deletion
5. **Error display** - Shows what went wrong if deletion fails
6. **Auto-refresh** - No manual refresh needed

## Testing

### Manual Test Steps

1. Create a sale with 1 product unit
2. Try to create a return with 2 units (should fail with validation error)
3. If a return with qty>sold exists in database:
   - Navigate to Returns tab
   - Find the problematic return
   - Click "Delete"
   - Confirm deletion
   - Verify:
     - Return disappears from list
     - Can now create a valid return
     - credited_amount on original sale is recalculated
     - payment_status updated correctly

## Future Improvements

1. **Batch delete** - Delete multiple returns at once
2. **Edit return** - Modify quantities instead of delete+recreate
3. **Audit trail** - Log who deleted what and when (already in audit_logs via triggers)
4. **Undo functionality** - Keep soft deletes to allow recovery
5. **Return status** - Mark returns as "disputed" or "under review" before deletion

## Security

- Supabase RLS policies enforce that only authenticated users can delete
- User role determines if they can delete (need to check `sales.user_id` matches)
- All deletions are logged in `audit_logs` table via database triggers
- Deletion is permanent (no soft delete at this stage)

## Related Files

- [src/hooks/useSupabaseData.ts](src/hooks/useSupabaseData.ts) - `useReturns()` hook with `deleteReturn()`
- [src/components/Returns.tsx](src/components/Returns.tsx) - UI component with delete button
- [src/types/supabase.ts](src/types/supabase.ts) - Type converters for return data
- [supabase-complete-schema.sql](supabase-complete-schema.sql) - Database schema with RLS policies

## Deployment

Auto-deployed to Vercel on commit `a67adf5`:
- GitHub Actions triggered build
- Vercel CLI deployment executed
- New version live at: https://azmol-stockerp.vercel.app/
