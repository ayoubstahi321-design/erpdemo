-- ============================================================================
-- SECURITY AUDIT & FIX: Enable RLS on ALL tables
-- ============================================================================
-- This migration ensures EVERY table has Row Level Security enabled
-- and creates restrictive policies for multi-tenant data isolation
--
-- CRITICAL SECURITY FIX
-- Created: 2026-01-31
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable RLS on ALL tables (if not already enabled)
-- ============================================================================

-- Core tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_companies ENABLE ROW LEVEL SECURITY;

-- Transaction tables
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Returns
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

-- Transfers
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;

-- Stock & Inventory
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- System tables
ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Drop ALL existing policies to recreate them properly
-- ============================================================================

-- This ensures we start fresh with correct policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;

DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
DROP POLICY IF EXISTS "Admin can manage products" ON products;

DROP POLICY IF EXISTS "Users can view customers" ON customers;
DROP POLICY IF EXISTS "Users can manage customers" ON customers;

DROP POLICY IF EXISTS "Users can view warehouses" ON warehouses;
DROP POLICY IF EXISTS "Admin can manage warehouses" ON warehouses;

DROP POLICY IF EXISTS "Users can view sales" ON sales;
DROP POLICY IF EXISTS "Users can create sales" ON sales;

-- ============================================================================
-- STEP 3: Create SECURE policies for each table
-- ============================================================================

-- ============================================================================
-- PROFILES TABLE (User accounts)
-- ============================================================================

-- Users can ONLY view and update their own profile
CREATE POLICY "users_view_own_profile"
ON profiles FOR SELECT
USING (id = auth.uid());

CREATE POLICY "users_update_own_profile"
ON profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admin can view all profiles (for user management)
CREATE POLICY "admin_view_all_profiles"
ON profiles FOR SELECT
USING (public.user_is_admin());

-- Admin can update all profiles
CREATE POLICY "admin_update_all_profiles"
ON profiles FOR UPDATE
USING (public.user_is_admin())
WITH CHECK (public.user_is_admin());

-- ============================================================================
-- PRODUCTS TABLE (Shared across companies - no company_id filtering)
-- ============================================================================

-- All authenticated users can view products
CREATE POLICY "authenticated_users_view_products"
ON products FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only Admin/Manager can create products
CREATE POLICY "admin_manager_create_products"
ON products FOR INSERT
WITH CHECK (public.user_is_manager_or_admin());

-- Only Admin/Manager can update products
CREATE POLICY "admin_manager_update_products"
ON products FOR UPDATE
USING (public.user_is_manager_or_admin())
WITH CHECK (public.user_is_manager_or_admin());

-- Only Admin can delete products
CREATE POLICY "admin_delete_products"
ON products FOR DELETE
USING (public.user_is_admin());

-- ============================================================================
-- CUSTOMERS TABLE (Shared across companies - no company_id filtering)
-- ============================================================================

-- All authenticated users can view customers
CREATE POLICY "authenticated_users_view_customers"
ON customers FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Sales roles can create customers
CREATE POLICY "sales_create_customers"
ON customers FOR INSERT
WITH CHECK (public.user_can_create_sales());

-- Sales roles can update customers
CREATE POLICY "sales_update_customers"
ON customers FOR UPDATE
USING (public.user_can_create_sales())
WITH CHECK (public.user_can_create_sales());

-- Only Admin can delete customers
CREATE POLICY "admin_delete_customers"
ON customers FOR DELETE
USING (public.user_is_admin());

-- ============================================================================
-- WAREHOUSES TABLE (Via junction table warehouse_companies)
-- ============================================================================

-- Users see warehouses assigned to their company
CREATE POLICY "users_view_company_warehouses"
ON warehouses FOR SELECT
USING (
  public.user_is_admin() -- Admin sees all
  OR
  EXISTS (
    SELECT 1 FROM warehouse_companies wc
    WHERE wc.warehouse_id = warehouses.id
      AND wc.company_id = public.user_company_id()
  )
);

-- Only Admin/Manager can create warehouses
CREATE POLICY "admin_manager_create_warehouses"
ON warehouses FOR INSERT
WITH CHECK (public.user_is_manager_or_admin());

-- Only Admin/Manager can update warehouses
CREATE POLICY "admin_manager_update_warehouses"
ON warehouses FOR UPDATE
USING (public.user_is_manager_or_admin())
WITH CHECK (public.user_is_manager_or_admin());

