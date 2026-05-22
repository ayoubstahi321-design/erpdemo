-- ================================================================
-- FIX STOCK TODOS LOS ALMACENES (excepto Tánger, ya corregido)
-- Casablanca: 7c5d7cd2-24df-468d-ad69-c12f84b2d345
-- OUJDA:      550e8400-e29b-41d4-a716-446655440001
-- BENIDRAR:   1e1803c2-d481-4e5f-ba99-5d27dd9d0915
--
-- Fórmula:
--   stock_correcto = GREATEST(0, transfer_neto_cajas × upb) - ventas_uds
-- transfer_items → cantidades en CAJAS (código antiguo)
-- sale_items     → cantidades en UNIDADES (sell_mode box = qty × upb)
-- ================================================================

-- PASO 1 — VERIFICAR ANTES DE APLICAR
WITH transfer_entradas AS (
  SELECT t.to_warehouse_id AS warehouse_id, ti.product_id, ti.quantity AS cajas
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.status = 'Completed'
    AND t.to_warehouse_id IS NOT NULL
    AND t.to_warehouse_id != '550e8400-e29b-41d4-a716-446655440003'
    AND NOT (t.type = 'ADJUSTMENT' AND t.reference LIKE 'ADJ-%')
),

transfer_salidas AS (
  SELECT t.from_warehouse_id AS warehouse_id, ti.product_id, -ti.quantity AS cajas
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.status = 'Completed'
    AND t.from_warehouse_id IS NOT NULL
    AND t.from_warehouse_id != '550e8400-e29b-41d4-a716-446655440003'
),

transfer_adj_minus AS (
  SELECT t.to_warehouse_id AS warehouse_id, ti.product_id, -ti.quantity AS cajas
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.status = 'Completed'
    AND t.type = 'ADJUSTMENT'
    AND t.reference LIKE 'ADJ-%'
    AND t.to_warehouse_id != '550e8400-e29b-41d4-a716-446655440003'
),

transfer_net AS (
  SELECT warehouse_id, product_id, SUM(cajas) AS net_cajas
  FROM (
    SELECT * FROM transfer_entradas
    UNION ALL
    SELECT * FROM transfer_salidas
    UNION ALL
    SELECT * FROM transfer_adj_minus
  ) all_moves
  GROUP BY warehouse_id, product_id
),

ventas_net AS (
  SELECT
    s.warehouse_id,
    si.product_id,
    SUM(
      CASE WHEN si.sell_mode = 'box'
        THEN si.quantity * COALESCE(si.units_per_box, 1)
        ELSE si.quantity
      END
    ) AS uds_vendidas
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  WHERE s.status != 'cancelled'
    AND s.warehouse_id != '550e8400-e29b-41d4-a716-446655440003'
  GROUP BY s.warehouse_id, si.product_id
)

SELECT
  w.name                                                           AS almacen,
  p.name                                                           AS producto,
  p.units_per_box                                                  AS upb,
  COALESCE(t.net_cajas, 0)                                        AS cajas_neto,
  GREATEST(0, COALESCE(t.net_cajas, 0)) * p.units_per_box         AS uds_por_transferencias,
  COALESCE(v.uds_vendidas, 0)                                      AS uds_vendidas,
  GREATEST(0,
    GREATEST(0, COALESCE(t.net_cajas, 0)) * p.units_per_box
    - COALESCE(v.uds_vendidas, 0)
  )                                                                AS stock_correcto,
  sl.quantity                                                      AS stock_actual_bd,
  sl.quantity - GREATEST(0,
    GREATEST(0, COALESCE(t.net_cajas, 0)) * p.units_per_box
    - COALESCE(v.uds_vendidas, 0)
  )                                                                AS diferencia
FROM stock_levels sl
JOIN products p   ON p.id = sl.product_id
JOIN warehouses w ON w.id = sl.warehouse_id
LEFT JOIN transfer_net t ON t.product_id = sl.product_id AND t.warehouse_id = sl.warehouse_id
LEFT JOIN ventas_net v   ON v.product_id = sl.product_id AND v.warehouse_id = sl.warehouse_id
WHERE sl.warehouse_id != '550e8400-e29b-41d4-a716-446655440003'
  AND p.units_per_box > 1
ORDER BY w.name, diferencia DESC, p.name;


-- ================================================================
-- PASO 2 — APLICAR CORRECCIÓN
-- (solo si el PASO 1 muestra valores coherentes)
-- ================================================================
UPDATE stock_levels sl
SET quantity = GREATEST(0,
  GREATEST(0, COALESCE(t.net_cajas, 0)) * p.units_per_box
  - COALESCE(v.uds_vendidas, 0)
)
FROM (
  SELECT warehouse_id, product_id, SUM(cajas) AS net_cajas
  FROM (
    SELECT t.to_warehouse_id AS warehouse_id, ti.product_id, ti.quantity AS cajas
    FROM transfer_items ti JOIN transfers t ON t.id = ti.transfer_id
    WHERE t.status = 'Completed'
      AND t.to_warehouse_id IS NOT NULL
      AND t.to_warehouse_id != '550e8400-e29b-41d4-a716-446655440003'
      AND NOT (t.type = 'ADJUSTMENT' AND t.reference LIKE 'ADJ-%')

    UNION ALL

    SELECT t.from_warehouse_id, ti.product_id, -ti.quantity
    FROM transfer_items ti JOIN transfers t ON t.id = ti.transfer_id
    WHERE t.status = 'Completed'
      AND t.from_warehouse_id IS NOT NULL
      AND t.from_warehouse_id != '550e8400-e29b-41d4-a716-446655440003'

    UNION ALL

    SELECT t.to_warehouse_id, ti.product_id, -ti.quantity
    FROM transfer_items ti JOIN transfers t ON t.id = ti.transfer_id
    WHERE t.status = 'Completed'
      AND t.type = 'ADJUSTMENT' AND t.reference LIKE 'ADJ-%'
      AND t.to_warehouse_id != '550e8400-e29b-41d4-a716-446655440003'
  ) m
  GROUP BY warehouse_id, product_id
) t
JOIN products p ON p.id = t.product_id
LEFT JOIN (
  SELECT s.warehouse_id, si.product_id,
    SUM(CASE WHEN si.sell_mode = 'box'
      THEN si.quantity * COALESCE(si.units_per_box, 1)
      ELSE si.quantity END) AS uds_vendidas
  FROM sale_items si JOIN sales s ON s.id = si.sale_id
  WHERE s.status != 'cancelled'
    AND s.warehouse_id != '550e8400-e29b-41d4-a716-446655440003'
  GROUP BY s.warehouse_id, si.product_id
) v ON v.product_id = t.product_id AND v.warehouse_id = t.warehouse_id
WHERE sl.product_id   = t.product_id
  AND sl.warehouse_id = t.warehouse_id
  AND sl.warehouse_id != '550e8400-e29b-41d4-a716-446655440003'
  AND p.units_per_box > 1;
