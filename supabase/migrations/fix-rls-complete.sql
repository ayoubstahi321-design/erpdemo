-- ============================================================================
-- FIX COMPLETO: RLS Multi-Empresa (IDEMPOTENTE)
-- ============================================================================
-- Ejecutar este archivo en Supabase SQL Editor
-- Elimina TODAS las políticas existentes en cada tabla y recrea solo las correctas
--
-- Date: 2026-02-15
-- ============================================================================


-- ============================================================================
-- PASO 1: ELIMINAR TODAS LAS POLÍTICAS EXISTENTES EN TABLAS AFECTADAS
-- Usamos SQL dinámico para eliminar todas sin importar su nombre
-- ============================================================================

DO $$
DECLARE
  pol RECORD;
  tables TEXT[] := ARRAY[
    'customers', 'sales', 'sale_items', 'payments',
    'transfers', 'transfer_items', 'returns', 'return_items',
    'audit_logs', 'document_counters', 'stock_levels'
  ];
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
  RAISE NOTICE 'All old policies dropped.';
END $$;


-- ============================================================================
-- CLIENTES
-- ============================================================================

CREATE POLICY "customers_select" ON customers
  FOR SELECT
  USING (
    public.user_company_id() IS NULL
    OR company_id IN (SELECT * FROM public.user_company_ids())
    OR company_id IS NULL
  );

CREATE POLICY "customers_insert" ON customers
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales'))
    AND (
      public.user_company_id() IS NULL
      OR company_id IN (SELECT * FROM public.user_company_ids())
    )
  );

CREATE POLICY "customers_update" ON customers
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales'))
    AND (
      public.user_company_id() IS NULL
      OR company_id IN (SELECT * FROM public.user_company_ids())
      OR company_id IS NULL
    )
  );

CREATE POLICY "customers_delete" ON customers
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );


-- ============================================================================
-- VENTAS
-- ============================================================================

CREATE POLICY "sales_select" ON sales
  FOR SELECT
  USING (
    public.user_company_id() IS NULL
    OR company_id IN (SELECT * FROM public.user_company_ids())
    OR company_id IS NULL
  );

CREATE POLICY "sales_insert" ON sales
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier'))
    AND (
      public.user_company_id() IS NULL
      OR company_id IN (SELECT * FROM public.user_company_ids())
    )
  );

CREATE POLICY "sales_update" ON sales
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Accountant'))
    AND (
      public.user_company_id() IS NULL
      OR company_id IN (SELECT * FROM public.user_company_ids())
    )
  );

CREATE POLICY "sales_delete" ON sales
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );


-- ============================================================================
-- SALE_ITEMS
-- ============================================================================

CREATE POLICY "sale_items_select" ON sale_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
        AND (
          public.user_company_id() IS NULL
          OR s.company_id IN (SELECT * FROM public.user_company_ids())
          OR s.company_id IS NULL
        )
    )
  );

CREATE POLICY "sale_items_all" ON sale_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      INNER JOIN profiles p ON p.id = auth.uid()
      WHERE s.id = sale_items.sale_id
        AND p.role IN ('Admin', 'Manager', 'Sales', 'Cashier')
        AND (
          public.user_company_id() IS NULL
          OR s.company_id IN (SELECT * FROM public.user_company_ids())
          OR s.company_id IS NULL
        )
    )
  );


-- ============================================================================
-- PAGOS
-- ============================================================================

CREATE POLICY "payments_select" ON payments
  FOR SELECT
  USING (
    public.user_company_id() IS NULL
    OR company_id IN (SELECT * FROM public.user_company_ids())
    OR company_id IS NULL
  );

CREATE POLICY "payments_insert" ON payments
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Accountant', 'Cashier', 'Sales'))
    AND (
      public.user_company_id() IS NULL
      OR company_id IN (SELECT * FROM public.user_company_ids())
    )
  );

CREATE POLICY "payments_update" ON payments
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Accountant'))
    AND (
      public.user_company_id() IS NULL
      OR company_id IN (SELECT * FROM public.user_company_ids())
    )
  );

CREATE POLICY "payments_delete" ON payments
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );


-- ============================================================================
-- TRANSFERENCIAS
-- ============================================================================

CREATE POLICY "transfers_select" ON transfers
  FOR SELECT
  USING (
    public.user_company_id() IS NULL
    OR company_id IN (SELECT * FROM public.user_company_ids())
    OR company_id IS NULL
  );

CREATE POLICY "transfers_insert" ON transfers
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager'))
    AND (
      public.user_company_id() IS NULL
      OR company_id IN (SELECT * FROM public.user_company_ids())
    )
  );

