-- ========================================
-- FIX PERMANENTE: Auto-crear perfiles cuando se crean usuarios
-- ========================================
-- Ejecutar en Supabase SQL Editor AHORA
-- Esto garantiza que SIEMPRE se cree un perfil automáticamente

-- PASO 1: Eliminar trigger antiguo si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- PASO 2: Crear función mejorada que crea perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name TEXT;
  v_role TEXT;
BEGIN
  -- Obtener nombre del metadata o del email
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Obtener rol del metadata o default a 'Sales'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'Sales'
  );
  
  -- Insertar perfil automáticamente
  INSERT INTO public.profiles (id, name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    v_name,
    v_role::TEXT,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    updated_at = NOW();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 3: Crear trigger que se ejecuta DESPUÉS de insertar en auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- PASO 4: Crear perfiles para usuarios existentes que no tienen perfil
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
    'Sales'
  )::TEXT as role,
  NOW(),
  NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- VERIFICACIÓN
SELECT 
  '✅ TRIGGER INSTALADO' as resultado,
  COUNT(*) as usuarios_auth,
  (SELECT COUNT(*) FROM public.profiles) as usuarios_con_perfil,
  CASE 
    WHEN COUNT(*) = (SELECT COUNT(*) FROM public.profiles) THEN '✅ TODOS LOS USUARIOS TIENEN PERFIL'
    ELSE '⚠️ FALTAN PERFILES'
  END as estado
FROM auth.users;

-- Listar usuarios con sus perfiles
SELECT 
  u.email,
  p.name,
  p.role,
  CASE WHEN p.id IS NULL THEN '❌ SIN PERFIL' ELSE '✅ OK' END as estado
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.created_at;

-- RESULTADO ESPERADO:
-- ✅ Trigger instalado
-- ✅ Todos los usuarios existentes tienen perfil
-- ✅ Nuevos usuarios tendrán perfil automáticamente
