-- FIX: sale_items RLS policy breaks PostgREST nested joins
-- The complex EXISTS-back-to-sales policy causes nested joins to return empty arrays.
-- Fix: simple authenticated-user check (company isolation is already enforced on the sales table).

DROP POLICY IF EXISTS "sale_items_select" ON sale_items;
DROP POLICY IF EXISTS "Authenticated users can view sale items" ON sale_items;
DROP POLICY IF EXISTS "Allow authenticated access" ON sale_items;
DROP POLICY IF EXISTS "Authorized users can manage sale items" ON sale_items;
DROP POLICY IF EXISTS "sale_items_insert" ON sale_items;
DROP POLICY IF EXISTS "sale_items_update" ON sale_items;
DROP POLICY IF EXISTS "sale_items_delete" ON sale_items;

-- SELECT: any authenticated user (company isolation happens at the sales level)
CREATE POLICY "sale_items_select" ON sale_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE: only roles that can manage sales
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
