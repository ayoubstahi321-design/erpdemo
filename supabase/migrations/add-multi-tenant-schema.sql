-- ============================================================================
-- MULTI-TENANT SCHEMA MIGRATION
-- ============================================================================
-- Adds company_id columns and warehouse_companies junction table
-- for proper multi-tenant data isolation
--
-- MUST RUN BEFORE: security-audit-enable-rls-all-tables.sql
-- Date: 2026-01-31
-- ============================================================================

-- ============================================================================
-- STEP 1: Create warehouse_companies junction table (N:M relationship)
-- ============================================================================

CREATE TABLE IF NOT EXISTS warehouse_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT warehouse_companies_unique UNIQUE(warehouse_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_companies_warehouse ON warehouse_companies(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_companies_company ON warehouse_companies(company_id);

COMMENT ON TABLE warehouse_companies IS 'N:M relationship: Warehouses can serve multiple companies';
COMMENT ON COLUMN warehouse_companies.warehouse_id IS 'Foreign key to warehouses table';
COMMENT ON COLUMN warehouse_companies.company_id IS 'Company identifier from profiles table';

-- ============================================================================
-- STEP 2: Add company_id to transaction tables (if not exists)
-- ============================================================================

-- Sales table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE sales ADD COLUMN company_id TEXT;
    CREATE INDEX idx_sales_company_id ON sales(company_id) WHERE company_id IS NOT NULL;
  END IF;
END $$;

-- Payments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN company_id TEXT;
    CREATE INDEX idx_payments_company_id ON payments(company_id) WHERE company_id IS NOT NULL;
  END IF;
END $$;

-- Returns table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'returns' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE returns ADD COLUMN company_id TEXT;
    CREATE INDEX idx_returns_company_id ON returns(company_id) WHERE company_id IS NOT NULL;
  END IF;
END $$;

-- Transfers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE transfers ADD COLUMN company_id TEXT;
    CREATE INDEX idx_transfers_company_id ON transfers(company_id) WHERE company_id IS NOT NULL;
  END IF;
END $$;

-- Document counters table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_counters' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE document_counters ADD COLUMN company_id TEXT;
    CREATE INDEX idx_document_counters_company_id ON document_counters(company_id) WHERE company_id IS NOT NULL;
  END IF;
END $$;

-- Audit logs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN company_id TEXT;
    CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id) WHERE company_id IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Update document_counters unique constraint for per-company sequences
-- ============================================================================

-- Drop old constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_counters_document_type_year_key'
  ) THEN
    ALTER TABLE document_counters
      DROP CONSTRAINT document_counters_document_type_year_key;
  END IF;
END $$;

-- Add new constraint (company_id, document_type, year)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_counters_company_document_type_year_key'
  ) THEN
    ALTER TABLE document_counters
      ADD CONSTRAINT document_counters_company_document_type_year_key
      UNIQUE (company_id, document_type, year);
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Update get_next_document_number function for per-company numbering
-- ============================================================================

CREATE OR REPLACE FUNCTION get_next_document_number(
  p_company_id TEXT,
  p_document_type TEXT
) RETURNS TEXT AS $$
DECLARE
  v_year INT;
  v_next_number INT;
  v_formatted_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);

  -- Get or create counter for this company/type/year
  INSERT INTO document_counters (company_id, document_type, year, last_number)
  VALUES (p_company_id, p_document_type, v_year, 1)
  ON CONFLICT (company_id, document_type, year)
  DO UPDATE SET last_number = document_counters.last_number + 1
  RETURNING last_number INTO v_next_number;

  -- Format based on document type
  CASE p_document_type
    WHEN 'INVOICE' THEN
      v_formatted_number := 'F-' || v_year || '-' || LPAD(v_next_number::TEXT, 5, '0');
    WHEN 'DELIVERY_NOTE' THEN
      v_formatted_number := 'BL-' || v_year || '-' || LPAD(v_next_number::TEXT, 5, '0');
    WHEN 'TICKET' THEN
      v_formatted_number := 'T-' || v_year || '-' || LPAD(v_next_number::TEXT, 5, '0');
    ELSE
      v_formatted_number := p_document_type || '-' || v_year || '-' || LPAD(v_next_number::TEXT, 5, '0');
  END CASE;

  RETURN v_formatted_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_next_document_number IS 'Generates next document number with per-company sequences';

-- ============================================================================
-- STEP 5: Migrate existing data (if any)
-- ============================================================================

-- Assign existing sales to a default company (if needed)
-- Only update sales without company_id
DO $$
DECLARE
  default_company TEXT;
BEGIN
  -- Get first company_id from profiles (if any)
  SELECT company_id INTO default_company
  FROM profiles
  WHERE company_id IS NOT NULL
  LIMIT 1;

  -- If we found a company, assign it to orphaned sales
  IF default_company IS NOT NULL THEN
    UPDATE sales
    SET company_id = default_company
    WHERE company_id IS NULL;

    UPDATE payments
    SET company_id = default_company
    WHERE company_id IS NULL;

    UPDATE returns
    SET company_id = default_company
    WHERE company_id IS NULL;

    UPDATE transfers
    SET company_id = default_company
    WHERE company_id IS NULL;
  END IF;
END $$;

-- Assign all existing warehouses to all existing companies
-- This ensures backwards compatibility
DO $$
DECLARE
  wh RECORD;
  comp RECORD;
BEGIN
  FOR wh IN SELECT id FROM warehouses LOOP
    FOR comp IN SELECT DISTINCT company_id FROM profiles WHERE company_id IS NOT NULL LOOP
      INSERT INTO warehouse_companies (warehouse_id, company_id)
      VALUES (wh.id, comp.company_id)
      ON CONFLICT (warehouse_id, company_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Multi-Tenant Schema Migration Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '1. Created warehouse_companies junction table';
  RAISE NOTICE '2. Added company_id to transaction tables';
  RAISE NOTICE '3. Updated document counter constraints';
  RAISE NOTICE '4. Updated get_next_document_number function';
  RAISE NOTICE '5. Migrated existing data to default company';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Next step: Run security-audit-enable-rls-all-tables.sql';
  RAISE NOTICE '============================================';
END $$;

-- Verify the changes
SELECT
  'warehouse_companies' AS table_name,
  COUNT(*) AS assignment_count
FROM warehouse_companies
UNION ALL
SELECT
  'sales_with_company' AS table_name,
  COUNT(*) AS count
FROM sales WHERE company_id IS NOT NULL
UNION ALL
SELECT
  'warehouses' AS table_name,
  COUNT(*) AS count
FROM warehouses;