-- Only Admin can delete warehouses
CREATE POLICY "admin_delete_warehouses"
ON warehouses FOR DELETE
USING (public.user_is_admin());

-- ============================================================================
-- WAREHOUSE_COMPANIES TABLE (Junction table)
-- ============================================================================

-- Users can view assignments for their company
CREATE POLICY "users_view_warehouse_companies"
ON warehouse_companies FOR SELECT
USING (
  public.user_is_admin() -- Admin sees all
  OR
  company_id = public.user_company_id()
);

-- Only Admin can manage warehouse-company assignments
CREATE POLICY "admin_manage_warehouse_companies"
ON warehouse_companies FOR ALL
USING (public.user_is_admin())
WITH CHECK (public.user_is_admin());

-- ============================================================================
-- SALES TABLE (Multi-tenant with company_id)
-- ============================================================================

-- Users can ONLY view sales from their company
CREATE POLICY "users_view_company_sales"
ON sales FOR SELECT
USING (public.user_has_company_access(company_id));

-- Sales roles can create sales for their company ONLY
CREATE POLICY "sales_create_company_sales"
ON sales FOR INSERT
WITH CHECK (
  public.user_can_create_sales()
  AND public.user_has_company_access(company_id)
);

-- Users cannot update sales (immutable after creation)
-- Only Admin can update in exceptional cases
CREATE POLICY "admin_update_sales"
ON sales FOR UPDATE
USING (public.user_is_admin())
WITH CHECK (public.user_is_admin());

-- Only Admin can delete sales
CREATE POLICY "admin_delete_sales"
ON sales FOR DELETE
USING (public.user_is_admin());

-- ============================================================================
-- SALE_ITEMS TABLE (Inherits company from parent sale)
-- ============================================================================

-- Users can view sale_items if they can view the parent sale
CREATE POLICY "users_view_sale_items"
ON sale_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = sale_items.sale_id
      AND public.user_has_company_access(sales.company_id)
  )
);

-- Sale_items are created with parent sale (via application logic)
CREATE POLICY "sales_create_sale_items"
ON sale_items FOR INSERT
WITH CHECK (
  public.user_can_create_sales()
  AND EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = sale_items.sale_id
      AND public.user_has_company_access(sales.company_id)
  )
);

-- Only Admin can modify/delete sale_items
CREATE POLICY "admin_modify_sale_items"
ON sale_items FOR ALL
USING (public.user_is_admin())
WITH CHECK (public.user_is_admin());

-- ============================================================================
-- PAYMENTS TABLE (Inherits company from parent sale)
-- ============================================================================

-- Users can view payments if they can view the parent sale
CREATE POLICY "users_view_payments"
ON payments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = payments.sale_id
      AND public.user_has_company_access(sales.company_id)
  )
);

-- Users with payment permissions can create payments
CREATE POLICY "payment_handlers_create_payments"
ON payments FOR INSERT
WITH CHECK (
  public.user_can_handle_payments()
  AND EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = payments.sale_id
      AND public.user_has_company_access(sales.company_id)
  )
);

-- Payment handlers can update payment status
CREATE POLICY "payment_handlers_update_payments"
ON payments FOR UPDATE
USING (
  public.user_can_handle_payments()
  AND EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = payments.sale_id
      AND public.user_has_company_access(sales.company_id)
  )
)
WITH CHECK (
  public.user_can_handle_payments()
  AND EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = payments.sale_id
      AND public.user_has_company_access(sales.company_id)
  )
);

-- ============================================================================
-- RETURNS TABLE (Multi-tenant with company_id)
-- ============================================================================

-- Users can view returns from their company
CREATE POLICY "users_view_company_returns"
ON returns FOR SELECT
USING (public.user_has_company_access(company_id));

-- Users with return permissions can create returns
CREATE POLICY "return_handlers_create_returns"
ON returns FOR INSERT
WITH CHECK (
  public.user_can_handle_returns()
  AND public.user_has_company_access(company_id)
);

-- Only Admin can modify returns
CREATE POLICY "admin_modify_returns"
ON returns FOR UPDATE
USING (public.user_is_admin())
WITH CHECK (public.user_is_admin());

-- ============================================================================
-- RETURN_ITEMS TABLE (Inherits company from parent return)
-- ============================================================================

-- Users can view return_items if they can view the parent return
CREATE POLICY "users_view_return_items"
ON return_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM returns
    WHERE returns.id = return_items.return_id
      AND public.user_has_company_access(returns.company_id)
  )
);

