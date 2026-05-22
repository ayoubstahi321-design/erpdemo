-- Migration: Add Row Level Security (RLS) Policies for Multi-Tenant Isolation
-- Description: Enforce company-level data isolation at database level
-- Date: 2026-01-30
--
-- Security Model:
--   - Admin users (company_id = NULL): Full access to all companies
--   - Regular users: Access only to their assigned company's data
--   - Products & Customers: Shared globally (no company filtering)
--   - Warehouses: Filtered via warehouse_companies junction table
--   - Sales/Payments/Transfers/Returns: Strict company isolation

-- ====================================================================================
-- HELPER FUNCTION: Get Current User's Company ID
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS TEXT AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_company_id() IS 'Returns the company_id of the currently authenticated user. NULL if user is Admin with cross-company access.';

-- ====================================================================================
-- WAREHOUSES: Filter via Junction Table (N:M Relationship)
-- ====================================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view warehouses" ON warehouses;
DROP POLICY IF EXISTS "Admins can manage warehouses" ON warehouses;
DROP POLICY IF EXISTS "Users can manage warehouses based on role" ON warehouses;

-- SELECT: Users see warehouses assigned to their company (via junction table)
CREATE POLICY "Users can view company warehouses" ON warehouses
  FOR SELECT
  USING (
    -- Admin (company_id IS NULL) sees all warehouses
    public.user_company_id() IS NULL
    OR
    -- Regular users see warehouses assigned to their company
    EXISTS (
      SELECT 1 FROM warehouse_companies wc
      WHERE wc.warehouse_id = warehouses.id
        AND wc.company_id = public.user_company_id()
    )
    OR
    -- Also show warehouses without company assignment (legacy/shared)
    NOT EXISTS (
      SELECT 1 FROM warehouse_companies wc
      WHERE wc.warehouse_id = warehouses.id
    )
  );

-- INSERT: Only Admin/Manager can create warehouses
CREATE POLICY "Authorized users can create warehouses" ON warehouses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager')
    )
  );

-- UPDATE: Admin/Manager can update warehouses
CREATE POLICY "Authorized users can update warehouses" ON warehouses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager')
    )
  );

-- DELETE: Only Admins can delete warehouses
CREATE POLICY "Admins can delete warehouses" ON warehouses
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'Admin'
    )
  );

-- ====================================================================================
-- WAREHOUSE_COMPANIES: Junction Table Access
-- ====================================================================================

-- Enable RLS
ALTER TABLE warehouse_companies ENABLE ROW LEVEL SECURITY;

-- SELECT: Users see assignments for their company
CREATE POLICY "Users can view company warehouse assignments" ON warehouse_companies
  FOR SELECT
  USING (
    public.user_company_id() IS NULL  -- Admin sees all
    OR company_id = public.user_company_id()
  );

-- INSERT: Only Admin/Manager can assign warehouses to companies
CREATE POLICY "Authorized users can assign warehouses to companies" ON warehouse_companies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager')
    )
    AND (
      public.user_company_id() IS NULL  -- Admin can assign to any company
      OR company_id = public.user_company_id()  -- Manager can assign to own company
    )
  );

-- DELETE: Only Admin/Manager can remove assignments
CREATE POLICY "Authorized users can remove warehouse assignments" ON warehouse_companies
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager')
    )
    AND (
      public.user_company_id() IS NULL
      OR company_id = public.user_company_id()
    )
  );

-- ====================================================================================
-- PRODUCTS: Globally Shared (No Company Filtering)
-- ====================================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
DROP POLICY IF EXISTS "Authorized users can manage products" ON products;

-- All authenticated users see ALL products (shared resource)
CREATE POLICY "Authenticated users can view all products" ON products
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only Admin/Manager can create products
CREATE POLICY "Authorized users can create products" ON products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager')
    )
  );

-- Only Admin/Manager can update products
CREATE POLICY "Authorized users can update products" ON products
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager')
    )
  );

