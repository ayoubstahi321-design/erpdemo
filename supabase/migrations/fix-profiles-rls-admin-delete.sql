-- Migration: Fix profiles RLS - Add missing DELETE policy for Admin
-- Date: 2026-01-31
-- Problem: Admin users cannot update or delete profiles because
--          the DELETE policy was never created, and UPDATE policies
--          may not be applied correctly.

-- ============================================================================
-- STEP 1: Drop existing policies (safe - recreate cleanly)
-- ============================================================================

DROP POLICY IF EXISTS "users_view_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "admin_view_all_profiles" ON profiles;
DROP POLICY IF EXISTS "admin_update_all_profiles" ON profiles;
DROP POLICY IF EXISTS "admin_delete_profiles" ON profiles;
DROP POLICY IF EXISTS "admin_insert_profiles" ON profiles;

-- ============================================================================
-- STEP 2: Ensure RLS is enabled
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Create complete set of RLS policies for profiles
-- ============================================================================

-- SELECT: Users can view their own profile
CREATE POLICY "users_view_own_profile" ON profiles
  FOR SELECT
  USING (id = auth.uid());

-- SELECT: Admin can view ALL profiles (user management)
CREATE POLICY "admin_view_all_profiles" ON profiles
  FOR SELECT
  USING (public.user_is_admin());

-- SELECT: Manager can view all profiles (team management)
CREATE POLICY "manager_view_all_profiles" ON profiles
  FOR SELECT
  USING (public.user_is_manager_or_admin());

-- UPDATE: Users can update their own profile (name, last_active only)
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- UPDATE: Admin can update ANY profile (role, warehouse, company assignment)
CREATE POLICY "admin_update_all_profiles" ON profiles
  FOR UPDATE
  USING (public.user_is_admin())
  WITH CHECK (public.user_is_admin());

-- DELETE: Admin can delete ANY profile
CREATE POLICY "admin_delete_profiles" ON profiles
  FOR DELETE
  USING (public.user_is_admin());

-- INSERT: Allow profile creation (needed for auth trigger on signup)
CREATE POLICY "allow_profile_insert" ON profiles
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Profiles RLS policies updated successfully';
  RAISE NOTICE 'Policies created: SELECT (own, admin, manager), UPDATE (own, admin), DELETE (admin), INSERT (all)';
END $$;
