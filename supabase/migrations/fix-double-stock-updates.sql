-- ========================================
-- FIX: Remove sale_items and return_items triggers that cause DOUBLE stock updates
-- ========================================
--
-- PROBLEM:
-- 1. sale_items trigger (handle_sale_items_stock_update) deducts stock on INSERT
--    BUT create_sale_atomic RPC also deducts stock via p_stock_updates parameter.
--    Result: every sale deducts stock TWICE.
--    Additionally, the trigger uses NEW.quantity which doesn't account for box mode
--    (selling 5 boxes of 12 should deduct 60, but trigger only deducts 5).
--
-- 2. return_items trigger (handle_return_items_stock_update) restores stock on INSERT
--    BUT createReturn client code also calls update_stock_level RPC.
--    Result: every return restores stock TWICE.
--    Same box-mode issue as sales.
--
-- 3. transfer_items trigger (handle_transfer_items_stock_update) is KEPT because
--    the client-side applyStockUpdate was removed from createTransfer.
--    Only the trigger handles transfer stock updates now.
--
-- SOLUTION: Drop sale_items and return_items triggers.
-- Stock management for sales is handled by create_sale_atomic / update_sale_optimistic RPCs.
-- Stock management for returns is handled by client-side update_stock_level RPC calls.
-- Stock management for transfers is handled by the transfer_items trigger (kept).
-- ========================================

-- Drop the sale_items stock trigger
DROP TRIGGER IF EXISTS trigger_update_stock_on_sale_item ON sale_items;

-- Drop the return_items stock trigger
DROP TRIGGER IF EXISTS trigger_update_stock_on_return_item ON return_items;

-- Verify remaining triggers
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DOUBLE STOCK UPDATE FIX APPLIED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DROPPED: trigger_update_stock_on_sale_item (sales use RPC for stock)';
  RAISE NOTICE 'DROPPED: trigger_update_stock_on_return_item (returns use client RPC calls)';
  RAISE NOTICE 'KEPT: trigger_update_stock_on_transfer_item (transfers use trigger)';
  RAISE NOTICE '========================================';
END $$;
