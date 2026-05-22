-- ========================================
-- 🚨 FIX URGENTE: Warehouses no aparecen en Dashboard y POS
-- ========================================
-- PROBLEMA: RLS policies muy restrictivas o perfiles sin crear
-- SOLUCIÓN: Simplificar RLS + Crear perfiles faltantes
-- EJECUTAR EN: Supabase SQL Editor AHORA

-- PASO 1: DIAGNOSTICO - Ver estado actual
DO $$
BEGIN
  RAISE NOTICE '=== DIAGNOSTICO INICIAL ===';
  RAISE NOTICE 'Warehouses en DB: %', (SELECT COUNT(*) FROM warehouses);
  RAISE NOTICE 'Usuarios auth: %', (SELECT COUNT(*) FROM auth.users);
  RAISE NOTICE 'Perfiles creados: %', (SELECT COUNT(*) FROM profiles);
  RAISE NOTICE 'Usuarios SIN perfil: %', (
    SELECT COUNT(*) FROM auth.users u 
    LEFT JOIN profiles p ON p.id = u.id 
    WHERE p.id IS NULL
  );
END $$;

-- PASO 2: CREAR PERFILES FALTANTES (URGENTE)
-- Si un usuario no tiene perfil, NO puede pasar las policies
INSERT INTO public.profiles (id, name, role, created_at, updated_at)
SELECT 
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1)
  ) as name,
  COALESCE(
    u.raw_user_meta_data->>'role',
    'Sales'  -- Default role si no tiene
  )::TEXT as role,
  NOW(),
  NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW();

-- PASO 3: VERIFICAR TRIGGER DE AUTO-CREAR PERFIL EXISTE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    RAISE NOTICE '⚠️ TRIGGER on_auth_user_created NO EXISTE - Ejecutar FIX-AUTO-CREATE-PROFILES-TRIGGER.sql';
  ELSE
    RAISE NOTICE '✅ Trigger on_auth_user_created OK';
  END IF;
END $$;

-- PASO 4: SIMPLIFICAR RLS DE WAREHOUSES (MÁS PERMISIVO)
-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view warehouses" ON warehouses;
DROP POLICY IF EXISTS "Admins can manage warehouses" ON warehouses;
DROP POLICY IF EXISTS "Allow authenticated access" ON warehouses;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON warehouses;

-- Policy 1: TODOS los usuarios autenticados pueden VER warehouses
CREATE POLICY "warehouses_select_all_authenticated" ON warehouses
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- Policy 2: SOLO Admin/Manager pueden modificar
CREATE POLICY "warehouses_modify_admin_manager" ON warehouses
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('Admin', 'Manager')
    )
  );

-- PASO 5: VERIFICAR QUE HAY DATOS
DO $$
DECLARE
  warehouse_count INT;
BEGIN
  SELECT COUNT(*) INTO warehouse_count FROM warehouses;
  
  IF warehouse_count = 0 THEN
    RAISE NOTICE '⚠️ NO HAY WAREHOUSES EN LA DB - Insertando datos de ejemplo...';
    
    -- Insertar 3 warehouses default
    INSERT INTO warehouses (id, name, location, type)
    VALUES 
      ('550e8400-e29b-41d4-a716-446655440001', 'Casablanca Central', 'Casablanca', 'Central'),
      ('550e8400-e29b-41d4-a716-446655440002', 'Rabat Branch', 'Rabat', 'Branch'),
      ('550e8400-e29b-41d4-a716-446655440003', 'Tánger Branch', 'Tánger', 'Branch')
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE '✅ 3 warehouses creados';
  ELSE
    RAISE NOTICE '✅ Ya existen % warehouses', warehouse_count;
  END IF;
END $$;

-- PASO 6: VERIFICACIÓN FINAL
SELECT 
  '=== VERIFICACIÓN FINAL ===' as step,
  (SELECT COUNT(*) FROM warehouses) as total_warehouses,
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM profiles) as total_profiles,
  (SELECT COUNT(*) FROM auth.users u LEFT JOIN profiles p ON p.id = u.id WHERE p.id IS NULL) as users_sin_perfil,
  CASE 
    WHEN (SELECT COUNT(*) FROM warehouses) = 0 THEN '❌ NO HAY WAREHOUSES'
    WHEN (SELECT COUNT(*) FROM auth.users u LEFT JOIN profiles p ON p.id = u.id WHERE p.id IS NULL) > 0 THEN '⚠️ HAY USUARIOS SIN PERFIL'
    ELSE '✅ TODO OK'
  END as estado;

-- Ver warehouses creados
SELECT 
  '=== WAREHOUSES DISPONIBLES ===' as info,
  id,
  name,
  location,
  type
FROM warehouses
ORDER BY name;

-- Ver usuarios y sus perfiles
SELECT 
  '=== USUARIOS Y PERFILES ===' as info,
  u.email,
  p.name as profile_name,
  p.role,
  CASE 
    WHEN p.id IS NULL THEN '❌ SIN PERFIL (NO PUEDE VER WAREHOUSES)'
    ELSE '✅ TIENE PERFIL'
  END as estado
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.created_at;

-- Ver policies activas
SELECT 
  '=== POLICIES DE WAREHOUSES ===' as info,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation
FROM pg_policies
WHERE tablename = 'warehouses'
ORDER BY cmd;

-- RESULTADO ESPERADO:
-- ✅ Todos los usuarios tienen perfil
-- ✅ Al menos 3 warehouses en DB
-- ✅ 2 policies: SELECT para todos, ALL para Admin/Manager
-- ✅ Dashboard y POS verán warehouses inmediatamente

-- NOTA: Después de ejecutar esto, hacer REFRESH en el navegador (Ctrl+Shift+R)
