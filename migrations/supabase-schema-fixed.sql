-- ========================================
-- AZMOL STOCK ERP - SCHEMA SIMPLIFICADO
-- ========================================
-- Ejecutar línea por línea o por secciones
-- ========================================

-- ========================================
-- PASO 1: Eliminar trigger anterior si existe
-- ========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ========================================
-- PASO 2: Crear/actualizar tabla profiles
-- ========================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'Sales' CHECK (role IN ('Admin', 'Manager', 'Sales', 'Delivery', 'Cashier')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ========================================
-- PASO 3: RLS para profiles (simplificado)
-- ========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
CREATE POLICY "Enable read access for authenticated users" ON profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
CREATE POLICY "Enable insert for authenticated users" ON profiles
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;
CREATE POLICY "Enable update for users based on id" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ========================================
-- PASO 4: Función para crear perfil (MEJORADA)
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
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
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = COALESCE(EXCLUDED.name, profiles.name),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- ========================================
-- PASO 5: Trigger para auto-crear perfil
-- ========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- PASO 6: Warehouses (simplificado)
-- ========================================
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Central', 'Branch', 'Transit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON warehouses;
CREATE POLICY "Enable all for authenticated users" ON warehouses
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ========================================
-- PASO 7: Datos iniciales
-- ========================================
INSERT INTO warehouses (id, name, location, type) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Almacén Central', 'Casablanca', 'Central'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Sucursal Rabat', 'Rabat', 'Branch'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Almacén Tánger', 'Tánger', 'Branch')
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- PASO 8: Verificación
-- ========================================
-- Ejecuta esta query para verificar:
-- SELECT * FROM warehouses;
-- SELECT * FROM profiles;

-- ========================================
-- FIN - Tu base de datos está lista
-- ========================================