CREATE POLICY "transfers_update" ON transfers
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager'))
    AND (
      public.user_company_id() IS NULL
      OR company_id IN (SELECT * FROM public.user_company_ids())
    )
  );

CREATE POLICY "transfers_delete" ON transfers
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );


-- ============================================================================
-- TRANSFER_ITEMS
-- ============================================================================

CREATE POLICY "transfer_items_select" ON transfer_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transfers t
      WHERE t.id = transfer_items.transfer_id
        AND (
          public.user_company_id() IS NULL
          OR t.company_id IN (SELECT * FROM public.user_company_ids())
          OR t.company_id IS NULL
        )
    )
  );

CREATE POLICY "transfer_items_all" ON transfer_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM transfers t
      INNER JOIN profiles p ON p.id = auth.uid()
      WHERE t.id = transfer_items.transfer_id
        AND p.role IN ('Admin', 'Manager')
        AND (
          public.user_company_id() IS NULL
          OR t.company_id IN (SELECT * FROM public.user_company_ids())
          OR t.company_id IS NULL
        )
    )
  );


-- ============================================================================
-- DEVOLUCIONES
-- ============================================================================

CREATE POLICY "returns_select" ON returns
  FOR SELECT
  USING (
    public.user_company_id() IS NULL
    OR company_id IN (SELECT * FROM public.user_company_ids())
    OR company_id IS NULL
  );

CREATE POLICY "returns_insert" ON returns
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales'))
    AND (
      public.user_company_id() IS NULL
      OR company_id IN (SELECT * FROM public.user_company_ids())
    )
  );

CREATE POLICY "returns_update" ON returns
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager'))
    AND (
      public.user_company_id() IS NULL
      OR company_id IN (SELECT * FROM public.user_company_ids())
    )
  );

CREATE POLICY "returns_delete" ON returns
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );


-- ============================================================================
-- RETURN_ITEMS
-- ============================================================================

CREATE POLICY "return_items_select" ON return_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM returns r
      WHERE r.id = return_items.return_id
        AND (
          public.user_company_id() IS NULL
          OR r.company_id IN (SELECT * FROM public.user_company_ids())
          OR r.company_id IS NULL
        )
    )
  );

CREATE POLICY "return_items_all" ON return_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM returns r
      INNER JOIN profiles p ON p.id = auth.uid()
      WHERE r.id = return_items.return_id
        AND p.role IN ('Admin', 'Manager', 'Sales')
        AND (
          public.user_company_id() IS NULL
          OR r.company_id IN (SELECT * FROM public.user_company_ids())
          OR r.company_id IS NULL
        )
    )
  );


-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT
  USING (
    public.user_company_id() IS NULL
    OR company_id IN (SELECT * FROM public.user_company_ids())
    OR company_id IS NULL
  );

CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.user_company_id() IS NULL
      OR company_id IN (SELECT * FROM public.user_company_ids())
    )
  );


-- ============================================================================
-- DOCUMENT COUNTERS
-- ============================================================================

CREATE POLICY "document_counters_select" ON document_counters
  FOR SELECT
  USING (
    public.user_company_id() IS NULL
    OR company_id IN (SELECT * FROM public.user_company_ids())
    OR company_id IS NULL
  );

CREATE POLICY "document_counters_all" ON document_counters
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier'))
    AND (
      public.user_company_id() IS NULL
      OR company_id IN (SELECT * FROM public.user_company_ids())
    )
  );


-- ============================================================================
-- STOCK LEVELS
-- ============================================================================

CREATE POLICY "stock_levels_select" ON stock_levels
  FOR SELECT
  USING (
    public.user_company_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM warehouse_companies wc
      WHERE wc.warehouse_id = stock_levels.warehouse_id
        AND wc.company_id IN (SELECT * FROM public.user_company_ids())
    )
    OR NOT EXISTS (
      SELECT 1 FROM warehouse_companies wc
      WHERE wc.warehouse_id = stock_levels.warehouse_id
    )
  );

CREATE POLICY "stock_levels_all" ON stock_levels
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier', 'Warehouse'))
    AND (
      public.user_company_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM warehouse_companies wc
        WHERE wc.warehouse_id = stock_levels.warehouse_id
          AND wc.company_id IN (SELECT * FROM public.user_company_ids())
      )
      OR NOT EXISTS (
        SELECT 1 FROM warehouse_companies wc
        WHERE wc.warehouse_id = stock_levels.warehouse_id
      )
    )
  );


-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

SELECT tablename, COUNT(*) as num_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'customers','sales','sale_items','payments',
    'transfers','transfer_items','returns','return_items',
    'audit_logs','document_counters','stock_levels'
  )
GROUP BY tablename
ORDER BY tablename;
