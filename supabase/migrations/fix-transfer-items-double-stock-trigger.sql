-- ============================================================================
-- FIX: Drop transfer_items trigger that causes DOUBLE stock updates
-- ============================================================================
--
-- PROBLEM:
-- The trigger_update_stock_on_transfer_item (or any variant) fires on INSERT
-- into transfer_items and updates stock_levels. But the app-side code ALSO
-- calls update_stock_level RPC directly (in updateStock / applyStockUpdate).
-- Result: every adjustment/transfer applies the stock delta TWICE.
--
-- Example: DECREASE by 36 from stock 36
--   Trigger:    36 + (-36) = 0
--   Direct RPC:  0 + (-36) = -36 → clamped to 0
--   User sees: stock = 0 (should stay at 0 only if full stock removed)
--
-- SOLUTION: Drop ALL stock-related triggers on transfer_items.
-- Stock updates for transfers are handled exclusively by app-side RPCs:
--   - createTransfer() → applyStockUpdate()
--   - updateStock() (quick adjust from Inventory) → update_stock_level RPC
--   - deleteTransfer() → applyStockUpdate() with direction=-1
-- ============================================================================

-- Drop all known variants of the transfer_items stock trigger
DROP TRIGGER IF EXISTS trigger_update_stock_on_transfer_item ON public.transfer_items;
DROP TRIGGER IF EXISTS on_transfer_item_insert ON public.transfer_items;
DROP TRIGGER IF EXISTS handle_transfer_items_stock_update ON public.transfer_items;

-- Drop associated functions if they exist
DROP FUNCTION IF EXISTS public.handle_transfer_item_stock_update();
DROP FUNCTION IF EXISTS public.handle_transfer_items_stock_update();

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'FIX APPLIED: transfer_items stock triggers dropped';
  RAISE NOTICE 'Stock updates now handled exclusively by app-side RPCs.';
  RAISE NOTICE '============================================================';
END $$;
