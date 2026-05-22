-- Server-side recalibration RPC: reads all transfers, computes stock, writes directly.
-- SECURITY DEFINER bypasses RLS entirely.
CREATE OR REPLACE FUNCTION recalibrate_stock_from_transfers()
RETURNS TEXT AS $$
DECLARE
  updated_count INT;
BEGIN
  WITH transfer_deltas AS (
    -- IMPORT: add to destination warehouse
    -- ADJUSTMENT ADJ+: add to warehouse
    -- ADJUSTMENT ADJ-: subtract from warehouse
    -- INTERNAL: add to destination
    SELECT
      ti.product_id,
      t.to_warehouse_id AS warehouse_id,
      CASE
        WHEN t.type = 'IMPORT' THEN ti.quantity
        WHEN t.type = 'ADJUSTMENT' AND t.reference = 'ADJ-' THEN -ti.quantity
        WHEN t.type = 'ADJUSTMENT' THEN ti.quantity
        WHEN t.type = 'INTERNAL' THEN ti.quantity
      END AS delta
    FROM transfers t
    JOIN transfer_items ti ON ti.transfer_id = t.id
    WHERE (t.type IN ('IMPORT', 'ADJUSTMENT'))
       OR (t.type = 'INTERNAL' AND t.to_warehouse_id IS NOT NULL)

    UNION ALL

    -- INTERNAL: subtract from source warehouse
    SELECT
      ti.product_id,
      t.from_warehouse_id AS warehouse_id,
      -ti.quantity AS delta
    FROM transfers t
    JOIN transfer_items ti ON ti.transfer_id = t.id
    WHERE t.type = 'INTERNAL' AND t.from_warehouse_id IS NOT NULL
  ),
  computed_stock AS (
    SELECT
      product_id,
      warehouse_id,
      GREATEST(0, SUM(delta)) AS target_qty
    FROM transfer_deltas
    WHERE warehouse_id IS NOT NULL AND product_id IS NOT NULL
    GROUP BY product_id, warehouse_id
  )
  INSERT INTO stock_levels (product_id, warehouse_id, quantity)
  SELECT product_id, warehouse_id, target_qty
  FROM computed_stock
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET
    quantity = EXCLUDED.quantity,
    updated_at = TIMEZONE('utc'::text, NOW());

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count::TEXT || ' entradas actualizadas desde historial de transferencias';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
