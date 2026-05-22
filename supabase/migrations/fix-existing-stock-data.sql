-- ========================================
-- DIAGNOSTIC: Check and fix existing stock data corrupted by double-updates
-- ========================================
-- RUN THIS AFTER fix-double-stock-updates.sql
--
-- This script recalculates stock from scratch based on actual transactions:
-- 1. Transfers (IMPORT/INTERNAL/ADJUSTMENT) → from transfer_items
-- 2. Sales → from sale_items (deducted by create_sale_atomic RPC)
-- 3. Returns → from return_items (restored by client code)
--
-- WARNING: This will RESET all stock_levels to calculated values.
-- Review the SELECT query first before running the UPDATE.
-- ========================================

-- STEP 1: DIAGNOSTIC - Show current vs calculated stock
-- Run this SELECT first to see which products are affected
WITH transfer_stock AS (
  -- Stock added by IMPORT transfers
  SELECT ti.product_id, t.to_warehouse_id AS warehouse_id, SUM(ti.quantity) AS total
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.type = 'IMPORT' AND t.status = 'Completed' AND t.to_warehouse_id IS NOT NULL
  GROUP BY ti.product_id, t.to_warehouse_id

  UNION ALL

  -- Stock added to destination by INTERNAL transfers
  SELECT ti.product_id, t.to_warehouse_id AS warehouse_id, SUM(ti.quantity) AS total
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.type = 'INTERNAL' AND t.status = 'Completed' AND t.to_warehouse_id IS NOT NULL
  GROUP BY ti.product_id, t.to_warehouse_id

  UNION ALL

  -- Stock removed from source by INTERNAL transfers
  SELECT ti.product_id, t.from_warehouse_id AS warehouse_id, -SUM(ti.quantity) AS total
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.type = 'INTERNAL' AND t.status = 'Completed' AND t.from_warehouse_id IS NOT NULL
  GROUP BY ti.product_id, t.from_warehouse_id

  UNION ALL

  -- Stock adjustments (positive)
  SELECT ti.product_id, t.to_warehouse_id AS warehouse_id, SUM(ti.quantity) AS total
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.type = 'ADJUSTMENT' AND t.reference LIKE 'ADJ+%' AND t.status = 'Completed'
  GROUP BY ti.product_id, t.to_warehouse_id

  UNION ALL

  -- Stock adjustments (negative)
  SELECT ti.product_id, t.to_warehouse_id AS warehouse_id, -SUM(ti.quantity) AS total
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.type = 'ADJUSTMENT' AND t.reference LIKE 'ADJ-%' AND t.status = 'Completed'
  GROUP BY ti.product_id, t.to_warehouse_id
),
sale_stock AS (
  -- Stock deducted by sales (accounting for box mode)
  SELECT si.product_id, s.warehouse_id,
    -SUM(
      CASE WHEN si.sell_mode = 'box'
        THEN si.quantity * COALESCE(si.units_per_box, 1)
        ELSE si.quantity
      END
    ) AS total
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  WHERE s.status = 'Completed' AND s.warehouse_id IS NOT NULL
  GROUP BY si.product_id, s.warehouse_id
),
return_stock AS (
  -- Stock restored by returns (accounting for box mode from original sale)
  SELECT ri.product_id, r.warehouse_id,
    SUM(
      CASE WHEN osi.sell_mode = 'box'
        THEN ri.quantity * COALESCE(osi.units_per_box, 1)
        ELSE ri.quantity
      END
    ) AS total
  FROM return_items ri
  JOIN returns r ON r.id = ri.return_id
  LEFT JOIN sales os ON os.id = r.original_sale_id
  LEFT JOIN sale_items osi ON osi.sale_id = os.id AND osi.product_id = ri.product_id
  WHERE r.warehouse_id IS NOT NULL
  GROUP BY ri.product_id, r.warehouse_id
),
calculated AS (
  SELECT product_id, warehouse_id, SUM(total) AS expected_quantity
  FROM (
    SELECT * FROM transfer_stock
    UNION ALL SELECT * FROM sale_stock
    UNION ALL SELECT * FROM return_stock
  ) all_movements
  GROUP BY product_id, warehouse_id
)
SELECT
  p.name AS product_name,
  w.name AS warehouse_name,
  sl.quantity AS current_stock,
  COALESCE(c.expected_quantity, 0) AS expected_stock,
  sl.quantity - COALESCE(c.expected_quantity, 0) AS difference
