-- ============================================================================
-- RLS POLICY TESTING SCRIPT
-- ============================================================================
-- This script tests that Row Level Security policies work correctly
-- Run this AFTER applying security-audit-enable-rls-all-tables.sql
--
-- HOW TO USE:
-- 1. Create test users in Supabase Auth
-- 2. Update their profiles with different company_id values
-- 3. Run these queries as different users to verify isolation
-- ============================================================================

-- ============================================================================
-- TEST SETUP: Create test data
-- ============================================================================

-- Create test companies in profiles (if not already exist)
-- Company A: COMP-A
-- Company B: COMP-B
-- Admin: NULL company_id

-- Create test warehouses (using valid UUIDs)
INSERT INTO warehouses (id, name, location, type) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Warehouse Test 1', 'Location 1', 'Central'),
  ('22222222-2222-2222-2222-222222222222', 'Warehouse Test 2', 'Location 2', 'Branch')
ON CONFLICT (id) DO NOTHING;

-- Assign warehouses to companies
INSERT INTO warehouse_companies (warehouse_id, company_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'COMP-A'),
  ('11111111-1111-1111-1111-111111111111', 'COMP-B'),  -- Shared warehouse
  ('22222222-2222-2222-2222-222222222222', 'COMP-A')   -- Only Company A
ON CONFLICT (warehouse_id, company_id) DO NOTHING;

-- Create test products (shared across all companies)
INSERT INTO products (id, sku, name, category, cost, price, pack_size, unit, min_stock) VALUES
  ('33333333-3333-3333-3333-333333333333', 'TEST001', 'Product Test 1', 'General', 80.00, 100.00, 1, 'pcs', 10)
ON CONFLICT (id) DO NOTHING;

-- Create test customers (shared across all companies)
INSERT INTO customers (id, type, name, phone, address, city) VALUES
  ('44444444-4444-4444-4444-444444444444', 'Individual', 'Customer Test 1', '0600000001', 'Test Address 1', 'Casablanca')
ON CONFLICT (id) DO NOTHING;

