-- Drop existing version first (return type may differ)
DROP FUNCTION IF EXISTS admin_reset_password(UUID, TEXT);

-- Creates the admin_reset_password RPC used by Users.tsx
-- Requires pgcrypto extension (enabled by default in Supabase)
-- Only Admin or Manager can call this function

CREATE OR REPLACE FUNCTION admin_reset_password(
  target_user_id UUID,
  new_password    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security check: only Admin/Manager profiles can reset passwords
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('Admin', 'Manager')
  ) THEN
    RAISE EXCEPTION 'Accès refusé : seuls Admin et Manager peuvent réinitialiser les mots de passe';
  END IF;

  -- Validate password length
  IF length(new_password) < 6 THEN
    RAISE EXCEPTION 'Le mot de passe doit contenir au moins 6 caractères';
  END IF;

  -- Update the password hash in Supabase auth
  UPDATE auth.users
  SET
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at         = NOW()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  END IF;
END;
$$;

-- Allow authenticated users to call it (security is enforced inside the function)
GRANT EXECUTE ON FUNCTION admin_reset_password(UUID, TEXT) TO authenticated;
