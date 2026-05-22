-- ========================================
-- FIX: Agregar columnas email y last_active a profiles
-- ========================================
-- Este script agrega las columnas faltantes necesarias
-- para la gestión de usuarios en la aplicación web
-- ========================================

-- Agregar columna email (puede ser NULL porque no todos los perfiles existentes tendrán email)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Agregar columna last_active
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Crear índice para búsquedas rápidas por email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Actualizar la función handle_new_user para incluir email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, email, last_active)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1),
      'User'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'role',
      'Sales'
    ),
    NEW.email,  -- Extraer email del auth.users
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = COALESCE(EXCLUDED.name, profiles.name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    last_active = NOW(),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Actualizar los perfiles existentes que no tengan email con el email de auth.users
UPDATE profiles
SET email = auth.users.email
FROM auth.users
WHERE profiles.id = auth.users.id
AND profiles.email IS NULL;

-- ========================================
-- VERIFICACIÓN
-- ========================================
-- Ejecuta esta query para verificar:
-- SELECT id, name, email, role, last_active FROM profiles;
