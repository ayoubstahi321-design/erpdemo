-- Migration: Add RLS Helper Functions
-- Description: Create helper functions to reduce duplication in RLS policies
-- Date: 2026-01-30
--
-- Purpose: Eliminate repeated patterns in RLS policy definitions

-- ====================================================================================
-- ROLE CHECK HELPER FUNCTIONS
-- ====================================================================================

-- Check if current user is Admin
CREATE OR REPLACE FUNCTION public.user_is_admin()
RETURNS BOOLEAN AS $$
  SELECT role = 'Admin' FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_is_admin() IS 'Returns true if current user has Admin role';

-- Check if current user is Manager or Admin
CREATE OR REPLACE FUNCTION public.user_is_manager_or_admin()
RETURNS BOOLEAN AS $$
  SELECT role IN ('Admin', 'Manager') FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_is_manager_or_admin() IS 'Returns true if current user has Admin or Manager role';

-- Check if current user can create sales (Sales, Cashier, Manager, Admin)
CREATE OR REPLACE FUNCTION public.user_can_create_sales()
RETURNS BOOLEAN AS $$
  SELECT role IN ('Admin', 'Manager', 'Sales', 'Cashier') FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_can_create_sales() IS 'Returns true if current user can create sales';

-- Check if current user can modify accounting (Accountant, Manager, Admin)
CREATE OR REPLACE FUNCTION public.user_can_modify_accounting()
RETURNS BOOLEAN AS $$
  SELECT role IN ('Admin', 'Manager', 'Accountant') FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_can_modify_accounting() IS 'Returns true if current user can modify accounting records';

-- Check if current user can manage stock (Warehouse, Sales, Cashier, Manager, Admin)
CREATE OR REPLACE FUNCTION public.user_can_manage_stock()
RETURNS BOOLEAN AS $$
  SELECT role IN ('Admin', 'Manager', 'Sales', 'Cashier', 'Warehouse') FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_can_manage_stock() IS 'Returns true if current user can manage stock levels';

-- Check if current user can handle returns (Sales, Manager, Admin)
CREATE OR REPLACE FUNCTION public.user_can_handle_returns()
RETURNS BOOLEAN AS $$
  SELECT role IN ('Admin', 'Manager', 'Sales') FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_can_handle_returns() IS 'Returns true if current user can handle returns';

-- Check if current user can handle payments (Cash, Accountant, Manager, Admin, Cashier, Sales)
CREATE OR REPLACE FUNCTION public.user_can_handle_payments()
RETURNS BOOLEAN AS $$
  SELECT role IN ('Admin', 'Manager', 'Accountant', 'Cashier', 'Sales') FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_can_handle_payments() IS 'Returns true if current user can handle payments';

-- ====================================================================================
-- COMPANY ACCESS HELPER FUNCTIONS
-- ====================================================================================

-- Check if current user has access to a specific company's data
CREATE OR REPLACE FUNCTION public.user_has_company_access(target_company_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT
    -- Admin has access to all companies
    public.user_company_id() IS NULL
    OR
    -- Regular user has access to their own company
    public.user_company_id() = target_company_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_has_company_access IS 'Returns true if current user has access to the specified company data';

-- ====================================================================================
-- USAGE EXAMPLES (Comment out after migration)
-- ====================================================================================

-- Example: Simplified RLS policy using helper functions
/*
-- Before (repetitive):
CREATE POLICY "Users can view sales" ON sales
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier')
    )
    AND (
      (SELECT company_id FROM profiles WHERE id = auth.uid()) IS NULL
      OR company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- After (concise):
CREATE POLICY "Users can view sales" ON sales
  FOR SELECT
  USING (
    public.user_can_create_sales()
    AND public.user_has_company_access(company_id)
  );
*/

-- ====================================================================================
-- VERIFICATION QUERIES (Comment out after migration)
-- ====================================================================================

-- Test helper functions (requires active auth session)
-- SELECT public.user_is_admin();
-- SELECT public.user_is_manager_or_admin();
-- SELECT public.user_company_id();
-- SELECT public.user_has_company_access('COMPANY_A');
