-- ============================================================================
-- FIX: Update user_company_id() to support N:M user_companies junction table
-- ============================================================================
-- Problem: user_company_id() only read from profiles.company_id (old single-company)
-- New system: users can have multiple companies via user_companies junction table
-- users created after migration may have NULL profiles.company_id
--
-- Date: 2026-02-15
-- ============================================================================

-- Step 1: Create user_company_ids() returning ALL company IDs for current user
-- Used by RLS policies that need to check any of the user's companies

CREATE OR REPLACE FUNCTION public.user_company_ids()
RETURNS TABLE(company_id TEXT) AS $$
  -- From new user_companies junction table (primary source)
  SELECT uc.company_id
  FROM public.user_companies uc
  WHERE uc.user_id = auth.uid()
  UNION
  -- Fallback: old profiles.company_id (backward compatibility for users not yet migrated)
  SELECT p.company_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.company_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_companies uc2 WHERE uc2.user_id = auth.uid()
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_company_ids() IS
  'Returns all company IDs for the current user. Checks user_companies junction table first, falls back to profiles.company_id for legacy users.';

-- Step 2: Update user_company_id() to also check user_companies
-- This maintains backward compatibility with existing RLS policies

CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS TEXT AS $$
  SELECT CASE
    -- Admin role: NULL means unrestricted access to all data
    WHEN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin'
      THEN NULL

    -- Non-admin: return their company (user_companies first, then profiles.company_id as fallback)
    ELSE COALESCE(
      (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid() LIMIT 1),
      (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid() AND p.company_id IS NOT NULL),
      -- Sentinel: non-admin with no company assigned - block all data access
      '00000000-0000-0000-0000-000000000000'
    )
  END;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_company_id() IS
  'Returns company_id for current user. NULL only for Admin role (unrestricted). Non-admins without company get sentinel UUID (no access). Checks user_companies then profiles.company_id.';

-- Step 3: Update warehouse SELECT policy to support multi-company managers
-- A manager with companies [A, B] should see warehouses assigned to A OR B

DROP POLICY IF EXISTS "Users can view company warehouses" ON warehouses;

CREATE POLICY "Users can view company warehouses" ON warehouses
  FOR SELECT
  USING (
    -- Admin (no company assignments anywhere) sees all warehouses
    NOT EXISTS (
      SELECT 1 FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
    AND (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()) IS NULL
    OR
    -- Warehouses assigned to any of user's companies
    EXISTS (
      SELECT 1 FROM warehouse_companies wc
      WHERE wc.warehouse_id = warehouses.id
        AND wc.company_id IN (SELECT * FROM public.user_company_ids())
    )
    OR
    -- Legacy: warehouses not assigned to any company (visible to all)
    NOT EXISTS (
      SELECT 1 FROM warehouse_companies wc
      WHERE wc.warehouse_id = warehouses.id
    )
  );

-- Step 4: Update warehouse_companies SELECT policy to support multi-company
DROP POLICY IF EXISTS "Users can view company warehouse assignments" ON warehouse_companies;

CREATE POLICY "Users can view company warehouse assignments" ON warehouse_companies
  FOR SELECT
  USING (
    -- Admin sees all
    NOT EXISTS (SELECT 1 FROM public.user_companies uc WHERE uc.user_id = auth.uid())
    AND (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()) IS NULL
    OR
    -- Users see assignments for their companies
    company_id IN (SELECT * FROM public.user_company_ids())
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'RLS Fix Migration Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '1. Created user_company_ids() function (returns all company IDs)';
  RAISE NOTICE '2. Updated user_company_id() to check user_companies first';
  RAISE NOTICE '3. Updated warehouse SELECT policy for multi-company support';
  RAISE NOTICE '4. Updated warehouse_companies SELECT policy';
  RAISE NOTICE '============================================';
END $$;
