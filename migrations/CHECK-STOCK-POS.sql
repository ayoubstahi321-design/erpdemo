-- ============================================
-- 🔍 VERIFICACIÓN RÁPIDA: Stock para Almacén Central
-- ============================================

-- 1. Buscar el ID de "Almacén Central"
SELECT
  '🏢 ID de Almacén Central:' AS info,
  id,
  name
FROM warehouses
WHERE name LIKE '%Central%' OR name LIKE '%central%';

-- 2. Ver stock en Almacén Central
SELECT
  p.name AS producto,
  p.sku,
  w.name AS almacen,
  sl.quantity AS stock,
  sl.warehouse_id,
  sl.product_id
FROM stock_levels sl
JOIN products p ON sl.product_id = p.id
JOIN warehouses w ON sl.warehouse_id = w.id
WHERE w.name LIKE '%Central%'
  AND sl.quantity > 0
ORDER BY p.name;

-- 3. Verificar formato de datos (para debug frontend)
SELECT
  p.id AS product_id,
  p.name,
  p.sku,
  sl.warehouse_id,
  w.name AS warehouse_name,
  sl.quantity
FROM products p
LEFT JOIN stock_levels sl ON p.id = sl.product_id
LEFT JOIN warehouses w ON sl.warehouse_id = w.id
WHERE p.name LIKE '%ANTIFREEZE%' OR p.name LIKE '%ATF%'
ORDER BY p.name, w.name
LIMIT 10;

-- 4. Ver TODOS los almacenes y su stock total
SELECT
  w.id,
  w.name AS almacen,
  COUNT(sl.id) AS productos_con_stock,
  SUM(sl.quantity) AS stock_total
FROM warehouses w
LEFT JOIN stock_levels sl ON w.id = sl.warehouse_id
GROUP BY w.id, w.name
ORDER BY w.name;
