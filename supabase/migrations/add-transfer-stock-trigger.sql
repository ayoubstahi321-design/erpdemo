-- ============================================================================
-- CLEANUP: Remove transfer stock trigger (stock is now handled app-side)
-- ============================================================================
-- Stock updates for transfers are now done directly in createTransfer()
-- via the existing RPCs: update_stock_level + transfer_stock_between_warehouses
--
-- This file drops any previously created trigger/function to avoid conflicts.
--
-- Date: 2026-02-15
-- ============================================================================

DROP TRIGGER IF EXISTS on_transfer_item_insert ON public.transfer_items;
DROP FUNCTION IF EXISTS public.handle_transfer_item_stock_update();

DO $$
BEGIN
  RAISE NOTICE 'Transfer stock trigger cleaned up (stock is now updated app-side via RPCs)';
END $$;
