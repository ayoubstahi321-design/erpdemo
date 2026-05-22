-- ============================================================================
-- FIX: sales INSERT policy uses 'Salesperson' instead of correct role 'Sales'
-- ============================================================================
-- Problem: fix-sales-rls-company-isolation.sql created sales_insert policy with
--   profiles.role IN ('Admin', 'Manager', 'Salesperson', 'Cashier')
-- But the app's UserRole type only has: Admin | Manager | Accountant | Sales | Warehouse
-- 'Salesperson' and 'Cashier' do not exist — Sales users would be blocked on direct INSERT.
-- (Currently masked by create_sale_atomic using SECURITY DEFINER which bypasses RLS.)
--
-- This also aligns all RLS helper functions to drop ghost roles.
-- Run this ONCE in Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- 1. Recreate sales INSERT policy with correct role names
-- ============================================================================
DROP POLICY IF EXISTS "sales_insert" ON sales;

CREATE POLICY "sales_insert" ON sales
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('Admin', 'Manager', 'Sales')
    )
    AND (
      public.user_company_id() IS NULL              -- Admin: any company
      OR company_id = public.user_company_id()      -- Others: own company only
    )
  );

-- ============================================================================
-- 2. Fix user_can_create_sales() helper — remove ghost 'Cashier' role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_can_create_sales()
RETURNS BOOLEAN AS $$
  SELECT role IN ('Admin', 'Manager', 'Sales') FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_can_create_sales() IS
  'Returns true if current user can create sales (Admin, Manager, Sales)';

-- ============================================================================
-- 3. Fix user_can_manage_stock() helper — remove ghost 'Cashier' role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_can_manage_stock()
RETURNS BOOLEAN AS $$
  SELECT role IN ('Admin', 'Manager', 'Sales', 'Warehouse') FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_can_manage_stock() IS
  'Returns true if current user can manage stock levels (Admin, Manager, Sales, Warehouse)';

-- ============================================================================
-- 4. Fix user_can_handle_payments() helper — remove ghost 'Cashier' role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_can_handle_payments()
RETURNS BOOLEAN AS $$
  SELECT role IN ('Admin', 'Manager', 'Accountant', 'Sales') FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_can_handle_payments() IS
  'Returns true if current user can handle payments (Admin, Manager, Accountant, Sales)';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'RLS fix applied:';
  RAISE NOTICE '  sales_insert: Salesperson → Sales, removed Cashier';
  RAISE NOTICE '  user_can_create_sales: removed Cashier';
  RAISE NOTICE '  user_can_manage_stock: removed Cashier';
  RAISE NOTICE '  user_can_handle_payments: removed Cashier';
  RAISE NOTICE '============================================';
END $$;
