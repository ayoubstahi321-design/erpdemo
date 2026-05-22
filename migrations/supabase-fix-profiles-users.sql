-- ========================================
-- FIX: Tabla profiles para gestión de usuarios desde la app
-- ========================================
-- Este script modifica la tabla profiles para permitir
-- gestión de usuarios independiente de Supabase Auth
-- ========================================

-- 1. Agregar campos faltantes a la tabla profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE;

-- 2. Hacer el campo id independiente de auth.users
-- (permitir crear usuarios sin autenticación)
ALTER TABLE profiles
  ALTER COLUMN id DROP NOT NULL,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Hacer email único (opcional pero recomendado)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email) WHERE email IS NOT NULL;

-- 4. Actualizar políticas RLS para permitir gestión desde la app
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;
CREATE POLICY "Authenticated users can view all profiles" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  );

-- 5. Comentarios para documentación
COMMENT ON COLUMN profiles.email IS 'Email del usuario de la aplicación (independiente de auth.users)';
COMMENT ON COLUMN profiles.last_active IS 'Última actividad registrada del usuario';

-- ========================================
-- FIN DEL SCRIPT
-- ========================================
-- Ejecuta este script en Supabase SQL Editor
-- Después tu tabla profiles estará lista para gestionar usuarios desde la app
-- ========================================