-- Create test sales (company-specific)
INSERT INTO sales (
  id, company_id, warehouse_id, customer_id, customer_name, customer_type,
  date, subtotal_amount, tax_rate, tax_amount, total_amount, amount_paid,
  payment_status, status, created_by
) VALUES
  (
    '55555555-5555-5555-5555-555555555555', 'COMP-A',
    '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
    'Customer Test 1', 'Individual',
    NOW(), 416.67, 0.20, 83.33, 500.00, 500.00,
    'Paid', 'Completed', NULL
  ),
  (
    '77777777-7777-7777-7777-777777777777', 'COMP-B',
    '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
    'Customer Test 1', 'Individual',
    NOW(), 250.00, 0.20, 50.00, 300.00, 300.00,
    'Paid', 'Completed', NULL
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TEST 1: Warehouse Visibility
-- ============================================================================

-- Expected Results:
-- - Admin (company_id IS NULL): Sees ALL warehouses (Warehouse Test 1, Warehouse Test 2)
-- - Company A user: Sees both warehouses (both assigned to COMP-A)
-- - Company B user: Sees only Warehouse Test 1 (only one assigned to COMP-B)

SELECT 'TEST 1: Warehouse Visibility' AS test_name;

-- As Admin (set auth.uid() to admin user ID)
-- Should return 2 warehouses
SELECT COUNT(*) AS admin_warehouse_count FROM warehouses;

-- As Company A user
-- Should return 2 warehouses (wh-test-1, wh-test-2)
-- (This requires setting auth.uid() to Company A user's ID in test environment)

-- As Company B user
-- Should return 1 warehouse (wh-test-1)
-- (This requires setting auth.uid() to Company B user's ID in test environment)

-- ============================================================================
-- TEST 2: Product Visibility (Shared - No Filtering)
-- ============================================================================

-- Expected Results:
-- - ALL authenticated users see ALL products (no company filtering)

SELECT 'TEST 2: Product Visibility (Shared)' AS test_name;

-- All users should see the same products
SELECT COUNT(*) AS product_count FROM products;

-- ============================================================================
-- TEST 3: Customer Visibility (Shared - No Filtering)
-- ============================================================================

-- Expected Results:
-- - ALL authenticated users see ALL customers (no company filtering)

SELECT 'TEST 3: Customer Visibility (Shared)' AS test_name;

-- All users should see the same customers
SELECT COUNT(*) AS customer_count FROM customers;

-- ============================================================================
-- TEST 4: Sales Isolation by Company
-- ============================================================================

-- Expected Results:
-- - Admin: Sees ALL sales (sale-comp-a-1, sale-comp-b-1)
-- - Company A user: Sees ONLY sale-comp-a-1
-- - Company B user: Sees ONLY sale-comp-b-1

SELECT 'TEST 4: Sales Isolation' AS test_name;

-- As Admin
-- Should return 2 sales
SELECT COUNT(*) AS admin_sales_count FROM sales;

-- As Company A user
-- Should return 1 sale (sale-comp-a-1)
-- SELECT COUNT(*) AS comp_a_sales_count FROM sales WHERE company_id = 'COMP-A';

-- As Company B user
-- Should return 1 sale (sale-comp-b-1)
-- SELECT COUNT(*) AS comp_b_sales_count FROM sales WHERE company_id = 'COMP-B';

-- ============================================================================
-- TEST 5: Cross-Company Data Leakage Prevention
-- ============================================================================

-- Expected Results:
-- - Company A user CANNOT see Company B sales (even with direct ID query)

SELECT 'TEST 5: Cross-Company Data Leakage Prevention' AS test_name;

-- As Company B user, try to access Company A sale
-- Should return 0 rows (RLS blocks access)
SELECT COUNT(*) AS leaked_sales
FROM sales
WHERE id = '55555555-5555-5555-5555-555555555555' AND company_id = 'COMP-A';

-- ============================================================================
-- TEST 6: Permission-Based Access (Role Checks)
-- ============================================================================

-- Expected Results:
-- - Only Admin/Manager can create warehouses
-- - Only Sales/Cashier/Manager/Admin can create sales
-- - Only Admin can delete customers

SELECT 'TEST 6: Permission-Based Access' AS test_name;

-- Test creating warehouse as non-Manager user (should fail)
-- Test creating sale as Cashier user (should succeed)
-- Test deleting customer as Sales user (should fail)

-- ============================================================================
-- TEST 7: Junction Table Filtering (Warehouse-Company)
-- ============================================================================

-- Expected Results:
-- - Company A user sees assignments for COMP-A only
-- - Admin sees all assignments

SELECT 'TEST 7: Junction Table Filtering' AS test_name;

-- As Admin - should see all assignments
SELECT COUNT(*) AS all_assignments FROM warehouse_companies;

-- As Company A user - should see only COMP-A assignments
SELECT COUNT(*) AS comp_a_assignments
FROM warehouse_companies
WHERE company_id = 'COMP-A';

-- ============================================================================
-- CLEANUP (Optional - uncomment to remove test data)
-- ============================================================================

/*
DELETE FROM sales WHERE id IN ('55555555-5555-5555-5555-555555555555', '77777777-7777-7777-7777-777777777777');
DELETE FROM warehouse_companies WHERE warehouse_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM warehouses WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM products WHERE id = '33333333-3333-3333-3333-333333333333';
DELETE FROM customers WHERE id = '44444444-4444-4444-4444-444444444444';
*/

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'RLS Policy Testing Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Verify the following manually:';
  RAISE NOTICE '1. Admin users can see ALL data';
  RAISE NOTICE '2. Regular users see ONLY their company data';
  RAISE NOTICE '3. Products and customers are shared (no filtering)';
  RAISE NOTICE '4. Warehouses are filtered via junction table';
  RAISE NOTICE '5. No cross-company data leakage occurs';
  RAISE NOTICE '6. Role-based permissions are enforced';
  RAISE NOTICE '============================================';
END $$;
