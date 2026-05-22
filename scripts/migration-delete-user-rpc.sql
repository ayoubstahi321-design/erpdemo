-- ============================================
-- Migration: Admin Delete User RPC
-- Run this in Supabase SQL Editor
-- ============================================

-- RPC function to delete a user (profile + auth)
-- Uses SECURITY DEFINER to run with elevated privileges
-- Only admins can call this function
CREATE OR REPLACE FUNCTION delete_user_by_admin(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is an Admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'Admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Delete profile first (may have FK constraints)
  DELETE FROM profiles WHERE id = target_user_id;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Grant execute to authenticated users (RLS in function body handles authorization)
GRANT EXECUTE ON FUNCTION delete_user_by_admin(UUID) TO authenticated;

-- Also ensure profiles table allows admin updates
-- (Admin should be able to update any profile in their company)
DO $$
BEGIN
  -- Drop existing update policy if it exists, then recreate
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update any profile' AND tablename = 'profiles'
  ) THEN
    DROP POLICY "Admins can update any profile" ON profiles;
  END IF;
END
$$;

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin'
    )
  );