-- Only Admin can delete products
CREATE POLICY "Admins can delete products" ON products
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'Admin'
    )
  );

-- ====================================================================================
-- CUSTOMERS: Globally Shared (No Company Filtering)
-- ====================================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
DROP POLICY IF EXISTS "Users can manage customers" ON customers;

-- All authenticated users see ALL customers (shared resource)
CREATE POLICY "Authenticated users can view all customers" ON customers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Sales-related roles can create customers
CREATE POLICY "Authorized users can create customers" ON customers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Sales', 'Cashier')
    )
  );

-- Sales-related roles can update customers
CREATE POLICY "Authorized users can update customers" ON customers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Sales', 'Accountant')
    )
  );

-- Only Admin can delete customers
CREATE POLICY "Admins can delete customers" ON customers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'Admin'
    )
  );

-- ====================================================================================
-- SALES: Strict Company Isolation
-- ====================================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view sales based on role" ON sales;
DROP POLICY IF EXISTS "Users can create sales with proper permissions" ON sales;
DROP POLICY IF EXISTS "Users can modify sales with proper permissions" ON sales;

-- SELECT: Users see only their company's sales
CREATE POLICY "Users can view company sales" ON sales
  FOR SELECT
  USING (
    public.user_company_id() IS NULL  -- Admin sees all
    OR company_id = public.user_company_id()
  );

-- INSERT: Sales must belong to user's company
CREATE POLICY "Users can create company sales" ON sales
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Sales', 'Cashier')
    )
    AND (
      public.user_company_id() IS NULL  -- Admin can create for any company
      OR company_id = public.user_company_id()  -- Users create for own company
    )
  );

-- UPDATE: Only Admin/Manager/Accountant can update sales in their company
CREATE POLICY "Authorized users can update company sales" ON sales
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Accountant')
    )
    AND (
      public.user_company_id() IS NULL
      OR company_id = public.user_company_id()
    )
  );

-- DELETE: Only Admin can delete sales (rare operation)
CREATE POLICY "Admins can delete company sales" ON sales
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'Admin'
    )
    AND (
      public.user_company_id() IS NULL
      OR company_id = public.user_company_id()
    )
  );

-- ====================================================================================
-- SALE_ITEMS: Inherit Access from Parent Sale
-- ====================================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view sale_items" ON sale_items;
DROP POLICY IF EXISTS "Users can manage sale_items" ON sale_items;

-- SELECT: Filter through parent sale's company_id
CREATE POLICY "Users can view sale items for company sales" ON sale_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
        AND (
          public.user_company_id() IS NULL
          OR s.company_id = public.user_company_id()
        )
    )
  );

-- INSERT/UPDATE/DELETE: Inherit permissions from parent sale
CREATE POLICY "Users can manage sale items for company sales" ON sale_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      INNER JOIN profiles p ON p.id = auth.uid()
      WHERE s.id = sale_items.sale_id
        AND p.role IN ('Admin', 'Manager', 'Sales', 'Cashier')
        AND (
          public.user_company_id() IS NULL
          OR s.company_id = public.user_company_id()
        )
    )
  );

-- ====================================================================================
-- PAYMENTS: Strict Company Isolation (Inherit from Sale)
-- ====================================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view payments" ON payments;
DROP POLICY IF EXISTS "Users can create payments" ON payments;
DROP POLICY IF EXISTS "Users can update payments" ON payments;

-- SELECT: Users see only their company's payments
CREATE POLICY "Users can view company payments" ON payments
  FOR SELECT
  USING (
    public.user_company_id() IS NULL
    OR company_id = public.user_company_id()
  );

-- INSERT: Payments must belong to user's company
CREATE POLICY "Users can create company payments" ON payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Accountant', 'Cashier', 'Sales')
    )
    AND (
      public.user_company_id() IS NULL
      OR company_id = public.user_company_id()
    )
  );

