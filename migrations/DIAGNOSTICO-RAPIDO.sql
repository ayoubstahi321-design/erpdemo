-- ========================================
-- DIAGNÓSTICO RÁPIDO - Dashboard/POS vacío
-- ========================================
-- Ejecutar en Supabase SQL Editor para identificar el problema

-- 1. VERIFICAR DATOS EXISTENTES
SELECT 
  'Warehouses' as tabla,
  COUNT(*) as total,
  STRING_AGG(name, ', ') as nombres
FROM warehouses
UNION ALL
SELECT 
  'Products' as tabla,
  COUNT(*) as total,
  (SELECT STRING_AGG(name, ', ') FROM (SELECT name FROM products ORDER BY name LIMIT 5) sub) as nombres
FROM products
UNION ALL
SELECT 
  'Stock Levels' as tabla,
  COUNT(*) as total,
  NULL as nombres
FROM stock_levels
UNION ALL
SELECT 
  'Customers' as tabla,
  COUNT(*) as total,
  (SELECT STRING_AGG(name, ', ') FROM (SELECT name FROM customers ORDER BY name LIMIT 5) sub) as nombres
FROM customers;

-- 2. VERIFICAR PERFIL DEL USUARIO ACTUAL
SELECT 
  p.id,
  p.name,
  p.role,
  p.created_at,
  u.email
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.id = auth.uid();

-- 3. VERIFICAR PERMISOS RLS (Row Level Security)
-- Si esta consulta falla, RLS está bloqueando
SELECT 
  'TEST: Puedo ver warehouses' as test,
  COUNT(*) as total
FROM warehouses;

SELECT 
  'TEST: Puedo ver products' as test,
  COUNT(*) as total
FROM products;

-- 4. VERIFICAR POLÍTICAS RLS ACTIVAS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('warehouses', 'products', 'stock_levels')
ORDER BY tablename, policyname;

-- 5. VERIFICAR SI USUARIO TIENE ALMACÉN ASIGNADO
-- NOTA: La tabla profiles NO tiene warehouse_id en el schema
-- El sistema debe permitir a todos los usuarios ver todos los almacenes
SELECT 
  p.id as user_id,
  p.name as user_name,
  p.role,
  u.email,
  '⚠️ Schema NO tiene warehouse_id - Usuarios ven TODOS los almacenes' as nota
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.id = auth.uid();

-- 6. INFORMACIÓN IMPORTANTE
-- El schema actual NO tiene warehouse_id en profiles
-- Esto significa que el sistema debe mostrar TODOS los almacenes/productos
-- Si no se ven, el problema es:
--   A) Permisos RLS bloqueando
--   B) Error en frontend (JavaScript)
--   C) Variables de entorno incorrectas

SELECT 
  '✅ El schema NO restringe por almacén' as diagnostico,
  'Todos los usuarios deben ver todos los datos' as comportamiento_esperado,
  'Si no ves datos, revisar: 1) RLS policies, 2) Console del navegador' as siguiente_paso;

-- 7. VERIFICAR STOCK POR ALMACÉN
SELECT 
  w.name as almacen,
  COUNT(DISTINCT sl.product_id) as productos_con_stock,
  SUM(sl.quantity) as cantidad_total
FROM warehouses w
LEFT JOIN stock_levels sl ON sl.warehouse_id = w.id
GROUP BY w.id, w.name
ORDER BY w.name;

-- 8. VERIFICAR SI HAY PRODUCTOS SIN STOCK
SELECT 
  COUNT(*) as productos_sin_stock,
  (SELECT STRING_AGG(name, ', ') FROM (SELECT name FROM products p2 WHERE NOT EXISTS (SELECT 1 FROM stock_levels sl WHERE sl.product_id = p2.id) ORDER BY name LIMIT 5) sub) as primeros_5
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM stock_levels sl WHERE sl.product_id = p.id
);
