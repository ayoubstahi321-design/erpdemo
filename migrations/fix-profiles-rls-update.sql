-- ========================================
-- FIX: Políticas RLS para permitir que Admin/Manager actualicen usuarios
-- ========================================
-- Este script corrige las políticas RLS de la tabla profiles
-- para permitir que administradores actualicen perfiles de otros usuarios
-- ========================================

-- 1. Eliminar políticas antiguas
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- 2. Crear nueva política para actualizar perfiles
-- Los usuarios pueden actualizar su propio perfil
-- Los Admin y Manager pueden actualizar cualquier perfil
CREATE POLICY "Users can update profiles" ON profiles
  FOR UPDATE
  USING (
    -- El usuario puede actualizar su propio perfil
    auth.uid() = id
    OR
    -- O es Admin/Manager (puede actualizar cualquier perfil)
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('Admin', 'Manager')
    )
  )
  WITH CHECK (
    -- Misma condición para el WITH CHECK
    auth.uid() = id
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('Admin', 'Manager')
    )
  );

-- 3. Asegurar que las políticas de lectura e inserción estén correctas
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;

CREATE POLICY "Authenticated users can view all profiles" ON profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 4. Política de eliminación (solo Admin)
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'Admin'
    )
    AND auth.uid() != profiles.id  -- No puede eliminarse a sí mismo
  );

-- ========================================
-- VERIFICACIÓN
-- ========================================
-- Para verificar las políticas:
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Para probar que un Admin puede actualizar:
-- UPDATE profiles SET role = 'Manager' WHERE id = 'algún-uuid';
