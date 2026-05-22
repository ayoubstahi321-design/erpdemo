-- ============================================================================
-- FIX: Warehouse + warehouse_companies RLS — clean all duplicate policies
-- ============================================================================
-- Drops ALL existing policies on warehouses and warehouse_companies,
-- then recreates only the correct 4 policies each.
--
-- Date: 2026-02-15
-- ============================================================================

-- Step 1: Drop ALL existing policies on warehouses and warehouse_companies
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
      RAISE NOTICE 'Dropped policy % on %', pol.policyname, tbl;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'All warehouse policies dropped.';
END $$;


-- ============================================================================
-- WAREHOUSES policies
-- ============================================================================

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

CREATE POLICY "warehouses_insert" ON warehouses
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager'))
  );

CREATE POLICY "warehouses_update" ON warehouses
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager'))
  );

CREATE POLICY "warehouses_delete" ON warehouses
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );


-- ============================================================================
-- WAREHOUSE_COMPANIES policies
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

SELECT tablename, COUNT(*) as num_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('warehouses', 'warehouse_companies')
GROUP BY tablename
ORDER BY tablename;
-- Expected: warehouses = 4, warehouse_companies = 4