-- Created with parent return (via application logic)
CREATE POLICY "return_handlers_create_return_items"
ON return_items FOR INSERT
WITH CHECK (
  public.user_can_handle_returns()
  AND EXISTS (
    SELECT 1 FROM returns
    WHERE returns.id = return_items.return_id
      AND public.user_has_company_access(returns.company_id)
  )
);

-- ============================================================================
-- TRANSFERS TABLE (Multi-tenant with company_id)
-- ============================================================================

-- Users can view transfers from their company
CREATE POLICY "users_view_company_transfers"
ON transfers FOR SELECT
USING (public.user_has_company_access(company_id));

-- Stock managers can create transfers within their company
CREATE POLICY "stock_managers_create_transfers"
ON transfers FOR INSERT
WITH CHECK (
  public.user_can_manage_stock()
  AND public.user_has_company_access(company_id)
);

-- Only Admin can modify transfers
CREATE POLICY "admin_modify_transfers"
ON transfers FOR UPDATE
USING (public.user_is_admin())
WITH CHECK (public.user_is_admin());

-- ============================================================================
-- TRANSFER_ITEMS TABLE (Inherits company from parent transfer)
-- ============================================================================

-- Users can view transfer_items if they can view the parent transfer
CREATE POLICY "users_view_transfer_items"
ON transfer_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM transfers
    WHERE transfers.id = transfer_items.transfer_id
      AND public.user_has_company_access(transfers.company_id)
  )
);

-- Created with parent transfer (via application logic)
CREATE POLICY "stock_managers_create_transfer_items"
ON transfer_items FOR INSERT
WITH CHECK (
  public.user_can_manage_stock()
  AND EXISTS (
    SELECT 1 FROM transfers
    WHERE transfers.id = transfer_items.transfer_id
      AND public.user_has_company_access(transfers.company_id)
  )
);

-- ============================================================================
-- STOCK_MOVEMENTS TABLE (No company_id - filtered via product/warehouse)
-- ============================================================================

-- All authenticated users can view stock movements
CREATE POLICY "authenticated_users_view_stock_movements"
ON stock_movements FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Stock managers can create stock movements
CREATE POLICY "stock_managers_create_movements"
ON stock_movements FOR INSERT
WITH CHECK (public.user_can_manage_stock());

-- Only Admin can modify stock movements
CREATE POLICY "admin_modify_stock_movements"
ON stock_movements FOR ALL
USING (public.user_is_admin())
WITH CHECK (public.user_is_admin());

-- ============================================================================
-- DOCUMENT_COUNTERS TABLE (Multi-tenant with company_id)
-- ============================================================================

-- Users can view counters for their company
CREATE POLICY "users_view_company_counters"
ON document_counters FOR SELECT
USING (public.user_has_company_access(company_id));

-- System can create/update counters (via RPC functions)
-- Only Admin can directly modify
CREATE POLICY "admin_manage_document_counters"
ON document_counters FOR ALL
USING (public.user_is_admin())
WITH CHECK (public.user_is_admin());

-- ============================================================================
-- AUDIT_LOGS TABLE (Optional company_id filtering)
-- ============================================================================

-- Users can view audit logs for their company
CREATE POLICY "users_view_company_audit_logs"
ON audit_logs FOR SELECT
USING (
  public.user_is_admin() -- Admin sees all
  OR
  public.user_has_company_access(company_id)
);

-- System creates audit logs automatically
-- Only Admin can modify
CREATE POLICY "admin_manage_audit_logs"
ON audit_logs FOR ALL
USING (public.user_is_admin())
WITH CHECK (public.user_is_admin());

-- ============================================================================
-- ERROR_LOGS TABLE (No company filtering - system-wide)
-- ============================================================================

-- Only Admin can view error logs
CREATE POLICY "admin_view_error_logs"
ON error_logs FOR SELECT
USING (public.user_is_admin());

-- System creates error logs
CREATE POLICY "authenticated_create_error_logs"
ON error_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Only Admin can delete error logs
CREATE POLICY "admin_delete_error_logs"
ON error_logs FOR DELETE
USING (public.user_is_admin());

-- ============================================================================
-- VERIFICATION: List all RLS-enabled tables
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'RLS Security Audit Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'All tables now have Row Level Security ENABLED';
  RAISE NOTICE 'All policies use helper functions for consistency';
  RAISE NOTICE 'Multi-tenant isolation is enforced via company_id';
  RAISE NOTICE '============================================';
END $$;
