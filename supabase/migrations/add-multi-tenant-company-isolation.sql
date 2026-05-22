-- Migration: Add Multi-Tenant Company Isolation with N:M Warehouse-Company Model
-- Description: Enable complete multi-tenant data isolation with shared products/customers
-- Date: 2026-01-30
--
-- Architecture:
--   - Warehouses ↔ Companies: N:M relationship (junction table)
--   - Products: Shared globally (no company_id)
--   - Customers: Shared globally (no company_id)
--   - Sales/Transactions: User selects company when selling (company_id required)

-- ====================================================================================
-- PART 1: Create Warehouse-Company Junction Table (N:M Relationship)
-- ====================================================================================

CREATE TABLE IF NOT EXISTS warehouse_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, company_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_warehouse_companies_warehouse
  ON warehouse_companies(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_companies_company
  ON warehouse_companies(company_id);

-- Documentation
COMMENT ON TABLE warehouse_companies IS 'N:M relationship: One warehouse can serve multiple companies, one company can have multiple warehouses';
COMMENT ON COLUMN warehouse_companies.warehouse_id IS 'Foreign key to warehouses table';
COMMENT ON COLUMN warehouse_companies.company_id IS 'Company/tenant ID from profiles.company_id';

-- ====================================================================================
-- PART 2: Add company_id to Transaction Tables
-- ====================================================================================

-- Sales - User selects company when creating sale
ALTER TABLE sales ADD COLUMN IF NOT EXISTS company_id TEXT;
COMMENT ON COLUMN sales.company_id IS 'Company/tenant ID - Selected by user at sale time. Required for multi-tenant isolation.';

-- Payments - Inherit company from parent sale
ALTER TABLE payments ADD COLUMN IF NOT EXISTS company_id TEXT;
COMMENT ON COLUMN payments.company_id IS 'Company/tenant ID - Inherited from sale.company_id';

-- Transfers - Inter-warehouse movements within same company
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS company_id TEXT;
COMMENT ON COLUMN transfers.company_id IS 'Company/tenant ID - Transfers occur within single company only';

-- Returns - Inherit company from original sale
ALTER TABLE returns ADD COLUMN IF NOT EXISTS company_id TEXT;
COMMENT ON COLUMN returns.company_id IS 'Company/tenant ID - Inherited from original sale.company_id';

-- ====================================================================================
-- PART 3: Add company_id to System Tables
-- ====================================================================================

-- Document Counters - Per-company sequential numbering
ALTER TABLE document_counters ADD COLUMN IF NOT EXISTS company_id TEXT;
COMMENT ON COLUMN document_counters.company_id IS 'Company/tenant ID - Each company has independent document number sequences';

-- Audit Logs - Company-level audit trail
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id TEXT;
COMMENT ON COLUMN audit_logs.company_id IS 'Company/tenant ID - For compliance and per-company audit trails. NULL for system-wide events.';

-- ====================================================================================
-- PART 4: Create Indexes for Query Performance
-- ====================================================================================

-- Sales (most queried table)
CREATE INDEX IF NOT EXISTS idx_sales_company_id
  ON sales(company_id) WHERE company_id IS NOT NULL;

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_company_id
  ON payments(company_id) WHERE company_id IS NOT NULL;

-- Transfers
CREATE INDEX IF NOT EXISTS idx_transfers_company_id
  ON transfers(company_id) WHERE company_id IS NOT NULL;

-- Returns
CREATE INDEX IF NOT EXISTS idx_returns_company_id
  ON returns(company_id) WHERE company_id IS NOT NULL;

-- Document Counters (critical for concurrent document generation)
CREATE INDEX IF NOT EXISTS idx_document_counters_company_id
  ON document_counters(company_id) WHERE company_id IS NOT NULL;

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id
  ON audit_logs(company_id) WHERE company_id IS NOT NULL;

-- ====================================================================================
-- PART 5: Update Document Counters Unique Constraint
-- ====================================================================================

-- Drop old constraint (document_type, year)
ALTER TABLE document_counters
  DROP CONSTRAINT IF EXISTS document_counters_document_type_year_key;

-- Add new constraint (company_id, document_type, year) for per-company sequences
-- Using DO block because ADD CONSTRAINT doesn't support IF NOT EXISTS in all PostgreSQL versions
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

COMMENT ON CONSTRAINT document_counters_company_document_type_year_key
  ON document_counters IS 'Ensures unique sequential numbering per company, document type, and year';

-- ====================================================================================
-- PART 6: Update Triggers for updated_at
-- ====================================================================================

-- Trigger for warehouse_companies.updated_at
CREATE OR REPLACE FUNCTION update_warehouse_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_warehouse_companies_updated_at
  BEFORE UPDATE ON warehouse_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_warehouse_companies_updated_at();

-- ====================================================================================
-- VERIFICATION QUERIES (Comment out after migration)
-- ====================================================================================

-- Verify warehouse_companies table created
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'warehouse_companies'
-- ORDER BY ordinal_position;

-- Verify company_id columns added
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE column_name = 'company_id'
--   AND table_schema = 'public'
-- ORDER BY table_name;

-- Verify indexes created
-- SELECT indexname, tablename
-- FROM pg_indexes
-- WHERE indexname LIKE '%company%'
--   AND schemaname = 'public'
-- ORDER BY tablename, indexname;

-- Check for existing data that needs company_id assignment
-- SELECT 'sales' as table_name, COUNT(*) as records_without_company
-- FROM sales WHERE company_id IS NULL
-- UNION ALL
-- SELECT 'payments', COUNT(*) FROM payments WHERE company_id IS NULL
-- UNION ALL
-- SELECT 'transfers', COUNT(*) FROM transfers WHERE company_id IS NULL
-- UNION ALL
-- SELECT 'returns', COUNT(*) FROM returns WHERE company_id IS NULL;

-- ====================================================================================
-- NOTES FOR IMPLEMENTATION
-- ====================================================================================

-- 1. Products and Customers tables: NO company_id needed (globally shared resources)
-- 2. Stock Levels: No company_id needed (filtered via products → warehouses relationship)
-- 3. Sale Items, Transfer Items, Return Items: No company_id needed (inherit from parent)
-- 4. Admin users (profiles.company_id = NULL) will have access to all companies
-- 5. Regular users must have company_id assigned to access any data
-- 6. Warehouse assignments managed via warehouse_companies junction table
-- 7. Next step: Apply RLS policies in separate migration file
-- 8. UI must be updated to include company selector in sales creation

