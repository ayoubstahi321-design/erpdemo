-- ============================================================================
-- FIX: Remove overly permissive customers SELECT policy
-- ============================================================================
-- Problem: Two SELECT policies exist on customers table:
--   1. "Authenticated users can view all customers" - allows everyone to see all
--   2. "Users see customers in their companies" - filters by company
--
-- RLS uses OR logic: if ANY policy allows access, row is visible.
-- The old policy overrides the new one, so managers see all customers.
--
-- Solution: Drop the old policy, keep only the company-filtered one.
--
-- Date: 2026-02-15
-- ============================================================================

-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view all customers" ON customers;

-- Verify: Only the correct policy should remain
SELECT
  policyname,
  cmd,
  CASE
    WHEN qual IS NULL THEN '(no restriction)'
    ELSE LEFT(qual, 100) || CASE WHEN LENGTH(qual) > 100 THEN '...' ELSE '' END
  END as policy_logic
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'customers'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- ============================================================================
-- Expected result after this migration:
--
-- Only "Users see customers in their companies" policy should remain
--
-- Behavior:
-- - Admin: sees all customers (any company_id)
-- - Manager of company A: sees only customers of company A + legacy (NULL company_id)
-- - Manager of company B: sees only customers of company B + legacy (NULL company_id)
-- - Sales of company A: sees only customers of company A + legacy
-- ============================================================================
