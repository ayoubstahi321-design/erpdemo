-- ========================================
-- 🔍 DIAGNÓSTICO DEFINITIVO: Warehouses vacíos
-- ========================================
-- Ejecutar en Supabase SQL Editor AHORA

-- PASO 1: Ver cuántos warehouses existen
SELECT 
  '=== WAREHOUSES EN DB ===' as check,
  COUNT(*) as total
FROM warehouses;

-- PASO 2: Listar warehouses
SELECT * FROM warehouses ORDER BY name;

-- PASO 3: Verificar que RLS permite ver warehouses
-- (Esta query falla si el perfil no existe o RLS bloquea)
SELECT 
  '=== TEST RLS ===' as check,
  auth.uid() as mi_user_id,
  (SELECT COUNT(*) FROM warehouses) as warehouses_visibles;

-- PASO 4: Ver perfil actual
SELECT 
  '=== MI PERFIL ===' as check,
  p.*,
  u.email
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.id = auth.uid();

-- PASO 5: Ver policies activas
SELECT 
  '=== POLICIES WAREHOUSES ===' as check,
  policyname,
  cmd,
  qual::text
FROM pg_policies 
WHERE tablename = 'warehouses';

-- RESULTADO ESPERADO:
-- ✅ total warehouses: 3 (o más)
-- ✅ warehouses_visibles: 3 (mismo número)
-- ✅ Mi perfil existe con role Admin/Manager/Sales
-- ✅ Policy "Authenticated users can view warehouses" existe