-- UPDATE: Admin/Manager/Accountant can update payments
CREATE POLICY "Authorized users can update company payments" ON payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Accountant')
    )
    AND (
      public.user_company_id() IS NULL
      OR company_id = public.user_company_id()
    )
  );

-- ====================================================================================
-- TRANSFERS: Company Isolation
-- ====================================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view transfers based on role" ON transfers;
DROP POLICY IF EXISTS "Users can create transfers" ON transfers;
DROP POLICY IF EXISTS "Users can update transfers" ON transfers;

-- SELECT: Users see only their company's transfers
CREATE POLICY "Users can view company transfers" ON transfers
  FOR SELECT
  USING (
    public.user_company_id() IS NULL
    OR company_id = public.user_company_id()
  );

-- INSERT: Only Admin/Manager can create transfers
CREATE POLICY "Authorized users can create company transfers" ON transfers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager')
    )
    AND (
      public.user_company_id() IS NULL
      OR company_id = public.user_company_id()
    )
  );

-- UPDATE: Only Admin/Manager can update transfers
CREATE POLICY "Authorized users can update company transfers" ON transfers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager')
    )
    AND (
      public.user_company_id() IS NULL
      OR company_id = public.user_company_id()
    )
  );

-- ====================================================================================
-- TRANSFER_ITEMS: Inherit Access from Parent Transfer
-- ====================================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view transfer items for their company" ON transfer_items;
DROP POLICY IF EXISTS "Users can manage transfer items for their company" ON transfer_items;

-- SELECT: Filter through parent transfer's company_id
CREATE POLICY "Users can view transfer items for company transfers" ON transfer_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transfers t
      WHERE t.id = transfer_items.transfer_id
        AND (
          public.user_company_id() IS NULL
          OR t.company_id = public.user_company_id()
        )
    )
  );

-- INSERT/UPDATE/DELETE: Inherit permissions from parent transfer
CREATE POLICY "Users can manage transfer items for company transfers" ON transfer_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM transfers t
      INNER JOIN profiles p ON p.id = auth.uid()
      WHERE t.id = transfer_items.transfer_id
        AND p.role IN ('Admin', 'Manager')
        AND (
          public.user_company_id() IS NULL
          OR t.company_id = public.user_company_id()
        )
    )
  );

-- ====================================================================================
-- RETURNS: Company Isolation (Inherit from Original Sale)
-- ====================================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view returns" ON returns;
DROP POLICY IF EXISTS "Users can create returns" ON returns;

-- SELECT: Users see only their company's returns
CREATE POLICY "Users can view company returns" ON returns
  FOR SELECT
  USING (
    public.user_company_id() IS NULL
    OR company_id = public.user_company_id()
  );

-- INSERT: Only authorized roles can create returns
CREATE POLICY "Authorized users can create company returns" ON returns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Sales')
    )
    AND (
      public.user_company_id() IS NULL
      OR company_id = public.user_company_id()
    )
  );

-- ====================================================================================
-- RETURN_ITEMS: Inherit Access from Parent Return
-- ====================================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view return items" ON return_items;
DROP POLICY IF EXISTS "Users can manage return items" ON return_items;

-- SELECT: Filter through parent return's company_id
CREATE POLICY "Users can view return items for company returns" ON return_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM returns r
      WHERE r.id = return_items.return_id
        AND (
          public.user_company_id() IS NULL
          OR r.company_id = public.user_company_id()
        )
    )
  );

-- INSERT/UPDATE/DELETE: Inherit permissions from parent return
CREATE POLICY "Users can manage return items for company returns" ON return_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM returns r
      INNER JOIN profiles p ON p.id = auth.uid()
      WHERE r.id = return_items.return_id
        AND p.role IN ('Admin', 'Manager', 'Sales')
        AND (
          public.user_company_id() IS NULL
          OR r.company_id = public.user_company_id()
        )
    )
  );

