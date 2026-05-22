-- ============================================================================
-- COMPLETE FIX: Warehouses not loading (0 entrepôts)
-- ============================================================================
-- Root cause: warehouse_companies empty + possible stale RLS policies
-- This script fixes everything in one shot:
--   1. Recreates user_company_id() and user_company_ids() functions
--   2. Populates warehouse_companies with all warehouses → default company
--   3. Ensures all users have user_companies entries
--   4. Drops and recreates ALL warehouse + warehouse_companies RLS policies
-- ============================================================================
-- Date: 2026-02-26
-- ============================================================================

-- ============================================================================
-- STEP 1: Recreate helper functions (idempotent)
-- ============================================================================

-- user_company_ids(): Returns ALL company IDs for current user
CREATE OR REPLACE FUNCTION public.user_company_ids()
RETURNS TABLE(company_id TEXT) AS $$
  SELECT uc.company_id
  FROM public.user_companies uc
  WHERE uc.user_id = auth.uid()
  UNION
  SELECT p.company_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.company_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_companies uc2 WHERE uc2.user_id = auth.uid()
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- user_company_id(): Returns single company_id, NULL for Admin
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS TEXT AS $$
  SELECT CASE
    WHEN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin'
      THEN NULL
    ELSE COALESCE(
      (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid() LIMIT 1),
      (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid() AND p.company_id IS NOT NULL),
      '00000000-0000-0000-0000-000000000000'
    )
  END;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;


-- ============================================================================
-- STEP 2: Ensure default company exists
-- ============================================================================
INSERT INTO public.companies (id, name, full_name, default_tax_rate)
VALUES ('azmol-default', 'Azmol Capo', 'Azmol Petrochemicals', 0.20)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- STEP 3: Assign ALL users to default company (if not already assigned)
-- ============================================================================
INSERT INTO public.user_companies (user_id, company_id)
SELECT p.id, 'azmol-default'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_companies uc WHERE uc.user_id = p.id
)
ON CONFLICT (user_id, company_id) DO NOTHING;


-- ============================================================================
-- STEP 4: Assign ALL warehouses to default company (if not already assigned)
-- ============================================================================
INSERT INTO public.warehouse_companies (warehouse_id, company_id)
SELECT w.id, 'azmol-default'
FROM public.warehouses w
WHERE NOT EXISTS (
  SELECT 1 FROM public.warehouse_companies wc WHERE wc.warehouse_id = w.id
)
ON CONFLICT (warehouse_id, company_id) DO NOTHING;


-- ============================================================================
-- STEP 5: Drop ALL existing policies on warehouses and warehouse_companies
-- ============================================================================
DO $$
DECLARE
  pol RECORD;
  tables TEXT[] := ARRAY['warehouses', 'warehouse_companies'];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
      RAISE NOTICE 'Dropped policy: % on %', pol.policyname, tbl;
    END LOOP;
  END LOOP;
END $$;


-- ============================================================================
-- STEP 6: Enable RLS (idempotent)
-- ============================================================================
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_companies ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- STEP 7: Create clean warehouse policies
-- ============================================================================

-- SELECT: Admin sees all, others see company warehouses + legacy unassigned
CREATE POLICY "warehouses_select" ON warehouses
  FOR SELECT
  USING (
    -- Admin sees all warehouses
    public.user_company_id() IS NULL
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

-- INSERT: Admin/Manager can create
CREATE POLICY "warehouses_insert" ON warehouses
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager'))
  );

-- UPDATE: Admin/Manager can update
CREATE POLICY "warehouses_update" ON warehouses
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager'))
  );

-- DELETE: Only Admin can delete
CREATE POLICY "warehouses_delete" ON warehouses
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );


-- ============================================================================
-- STEP 8: Create clean warehouse_companies policies
-- ============================================================================

CREATE POLICY "warehouse_companies_select" ON warehouse_companies
  FOR SELECT
  USING (
    public.user_company_id() IS NULL
    OR
    company_id IN (SELECT * FROM public.user_company_ids())
  );

CREATE POLICY "warehouse_companies_insert" ON warehouse_companies
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager'))
  );

CREATE POLICY "warehouse_companies_update" ON warehouse_companies
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager'))
  );

CREATE POLICY "warehouse_companies_delete" ON warehouse_companies
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );


-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  wh_count INTEGER;
  wc_count INTEGER;
  uc_count INTEGER;
  pol_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO wh_count FROM warehouses;
  SELECT COUNT(*) INTO wc_count FROM warehouse_companies;
  SELECT COUNT(*) INTO uc_count FROM user_companies;
  SELECT COUNT(*) INTO pol_count FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('warehouses', 'warehouse_companies');

  RAISE NOTICE '============================================';
  RAISE NOTICE 'Warehouse Visibility Fix Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Warehouses: %', wh_count;
  RAISE NOTICE 'Warehouse-Company links: %', wc_count;
  RAISE NOTICE 'User-Company links: %', uc_count;
  RAISE NOTICE 'RLS policies (warehouses + warehouse_companies): %', pol_count;
  RAISE NOTICE '============================================';
END $$;
