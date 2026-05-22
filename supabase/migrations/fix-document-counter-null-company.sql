-- Migration: Fix Document Counter NULL company_id issue
-- Description: PostgreSQL NULL != NULL causes ON CONFLICT to never match for system-wide counters.
--              This migration uses '__SYSTEM__' sentinel instead of NULL for company_id.
-- Date: 2026-02-01
--
-- PROBLEM: When company_id is NULL, every INSERT creates a new row because
--          ON CONFLICT (company_id, document_type, year) never triggers (NULL != NULL in SQL).
--          Result: all documents get number 00001.
--
-- FIX: Use '__SYSTEM__' sentinel value instead of NULL for system-wide counters.

-- Step 1: Ensure company_id column exists (may have been added by previous migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_counters' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE document_counters ADD COLUMN company_id TEXT;
  END IF;
END $$;

-- Step 2: Convert existing NULL company_id rows to '__SYSTEM__' sentinel
UPDATE document_counters SET company_id = '__SYSTEM__' WHERE company_id IS NULL;

-- Step 3: Set NOT NULL default for company_id
ALTER TABLE document_counters ALTER COLUMN company_id SET DEFAULT '__SYSTEM__';
ALTER TABLE document_counters ALTER COLUMN company_id SET NOT NULL;

-- Step 4: Drop old unique constraints and create new one
-- Drop the original constraint if it exists
ALTER TABLE document_counters DROP CONSTRAINT IF EXISTS document_counters_document_type_year_key;
-- Drop any multi-tenant constraint that might exist
ALTER TABLE document_counters DROP CONSTRAINT IF EXISTS document_counters_company_id_document_type_year_key;

-- Create new unique constraint including company_id (now NOT NULL, so ON CONFLICT works)
ALTER TABLE document_counters ADD CONSTRAINT document_counters_company_document_type_year_unique
  UNIQUE (company_id, document_type, year);

-- Step 5: Clean up duplicate rows (keep highest last_number per group)
DELETE FROM document_counters a
USING document_counters b
WHERE a.id < b.id
  AND a.company_id = b.company_id
  AND a.document_type = b.document_type
  AND a.year = b.year;

-- Step 6: Recreate the RPC function with COALESCE to sentinel
DROP FUNCTION IF EXISTS generate_document_number(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS generate_document_number(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION generate_document_number(
  p_document_type TEXT,
  p_company_id TEXT DEFAULT '__SYSTEM__',
  p_year INTEGER DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INTEGER;
  v_next_number INTEGER;
  v_prefix TEXT;
  v_document_number TEXT;
  v_company_key TEXT;
BEGIN
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM NOW())::INTEGER);
  -- Always use sentinel instead of NULL to avoid NULL != NULL issue
  v_company_key := COALESCE(NULLIF(TRIM(p_company_id), ''), '__SYSTEM__');

  CASE p_document_type
    WHEN 'TICKET' THEN v_prefix := 'T';
    WHEN 'INVOICE' THEN v_prefix := 'F';
    WHEN 'DELIVERY_NOTE' THEN v_prefix := 'BL';
    ELSE RAISE EXCEPTION 'Invalid document type: %', p_document_type;
  END CASE;

  -- Atomic upsert: insert with 1 or increment existing
  INSERT INTO document_counters (company_id, document_type, year, last_number)
  VALUES (v_company_key, p_document_type, v_year, 1)
  ON CONFLICT (company_id, document_type, year)
  DO UPDATE SET
    last_number = document_counters.last_number + 1,
    updated_at = NOW()
  RETURNING last_number INTO v_next_number;

  v_document_number := v_prefix || '-' || v_year || '-' || LPAD(v_next_number::TEXT, 5, '0');

  RETURN v_document_number;
END;
$$;

-- Step 7: Initialize counters for current year if they don't exist
INSERT INTO document_counters (company_id, document_type, year, last_number)
VALUES
  ('__SYSTEM__', 'TICKET', EXTRACT(YEAR FROM NOW())::INTEGER, 0),
  ('__SYSTEM__', 'INVOICE', EXTRACT(YEAR FROM NOW())::INTEGER, 0),
  ('__SYSTEM__', 'DELIVERY_NOTE', EXTRACT(YEAR FROM NOW())::INTEGER, 0)
ON CONFLICT (company_id, document_type, year) DO NOTHING;

-- Step 8: Sync counters with actual sales data (set counter to max existing number)
-- This ensures the counter reflects reality after the fix
DO $$
DECLARE
  v_max_invoice INTEGER;
  v_max_ticket INTEGER;
  v_max_delivery INTEGER;
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
BEGIN
  -- Find max invoice number from sales table
  SELECT COALESCE(MAX(
    CASE WHEN invoice_number ~ ('^F-' || v_year || '-\d+$')
    THEN SUBSTRING(invoice_number FROM '-(\d+)$')::INTEGER
    ELSE 0 END
  ), 0) INTO v_max_invoice
  FROM sales WHERE invoice_number LIKE 'F-' || v_year || '-%';

  -- Find max ticket number
  SELECT COALESCE(MAX(
    CASE WHEN invoice_number ~ ('^T-' || v_year || '-\d+$')
    THEN SUBSTRING(invoice_number FROM '-(\d+)$')::INTEGER
    ELSE 0 END
  ), 0) INTO v_max_ticket
  FROM sales WHERE invoice_number LIKE 'T-' || v_year || '-%';

  -- Find max delivery note number
  SELECT COALESCE(MAX(
    CASE WHEN delivery_note_number ~ ('^BL-' || v_year || '-\d+$')
    THEN SUBSTRING(delivery_note_number FROM '-(\d+)$')::INTEGER
    ELSE 0 END
  ), 0) INTO v_max_delivery
  FROM sales WHERE delivery_note_number LIKE 'BL-' || v_year || '-%';

  -- Update counters to match actual data (only if actual is higher)
  UPDATE document_counters
  SET last_number = GREATEST(last_number, v_max_invoice), updated_at = NOW()
  WHERE company_id = '__SYSTEM__' AND document_type = 'INVOICE' AND year = v_year;

  UPDATE document_counters
  SET last_number = GREATEST(last_number, v_max_ticket), updated_at = NOW()
  WHERE company_id = '__SYSTEM__' AND document_type = 'TICKET' AND year = v_year;

  UPDATE document_counters
  SET last_number = GREATEST(last_number, v_max_delivery), updated_at = NOW()
  WHERE company_id = '__SYSTEM__' AND document_type = 'DELIVERY_NOTE' AND year = v_year;

  RAISE NOTICE 'Synced counters: INVOICE=%, TICKET=%, DELIVERY_NOTE=%', v_max_invoice, v_max_ticket, v_max_delivery;
END $$;

COMMENT ON FUNCTION generate_document_number IS 'Generates sequential document numbers per company. Uses __SYSTEM__ sentinel for system-wide (non-company) numbering to avoid NULL comparison issues.';
