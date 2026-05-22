-- ============================================================================
-- MULTI-COMPANY USER ASSIGNMENT MIGRATION
-- ============================================================================
-- Adds user_companies junction table for N:M relationship (users can have multiple companies)
-- Adds company_id to customers table for company-specific customers
--
-- Date: 2026-02-09
-- ============================================================================

-- ============================================================================
-- STEP 1: Create user_companies junction table (N:M relationship)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_companies_unique UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);

COMMENT ON TABLE user_companies IS 'N:M relationship: Users can be assigned to multiple companies';
COMMENT ON COLUMN user_companies.user_id IS 'Foreign key to profiles table (auth user)';
COMMENT ON COLUMN user_companies.company_id IS 'Company identifier from company profiles';

-- ============================================================================
-- STEP 2: Add company_id to customers table
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN company_id TEXT;
    CREATE INDEX idx_customers_company_id ON customers(company_id) WHERE company_id IS NOT NULL;
    COMMENT ON COLUMN customers.company_id IS 'Company this customer belongs to. NULL for legacy/shared customers.';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Enable RLS on user_companies
-- ============================================================================

ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

-- Admins can manage all user_companies
CREATE POLICY "Admins can manage user_companies"
  ON user_companies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Admin'
    )
  );

-- Users can view their own company assignments
CREATE POLICY "Users can view own companies"
  ON user_companies FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- STEP 4: Migrate existing data
-- ============================================================================

-- Migrate existing user company assignments from profiles.company_id to user_companies
INSERT INTO user_companies (user_id, company_id)
SELECT id, company_id
FROM profiles
WHERE company_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

-- ============================================================================
-- STEP 5: Update customers RLS to support company filtering
-- ============================================================================

-- Drop existing policies if they exist (to recreate with company support)
DO $$
BEGIN
  -- Only drop if exists
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users see customers in their companies' AND tablename = 'customers') THEN
    DROP POLICY "Users see customers in their companies" ON customers;
  END IF;
END $$;

-- Create new policy for company-filtered customer access
CREATE POLICY "Users see customers in their companies"
  ON customers FOR SELECT
  USING (
    -- Customers without company (legacy/shared) are visible to all
    company_id IS NULL
    -- Admins see all customers
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
    -- Users see customers in their assigned companies
    OR company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid())
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'User Companies Junction Migration Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '1. Created user_companies junction table';
  RAISE NOTICE '2. Added company_id to customers table';
  RAISE NOTICE '3. Enabled RLS on user_companies';
  RAISE NOTICE '4. Migrated existing company assignments';
  RAISE NOTICE '5. Updated customers RLS for company filtering';
  RAISE NOTICE '============================================';
END $$;

-- Verify the migration
SELECT 'user_companies created' AS status, COUNT(*) AS count FROM user_companies
UNION ALL
SELECT 'customers with company_id' AS status, COUNT(*) AS count FROM customers WHERE company_id IS NOT NULL;