-- ====================================================================================
-- AUDIT_LOGS: Company Filtering (Optional for Compliance)
-- ====================================================================================

-- Enable RLS if not already enabled
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view audit logs" ON audit_logs;

-- SELECT: Users see only their company's audit logs
CREATE POLICY "Users can view company audit logs" ON audit_logs
  FOR SELECT
  USING (
    public.user_company_id() IS NULL  -- Admin sees all
    OR company_id = public.user_company_id()
    OR company_id IS NULL  -- System-wide events visible to all
  );

-- INSERT: System can create audit logs for any company
CREATE POLICY "System can create audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- ====================================================================================
-- DOCUMENT_COUNTERS: Company-Specific Sequences
-- ====================================================================================

-- Enable RLS if not already enabled
ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;

-- SELECT: Users see only their company's counters
CREATE POLICY "Users can view company document counters" ON document_counters
  FOR SELECT
  USING (
    public.user_company_id() IS NULL
    OR company_id = public.user_company_id()
  );

-- INSERT/UPDATE: System manages counters (via RPC functions)
CREATE POLICY "System can manage document counters" ON document_counters
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- ====================================================================================
-- STOCK_LEVELS: No Company Filter (Filtered via Products Relationship)
-- ====================================================================================

-- Stock levels don't need company_id column because they're filtered through:
-- stock_levels → product_id → products (shared) → warehouses (filtered via junction table)

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view stock" ON stock_levels;
DROP POLICY IF EXISTS "Authorized users can manage stock" ON stock_levels;

-- SELECT: Users see stock for products in their company's warehouses
CREATE POLICY "Users can view stock for company warehouses" ON stock_levels
  FOR SELECT
  USING (
    public.user_company_id() IS NULL  -- Admin sees all stock
    OR
    -- User sees stock if warehouse is assigned to their company
    EXISTS (
      SELECT 1 FROM warehouse_companies wc
      WHERE wc.warehouse_id = stock_levels.warehouse_id
        AND wc.company_id = public.user_company_id()
    )
    OR
    -- Also show stock for warehouses without company assignment
    NOT EXISTS (
      SELECT 1 FROM warehouse_companies wc
      WHERE wc.warehouse_id = stock_levels.warehouse_id
    )
  );

-- INSERT/UPDATE/DELETE: Authorized users can manage stock
CREATE POLICY "Authorized users can manage stock" ON stock_levels
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Sales', 'Cashier', 'Warehouse')
    )
    AND (
      public.user_company_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM warehouse_companies wc
        WHERE wc.warehouse_id = stock_levels.warehouse_id
          AND wc.company_id = public.user_company_id()
      )
      OR NOT EXISTS (
        SELECT 1 FROM warehouse_companies wc
        WHERE wc.warehouse_id = stock_levels.warehouse_id
      )
    )
  );

-- ====================================================================================
-- VERIFICATION QUERIES (Comment out after migration)
-- ====================================================================================

-- Verify helper function created
-- SELECT public.user_company_id();

-- List all RLS policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Test policies as different user types (requires setting auth context)
-- SET request.jwt.claim.sub TO 'user-id-here';
-- SELECT * FROM warehouses;
-- SELECT * FROM sales;

-- ====================================================================================
-- NOTES
-- ====================================================================================

-- 1. All tables now have RLS policies enforcing company isolation
-- 2. Products and Customers are intentionally shared (no company filtering)
-- 3. Warehouses use N:M relationship via warehouse_companies junction table
-- 4. Sales, Payments, Transfers, Returns have strict company_id filtering
-- 5. Detail tables (sale_items, transfer_items, return_items) inherit from parents
-- 6. Stock levels filtered through warehouse assignments
-- 7. Admin users (company_id = NULL) have cross-company access
-- 8. Document counters enforce per-company sequential numbering
-- 9. Next step: Update application code to include company_id in all operations

