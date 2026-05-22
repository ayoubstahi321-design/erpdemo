-- ============================================================================
-- FIX: Replace recalibrate_stock_from_transfers with two safe functions
-- ============================================================================
-- Problem: the old function only used transfers (IMPORT, ADJUSTMENT, INTERNAL)
-- and completely ignored sales and returns — running it would inflate stock
-- by resetting all balances as if no sales had ever happened.
--
-- Solution: two new functions with separation of concerns:
--   1. recalibrate_stock_preview()  → read-only, shows what would change
--   2. recalibrate_stock_apply()    → writes changes + audit log (admin only)
--
-- The formula for correct stock is:
--   + IMPORT quantities
--   + ADJUSTMENT ADJ+ quantities
--   - ADJUSTMENT ADJ- quantities
--   + INTERNAL transfers (destination warehouse)
--   - INTERNAL transfers (source warehouse)
--   - Sales (quantity × units_per_box if sell_mode = 'box')
--   + Returns (same sell_mode logic as original sale)
-- ============================================================================

-- Drop the old dangerous function
DROP FUNCTION IF EXISTS recalibrate_stock_from_transfers();

-- ============================================================================
-- 1. PREVIEW — read-only, safe to call anytime
-- ============================================================================
CREATE OR REPLACE FUNCTION recalibrate_stock_preview()
RETURNS TABLE (
  product_id     UUID,
  warehouse_id   UUID,
  producto       TEXT,
  almacen        TEXT,
  stock_actual   NUMERIC,
  stock_correcto NUMERIC,
  diferencia     NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH
  all_deltas AS (
    -- IMPORT: add to destination warehouse
    -- ADJUSTMENT ADJ+: add to warehouse
    -- ADJUSTMENT ADJ-: subtract from warehouse
    -- INTERNAL: add to destination
    SELECT
      ti.product_id,
      t.to_warehouse_id AS warehouse_id,
      CASE
        WHEN t.type = 'IMPORT'                               THEN  ti.quantity
        WHEN t.type = 'ADJUSTMENT' AND t.reference = 'ADJ-'  THEN -ti.quantity
        WHEN t.type = 'ADJUSTMENT'                            THEN  ti.quantity
        WHEN t.type = 'INTERNAL'                              THEN  ti.quantity
      END AS delta
    FROM transfers t
    JOIN transfer_items ti ON ti.transfer_id = t.id
    WHERE t.type IN ('IMPORT', 'ADJUSTMENT')
       OR (t.type = 'INTERNAL' AND t.to_warehouse_id IS NOT NULL)

    UNION ALL

    -- INTERNAL: subtract from source warehouse
    SELECT ti.product_id, t.from_warehouse_id, -ti.quantity
    FROM transfers t
    JOIN transfer_items ti ON ti.transfer_id = t.id
    WHERE t.type = 'INTERNAL' AND t.from_warehouse_id IS NOT NULL

    UNION ALL

    -- SALES: deduct from stock (accounting for sell_mode × units_per_box)
    SELECT
      si.product_id,
      s.warehouse_id,
      CASE
        WHEN si.sell_mode = 'box' THEN -(si.quantity * COALESCE(si.units_per_box, 1))
        ELSE -si.quantity
      END AS delta
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.status != 'Cancelled'

    UNION ALL

    -- RETURNS: restore stock (same sell_mode logic as the original sale)
    SELECT
      ri.product_id,
      r.warehouse_id,
      CASE
        WHEN COALESCE(si.sell_mode, 'unit') = 'box'
          THEN  ri.quantity * COALESCE(si.units_per_box, 1)
        ELSE ri.quantity::NUMERIC
      END AS delta
    FROM return_items ri
    JOIN returns r ON r.id = ri.return_id
    LEFT JOIN sale_items si
           ON si.sale_id = r.original_sale_id
          AND si.product_id = ri.product_id
  ),
  theoretical AS (
    SELECT
      product_id,
      warehouse_id,
      GREATEST(0, SUM(delta)) AS should_be
    FROM all_deltas
    WHERE warehouse_id IS NOT NULL AND product_id IS NOT NULL
    GROUP BY product_id, warehouse_id
  )
  SELECT
    t.product_id,
    t.warehouse_id,
    p.name::TEXT       AS producto,
    w.name::TEXT       AS almacen,
    sl.quantity        AS stock_actual,
    t.should_be        AS stock_correcto,
    t.should_be - sl.quantity AS diferencia
  FROM theoretical t
  JOIN stock_levels sl ON sl.product_id  = t.product_id
                      AND sl.warehouse_id = t.warehouse_id
  JOIN products   p  ON p.id = t.product_id
  JOIN warehouses w  ON w.id = t.warehouse_id
  WHERE sl.quantity != t.should_be
  ORDER BY ABS(t.should_be - sl.quantity) DESC;
$$;

-- ============================================================================
-- 2. APPLY — writes changes + audit log, admin only
-- ============================================================================
CREATE OR REPLACE FUNCTION recalibrate_stock_apply()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Guard: only admins can apply
  IF NOT public.user_is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden recalibrar el stock';
  END IF;

  WITH
  all_deltas AS (
    SELECT
      ti.product_id,
      t.to_warehouse_id AS warehouse_id,
      CASE
        WHEN t.type = 'IMPORT'                               THEN  ti.quantity
        WHEN t.type = 'ADJUSTMENT' AND t.reference = 'ADJ-'  THEN -ti.quantity
        WHEN t.type = 'ADJUSTMENT'                            THEN  ti.quantity
        WHEN t.type = 'INTERNAL'                              THEN  ti.quantity
      END AS delta
    FROM transfers t
    JOIN transfer_items ti ON ti.transfer_id = t.id
    WHERE t.type IN ('IMPORT', 'ADJUSTMENT')
       OR (t.type = 'INTERNAL' AND t.to_warehouse_id IS NOT NULL)

    UNION ALL

    SELECT ti.product_id, t.from_warehouse_id, -ti.quantity
    FROM transfers t
    JOIN transfer_items ti ON ti.transfer_id = t.id
    WHERE t.type = 'INTERNAL' AND t.from_warehouse_id IS NOT NULL

    UNION ALL

    SELECT
      si.product_id,
      s.warehouse_id,
      CASE
        WHEN si.sell_mode = 'box' THEN -(si.quantity * COALESCE(si.units_per_box, 1))
        ELSE -si.quantity
      END AS delta
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.status != 'Cancelled'

    UNION ALL

    SELECT
      ri.product_id,
      r.warehouse_id,
      CASE
        WHEN COALESCE(si.sell_mode, 'unit') = 'box'
          THEN  ri.quantity * COALESCE(si.units_per_box, 1)
        ELSE ri.quantity::NUMERIC
      END AS delta
    FROM return_items ri
    JOIN returns r ON r.id = ri.return_id
    LEFT JOIN sale_items si
           ON si.sale_id = r.original_sale_id
          AND si.product_id = ri.product_id
  ),
  theoretical AS (
    SELECT
      product_id,
      warehouse_id,
      GREATEST(0, SUM(delta)) AS should_be
    FROM all_deltas
    WHERE warehouse_id IS NOT NULL AND product_id IS NOT NULL
    GROUP BY product_id, warehouse_id
  )
  UPDATE stock_levels sl
  SET
    quantity   = t.should_be,
    updated_at = TIMEZONE('utc'::TEXT, NOW())
  FROM theoretical t
  WHERE sl.product_id   = t.product_id
    AND sl.warehouse_id  = t.warehouse_id
    AND sl.quantity     != t.should_be;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Audit trail
  BEGIN
    INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
    VALUES (
      auth.uid(),
      'ADJUSTMENT',
      'StockLevel',
      'FULL_RECALIBRATION',
      format(
        'Recalibración completa aplicada: %s registros corregidos (transfers + ventas + devoluciones)',
        v_count
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Don't let audit failure block the recalibration
  END;

  RETURN format('%s registros actualizados correctamente', v_count);
END;
$$;
