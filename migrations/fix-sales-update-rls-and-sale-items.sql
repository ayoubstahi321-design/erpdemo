-- FIX: Manager can't update sale after return + sale_items empty in nested join
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. Simplify sales_update policy — remove company_id check
--    (company isolation is already enforced by SELECT policy)
-- ============================================================
DROP POLICY IF EXISTS "sales_update" ON sales;

CREATE POLICY "sales_update" ON sales
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Accountant', 'Salesperson', 'Sales', 'Cashier')
    )
  );

-- ============================================================
-- 2. Fix sale_items SELECT — correlated subquery breaks nested joins
--    (this is the same fix as fix-sale-items-rls-nested-join.sql)
-- ============================================================
DROP POLICY IF EXISTS "sale_items_select" ON sale_items;
DROP POLICY IF EXISTS "Authenticated users can view sale items" ON sale_items;
DROP POLICY IF EXISTS "Allow authenticated access" ON sale_items;
DROP POLICY IF EXISTS "Authorized users can manage sale items" ON sale_items;
DROP POLICY IF EXISTS "sale_items_insert" ON sale_items;
DROP POLICY IF EXISTS "sale_items_update" ON sale_items;
DROP POLICY IF EXISTS "sale_items_delete" ON sale_items;
DROP POLICY IF EXISTS "sale_items_write" ON sale_items;

-- SELECT: any authenticated user
CREATE POLICY "sale_items_select" ON sale_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- WRITE: only roles that can manage sales
CREATE POLICY "sale_items_write" ON sale_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Salesperson', 'Sales', 'Cashier')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Salesperson', 'Sales', 'Cashier')
    )
  );