FROM stock_levels sl
JOIN products p ON p.id = sl.product_id
JOIN warehouses w ON w.id = sl.warehouse_id
LEFT JOIN calculated c ON c.product_id = sl.product_id AND c.warehouse_id = sl.warehouse_id
WHERE sl.quantity != COALESCE(c.expected_quantity, 0)
ORDER BY ABS(sl.quantity - COALESCE(c.expected_quantity, 0)) DESC;

-- ========================================
-- STEP 2: FIX - Uncomment the UPDATE below to fix stock levels
-- Only run this AFTER reviewing the SELECT above!
-- ========================================

/*
WITH transfer_stock AS (
  SELECT ti.product_id, t.to_warehouse_id AS warehouse_id, SUM(ti.quantity) AS total
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.type = 'IMPORT' AND t.status = 'Completed' AND t.to_warehouse_id IS NOT NULL
  GROUP BY ti.product_id, t.to_warehouse_id
  UNION ALL
  SELECT ti.product_id, t.to_warehouse_id AS warehouse_id, SUM(ti.quantity) AS total
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.type = 'INTERNAL' AND t.status = 'Completed' AND t.to_warehouse_id IS NOT NULL
  GROUP BY ti.product_id, t.to_warehouse_id
  UNION ALL
  SELECT ti.product_id, t.from_warehouse_id AS warehouse_id, -SUM(ti.quantity) AS total
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.type = 'INTERNAL' AND t.status = 'Completed' AND t.from_warehouse_id IS NOT NULL
  GROUP BY ti.product_id, t.from_warehouse_id
  UNION ALL
  SELECT ti.product_id, t.to_warehouse_id AS warehouse_id, SUM(ti.quantity) AS total
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.type = 'ADJUSTMENT' AND t.reference LIKE 'ADJ+%' AND t.status = 'Completed'
  GROUP BY ti.product_id, t.to_warehouse_id
  UNION ALL
  SELECT ti.product_id, t.to_warehouse_id AS warehouse_id, -SUM(ti.quantity) AS total
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.type = 'ADJUSTMENT' AND t.reference LIKE 'ADJ-%' AND t.status = 'Completed'
  GROUP BY ti.product_id, t.to_warehouse_id
),
sale_stock AS (
  SELECT si.product_id, s.warehouse_id,
    -SUM(
      CASE WHEN si.sell_mode = 'box'
        THEN si.quantity * COALESCE(si.units_per_box, 1)
        ELSE si.quantity
      END
    ) AS total
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  WHERE s.status = 'Completed' AND s.warehouse_id IS NOT NULL
  GROUP BY si.product_id, s.warehouse_id
),
return_stock AS (
  SELECT ri.product_id, r.warehouse_id,
    SUM(
      CASE WHEN osi.sell_mode = 'box'
        THEN ri.quantity * COALESCE(osi.units_per_box, 1)
        ELSE ri.quantity
      END
    ) AS total
  FROM return_items ri
  JOIN returns r ON r.id = ri.return_id
  LEFT JOIN sales os ON os.id = r.original_sale_id
  LEFT JOIN sale_items osi ON osi.sale_id = os.id AND osi.product_id = ri.product_id
  WHERE r.warehouse_id IS NOT NULL
  GROUP BY ri.product_id, r.warehouse_id
),
calculated AS (
  SELECT product_id, warehouse_id, SUM(total) AS expected_quantity
  FROM (
    SELECT * FROM transfer_stock
    UNION ALL SELECT * FROM sale_stock
    UNION ALL SELECT * FROM return_stock
  ) all_movements
  GROUP BY product_id, warehouse_id
)
UPDATE stock_levels sl
SET quantity = GREATEST(0, COALESCE(c.expected_quantity, 0)),
    updated_at = TIMEZONE('utc'::text, NOW())
FROM calculated c
WHERE sl.product_id = c.product_id
  AND sl.warehouse_id = c.warehouse_id
  AND sl.quantity != GREATEST(0, COALESCE(c.expected_quantity, 0));
*/
