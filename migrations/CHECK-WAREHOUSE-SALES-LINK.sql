-- VERIFICAR SI LAS VENTAS TIENEN warehouse_id ASOCIADO

-- 1. Ver cuántas ventas hay
SELECT COUNT(*) as total_sales FROM sales;

-- 2. Ver las ventas con sus warehouse_id
SELECT 
  id,
  sale_number,
  date,
  warehouse_id,
  customer_name,
  total_amount
FROM sales
LIMIT 20;

-- 3. Verificar que los warehouse_id de las ventas existen en la tabla warehouses
SELECT 
  s.warehouse_id,
  COUNT(s.id) as sales_count,
  w.name as warehouse_name
FROM sales s
LEFT JOIN warehouses w ON s.warehouse_id = w.id
GROUP BY s.warehouse_id, w.name;

-- 4. Si hay warehouse_id que NO existen en warehouses (NULL en warehouse_name)
-- Significa que hay data inconsistente que hay que limpiar
SELECT 
  COUNT(*) as orphaned_sales
FROM sales s
WHERE s.warehouse_id NOT IN (SELECT id FROM warehouses);

-- 5. Ver todos los warehouse_id únicos que tiene
SELECT DISTINCT warehouse_id FROM sales ORDER BY warehouse_id;

-- 6. Comparar con warehouse_id en la BD
SELECT DISTINCT id as warehouse_id FROM warehouses ORDER BY id;
