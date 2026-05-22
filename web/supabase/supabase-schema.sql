-- ============================
-- 1. Crear tabla profiles si no existe
-- ============================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,  -- UID del usuario de Auth
  name TEXT NOT NULL,
  role TEXT DEFAULT 'Sales',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================
-- 2. Policies RLS
-- ============================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================
-- 3. Trigger: actualizar updated_at
-- ============================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_updated ON profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- ============================
-- 4. Trigger: crear perfil automáticamente
-- ============================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Evitar duplicados
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = NEW.id) THEN
    INSERT INTO profiles (id, name, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'role', 'Sales')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- ============================
-- 5. Crear admin fijo si no existe
-- ============================
INSERT INTO profiles (id, name, role, created_at, updated_at)
SELECT '7cd782d4-1e9c-425d-a4e6-84c865cfb248', 'Administrador', 'Admin', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM profiles WHERE id = '7cd782d4-1e9c-425d-a4e6-84c865cfb248'
);

-- ============================
-- 6. Migrar perfiles antiguos si existían
-- ============================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='profiles_old') THEN
    INSERT INTO profiles (id, name, role, created_at, updated_at)
    SELECT id, name, role, created_at, updated_at
    FROM profiles_old p_old
    WHERE NOT EXISTS (SELECT 1 FROM profiles p_new WHERE p_new.id = p_old.id);
  END IF;
END
$$;
