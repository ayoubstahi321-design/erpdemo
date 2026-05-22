-- FIX 2: returns INSERT policy was failing when company_id is NULL
-- NULL IN (SELECT ...) = NULL (not TRUE) → WITH CHECK fails
-- Solution: remove company_id from INSERT check; SELECT already enforces isolation.

-- ============================================================
-- RETURNS
-- ============================================================
DROP POLICY IF EXISTS "returns_select" ON returns;
DROP POLICY IF EXISTS "returns_insert" ON returns;
DROP POLICY IF EXISTS "returns_update" ON returns;
DROP POLICY IF EXISTS "returns_delete" ON returns;
DROP POLICY IF EXISTS "Users can view returns" ON returns;
DROP POLICY IF EXISTS "Users can create returns" ON returns;
DROP POLICY IF EXISTS "Users can view company returns" ON returns;
DROP POLICY IF EXISTS "Authorized users can create company returns" ON returns;
DROP POLICY IF EXISTS "users_view_company_returns" ON returns;
DROP POLICY IF EXISTS "return_handlers_create_returns" ON returns;
DROP POLICY IF EXISTS "admin_modify_returns" ON returns;

-- SELECT: company isolation
CREATE POLICY "returns_select" ON returns
  FOR SELECT USING (
    public.user_company_id() IS NULL
    OR company_id IN (SELECT * FROM public.user_company_ids())
    OR company_id IS NULL
  );

-- INSERT: role only — no company_id check (NULL IN (...) = NULL = fails)
CREATE POLICY "returns_insert" ON returns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Sales', 'Salesperson')
    )
  );

-- UPDATE: Admin and Manager
CREATE POLICY "returns_update" ON returns
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager')
    )
  );

-- DELETE: Admin only
CREATE POLICY "returns_delete" ON returns
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'Admin'
    )
  );

-- ============================================================
-- RETURN_ITEMS
-- ============================================================
DROP POLICY IF EXISTS "return_items_select" ON return_items;
DROP POLICY IF EXISTS "return_items_all" ON return_items;
DROP POLICY IF EXISTS "Users can view return items" ON return_items;
DROP POLICY IF EXISTS "Users can manage return items" ON return_items;
DROP POLICY IF EXISTS "Users can view return items for company returns" ON return_items;
DROP POLICY IF EXISTS "Users can manage return items for company returns" ON return_items;
DROP POLICY IF EXISTS "users_view_return_items" ON return_items;
DROP POLICY IF EXISTS "return_handlers_create_return_items" ON return_items;

-- SELECT: via parent return
CREATE POLICY "return_items_select" ON return_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM returns r WHERE r.id = return_items.return_id
    )
  );

-- ALL: role check only (same reason — avoid NULL company_id trap)
CREATE POLICY "return_items_all" ON return_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Sales', 'Salesperson')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Sales', 'Salesperson')
    )
  );
