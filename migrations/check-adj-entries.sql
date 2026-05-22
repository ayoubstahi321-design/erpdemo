-- ================================================================
-- VERIFICAR ENTRADAS ADJ — qué almacén afectan y si el stock fix las cubrió
-- ================================================================

-- 1. Ver todos los ajustes (ADJUSTMENT) con sus productos y almacenes
SELECT
  t.reference,
  t.date::date,
  t.type,
  t.to_warehouse_id,
  w.name AS warehouse,
  ti.product_name,
  p.units_per_box AS upb,
  ti.quantity AS qty_uds,
  ROUND(ti.quantity::numeric / p.units_per_box, 2) AS qty_cajas,
  t.reason
FROM transfers t
JOIN transfer_items ti ON ti.transfer_id = t.id
JOIN warehouses w ON w.id = t.to_warehouse_id
JOIN products p ON p.id = ti.product_id
WHERE t.type = 'ADJUSTMENT'
  AND ti.product_name ILIKE '%ultra plus%'
ORDER BY t.date, t.reference;

-- 2. Ver también si hay ajustes negativos (from_warehouse_id)
SELECT
  t.reference,
  t.date::date,
  t.type,
  t.from_warehouse_id,
  w.name AS warehouse_from,
  t.to_warehouse_id,
  w2.name AS warehouse_to,
  ti.product_name,
  ti.quantity AS qty,
  t.reason
FROM transfers t
JOIN transfer_items ti ON ti.transfer_id = t.id
LEFT JOIN warehouses w ON w.id = t.from_warehouse_id
LEFT JOIN warehouses w2 ON w2.id = t.to_warehouse_id
WHERE t.type = 'ADJUSTMENT'
  AND (ti.product_name ILIKE '%ultra plus%' OR ti.product_name ILIKE '%dpf%')
ORDER BY t.date;

-- 3. Stock actual de Ultra Plus en todos los almacenes
SELECT
  w.name AS warehouse,
  p.name AS producto,
  p.units_per_box AS upb,
  sl.quantity AS stock_uds,
  ROUND(sl.quantity::numeric / p.units_per_box, 1) AS stock_cajas
FROM stock_levels sl
JOIN products p ON p.id = sl.product_id
JOIN warehouses w ON w.id = sl.warehouse_id
WHERE p.name ILIKE '%ultra plus%'
ORDER BY p.name, w.name;
