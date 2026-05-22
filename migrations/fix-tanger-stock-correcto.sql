-- ================================================================
-- FIX TÁNGER — stock correcto basado en movimientos visibles
-- Todos los qty en transfer_items están en CAJAS (código antiguo)
-- Solo incluye movimientos hasta 01/04/2026
-- (los envíos post-01/04 a Casablanca los gestiona el usuario)
-- ================================================================

-- PASO 1 — VER QUÉ SE VA A PONER (ejecutar primero para verificar)
SELECT
  p.name                                                    AS producto,
  p.units_per_box                                           AS upb,
  COALESCE(n.saldo_cajas, 0)                               AS cajas_segun_capturas,
  GREATEST(0, COALESCE(n.saldo_cajas, 0)) * p.units_per_box AS unidades_correctas,
  sl.quantity                                               AS stock_actual_bd
FROM stock_levels sl
JOIN products p ON p.id = sl.product_id
LEFT JOIN (
  SELECT
    ti.product_id,
    SUM(CASE
      WHEN t.to_warehouse_id = '550e8400-e29b-41d4-a716-446655440003'
        AND NOT (t.type = 'ADJUSTMENT' AND t.reference = 'ADJ-')
        THEN ti.quantity
      WHEN t.from_warehouse_id = '550e8400-e29b-41d4-a716-446655440003'
        THEN -ti.quantity
      WHEN t.to_warehouse_id = '550e8400-e29b-41d4-a716-446655440003'
        AND t.type = 'ADJUSTMENT' AND t.reference = 'ADJ-'
        THEN -ti.quantity
      ELSE 0
    END) AS saldo_cajas
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.status = 'Completed'
    AND (t.to_warehouse_id   = '550e8400-e29b-41d4-a716-446655440003'
      OR t.from_warehouse_id = '550e8400-e29b-41d4-a716-446655440003')
    AND t.date::date <= '2026-04-01'
  GROUP BY ti.product_id
) n ON n.product_id = sl.product_id
WHERE sl.warehouse_id = '550e8400-e29b-41d4-a716-446655440003'
  AND p.units_per_box > 1
ORDER BY p.name;


-- ================================================================
-- PASO 2 — APLICAR LA CORRECCIÓN
-- (solo si el PASO 1 muestra valores correctos)
-- ================================================================
UPDATE stock_levels sl
SET quantity = GREATEST(0, COALESCE(n.saldo_cajas, 0)) * p.units_per_box
FROM (
  SELECT
    ti.product_id,
    SUM(CASE
      WHEN t.to_warehouse_id = '550e8400-e29b-41d4-a716-446655440003'
        AND NOT (t.type = 'ADJUSTMENT' AND t.reference = 'ADJ-')
        THEN ti.quantity
      WHEN t.from_warehouse_id = '550e8400-e29b-41d4-a716-446655440003'
        THEN -ti.quantity
      WHEN t.to_warehouse_id = '550e8400-e29b-41d4-a716-446655440003'
        AND t.type = 'ADJUSTMENT' AND t.reference = 'ADJ-'
        THEN -ti.quantity
      ELSE 0
    END) AS saldo_cajas
  FROM transfer_items ti
  JOIN transfers t ON t.id = ti.transfer_id
  WHERE t.status = 'Completed'
    AND (t.to_warehouse_id   = '550e8400-e29b-41d4-a716-446655440003'
      OR t.from_warehouse_id = '550e8400-e29b-41d4-a716-446655440003')
    AND t.date::date <= '2026-04-01'
  GROUP BY ti.product_id
) n
JOIN products p ON p.id = n.product_id
WHERE sl.product_id   = n.product_id
  AND sl.warehouse_id = '550e8400-e29b-41d4-a716-446655440003'
  AND p.units_per_box > 1;
