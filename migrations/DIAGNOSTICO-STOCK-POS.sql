-- ============================================
-- 🔍 DIAGNÓSTICO: Stock en POS/TPV
-- ============================================

SELECT '🔍 VERIFICANDO PRODUCTOS Y STOCK...' AS status;

-- 1. Ver todos los productos con su stock por almacén
SELECT
  p.id,
  p.name,
  p.sku,
  w.name AS warehouse_name,
  sl.quantity,
  sl.warehouse_id
FROM products p
LEFT JOIN stock_levels sl ON p.id = sl.product_id
LEFT JOIN warehouses w ON sl.warehouse_id = w.id
ORDER BY p.name, w.name;

-- 2. Productos con stock > 0
SELECT
  p.name,
  w.name AS warehouse,
  sl.quantity
FROM products p
INNER JOIN stock_levels sl ON p.id = sl.product_id
INNER JOIN warehouses w ON sl.warehouse_id = w.id
WHERE sl.quantity > 0
ORDER BY p.name;

-- 3. Total de productos y total con stock
SELECT
  (SELECT COUNT(*) FROM products) AS total_products,
  (SELECT COUNT(DISTINCT product_id) FROM stock_levels WHERE quantity > 0) AS products_with_stock,
  (SELECT SUM(quantity) FROM stock_levels) AS total_stock_units;

-- 4. Ver estructura de un producto con stock (para debug)
SELECT
  p.id,
  p.name,
  p.sku,
  p.price,
  json_agg(
    json_build_object(
      'warehouse_id', sl.warehouse_id,
      'warehouse_name', w.name,
      'quantity', sl.quantity
    )
  ) AS stock_levels
FROM products p
LEFT JOIN stock_levels sl ON p.id = sl.product_id
LEFT JOIN warehouses w ON sl.warehouse_id = w.id
GROUP BY p.id, p.name, p.sku, p.price
LIMIT 5;
