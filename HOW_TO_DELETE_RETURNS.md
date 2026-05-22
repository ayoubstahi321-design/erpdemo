# How to Use: Delete Invalid Returns

## Problem You Had
"Tengo que borrar en dvoluciones un producto para que los cálculos sean correctos. No tengo la opción de modificar en devoluciones o eliminar."

Translation: "I need to delete a product from returns so calculations are correct. I don't have the option to modify or delete in returns."

## Solution: Delete Button Now Available

### Step-by-Step Guide

#### 1. Navigate to Returns Section
- Open the app
- Go to **Devoluciones / Returns** tab in main menu

#### 2. Find the Invalid Return
- Look for the return with incorrect quantity
- Example: Return showing "Already returned: 2" when it should be 1

```
┌─────────────────────────────────────────────────────────┐
│ Retour #abc123                                    [Delete]│
│ 2024-01-15 | Customer: Ahmed | Sale: #sale456           │
│ Motif: Damage                                            │
│                                                          │
│ Items:                                                   │
│  - 2x AZMOL ANTIFREEZE G11 (INCORRECT!)                 │
│    Product ID: PRD-001                                   │
└─────────────────────────────────────────────────────────┘
```

#### 3. Click the "Delete" Button
- Red button on the right side of the return card
- Button shows: 🗑️ Delete

#### 4. Confirm Deletion
- Button changes to show confirmation options

```
┌─────────────────────────────────────────────────────────┐
│ Retour #abc123                                          │
│ WARNING: Deleting this return will reverse the stock    │
│ adjustment and recalculate the payment status of the    │
│ original order. This action cannot be undone.           │
│                                           [Cancel] [Delete]│
└─────────────────────────────────────────────────────────┘
```

- Review the warning message
- Click **[Cancel]** to abort
- Click **[Delete]** to confirm

#### 5. Deletion In Progress
- Button shows spinner: ⟳ Deleting...
- Cannot click other buttons while deleting
- Wait for completion

#### 6. Success
- Return disappears from the list
- Stock is automatically restored
- Payment calculations are recalculated
- Notification appears (optional)

### What Gets Fixed When You Delete

#### Before Deletion
```
Original Sale: AZMOL ANTIFREEZE
  - Quantity sold: 1 unit
  - Unit price: $50
  
Return #456:
  - Quantity returned: 2 units ❌ WRONG!
  - Stock adjustment: +2 units
  - Credit given: $100
  
Payment Status:
  - Total: $50
  - Paid: $0
  - Credited: $100 ❌ OVER-CREDITED!
  - Remaining: -$50 ❌ NEGATIVE!
```

#### After Deletion
```
Original Sale: AZMOL ANTIFREEZE
  - Quantity sold: 1 unit
  - Unit price: $50
  
Return #456: DELETED ✓
  
Payment Status:
  - Total: $50
  - Paid: $0
  - Credited: $0 ✓
  - Remaining: $50 ✓
  - Status: Pending payment ✓
```

## If Something Goes Wrong

### Error Message Appears
If deletion fails, you'll see a red error box:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Error deleting return                                 │
│ Could not connect to database                           │
│                                                    [✕ Close]│
└─────────────────────────────────────────────────────────┘
```

**What to do:**
1. Click [✕ Close] to dismiss
2. Try again in a few moments
3. If error persists, contact support with the error message

### Common Errors

| Error | Reason | Solution |
|-------|--------|----------|
| "Delete function not available" | Hook not loaded | Refresh page and try again |
| "Return not found" | Return was already deleted | Refresh page, the list will update |
| "Could not connect to database" | Network issue | Check internet, try again |
| "Permission denied" | Not authorized to delete | Contact admin (need Manager+ role) |

## What Happens to Your Data

### Records That Change
| Record | What Changes | Why |
|--------|--------------|-----|
| **returns** | Deleted completely | Remove invalid return |
| **return_items** | Deleted completely | Remove invalid items |
| **stock_levels** | Quantity decreases | Reverse the stock restoration |
| **sales** | credited_amount recalculated | Remove incorrect credit |
| **sales** | payment_status recalculated | Update based on new balance |
| **audit_logs** | New entry created | Track who deleted what/when |

### Records That Don't Change
- **Original sale record** - Still exists, just with updated status
- **sale_items** - Unchanged (what was ordered)
- **customers** - Unchanged
- **warehouses** - Unchanged

## Example Scenarios

### Scenario 1: Fix Over-Return
**Situation:** Customer ordered 5 units but return shows 10 units returned
**Solution:** Delete the incorrect return
**Result:** 
- Stock corrected (10 units removed)
- Credit corrected (5 units → customer owes difference)
- Can now create correct return for 5 units

### Scenario 2: Wrong Product Returned
**Situation:** Return shows COOLANT but should be ANTIFREEZE
**Solution:** Delete the incorrect return
**Result:**
- Stock corrected for both products
- Credit corrected
- Create new return with correct product

### Scenario 3: Accidental Duplicate Return
**Situation:** Same order has 2 returns, one is duplicate
**Solution:** Delete the duplicate return
**Result:**
- Only correct return remains
- Credit/stock adjusted correctly
- Payment status accurate

## After Deletion: Next Steps

### If the Return Was Supposed to Be Valid
1. Create a **new return** with correct quantities
   - Go to Sales/Orders tab
   - Find the order
   - Click "Process Return"
   - Enter correct quantities (validation will prevent invalid ones)
   - Submit

### If the Return Should Never Have Happened
1. Nothing more to do!
2. Order reverts to pending payment status
3. Stock is restored
4. Customer still owes the full amount

### If You're Unsure
1. Contact customer to clarify
2. Ask: "Did you actually return these items?"
3. If YES → Create new correct return
4. If NO → Leave as is (deletion is complete)

## Important Notes

⚠️ **Deletion is Permanent**
- Once you click [Delete] and confirm, it cannot be undone
- The return record is completely removed from the system
- Consider this carefully before confirming

✓ **Data is Safe**
- Deletion automatically recalculates everything
- Stock levels are correct after deletion
- Payment calculations are correct after deletion
- No manual adjustment needed

✓ **Everything is Logged**
- Every deletion is recorded in audit logs
- You can see who deleted what and when
- Management can review deletion history

## Support

If you have questions or encounter issues:

1. **Check this guide** - You might find the answer above
2. **Refresh the page** - Sometimes helps with connection issues
3. **Try again later** - If server is busy
4. **Contact admin/manager** - If error persists or you don't have permission
5. **Report bug** - If you see unexpected behavior

---

**Need help?** Your manager can access the audit logs to review what was deleted and verify data integrity.
