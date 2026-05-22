-- ========================================
-- TEST DIAGNÓSTICO SIMPLE
-- ========================================
-- Ejecutar en Supabase SQL Editor
-- Copiar TODOS los resultados y enviarlos

-- TEST 1: ¿Estás autenticado?
SELECT 
  'TEST 1: Autenticación' as test,
  auth.uid() as tu_user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN '❌ NO AUTENTICADO'
    ELSE '✅ AUTENTICADO'
  END as estado;

-- TEST 2: ¿Tienes perfil?
SELECT 
  'TEST 2: Perfil' as test,
  COUNT(*) as perfil_existe,
  STRING_AGG(name || ' (' || role || ')', ', ') as perfil_info
FROM profiles 
WHERE id = auth.uid();

-- TEST 3: ¿Cuántos almacenes hay en total? (sin RLS)
-- NOTA: Este query usa privilegios de administrador
SELECT 
  'TEST 3: Total Almacenes (admin)' as test,
  COUNT(*) as total
FROM warehouses;

-- TEST 4: ¿Cuántos productos hay en total? (sin RLS)
SELECT 
  'TEST 4: Total Productos (admin)' as test,
  COUNT(*) as total
FROM products;

-- TEST 5: ¿Puedes VER almacenes con RLS?
-- Si falla, las políticas RLS te están bloqueando
SELECT 
  'TEST 5: Acceso a Warehouses (con RLS)' as test,
  COUNT(*) as puedo_ver
FROM warehouses
WHERE auth.uid() IS NOT NULL;

-- TEST 6: ¿Puedes VER productos con RLS?
SELECT 
  'TEST 6: Acceso a Products (con RLS)' as test,
  COUNT(*) as puedo_ver
FROM products
WHERE auth.uid() IS NOT NULL;

-- TEST 7: Listar políticas RLS activas
SELECT 
  'TEST 7: RLS Policies' as test,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('warehouses', 'products')
ORDER BY tablename, policyname;

-- TEST 8: ¿Hay almacenes de ejemplo?
SELECT 
  'TEST 8: Almacenes Existentes' as test,
  name,
  location,
  type
FROM warehouses
ORDER BY name
LIMIT 5;

-- TEST 9: ¿Hay productos de ejemplo?
SELECT 
  'TEST 9: Productos Existentes' as test,
  sku,
  name,
  category,
  price
FROM products
ORDER BY name
LIMIT 5;

-- RESUMEN FINAL
SELECT 
  '🔍 DIAGNÓSTICO COMPLETO' as resultado,
  (SELECT COUNT(*) FROM warehouses) as total_warehouses,
  (SELECT COUNT(*) FROM products) as total_products,
  (SELECT COUNT(*) FROM profiles WHERE id = auth.uid()) as tengo_perfil,
  CASE 
    WHEN auth.uid() IS NULL THEN '❌ LOGIN REQUERIDO'
    WHEN (SELECT COUNT(*) FROM profiles WHERE id = auth.uid()) = 0 THEN '❌ CREAR PERFIL'
    WHEN (SELECT COUNT(*) FROM warehouses) = 0 THEN '❌ AGREGAR ALMACENES'
    WHEN (SELECT COUNT(*) FROM products) = 0 THEN '❌ AGREGAR PRODUCTOS'
    ELSE '✅ TODO OK'
  END as accion_requerida;
