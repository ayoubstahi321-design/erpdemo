-- Migration: Monthly Document Numbering
-- Description: Adds month column to document_counters so numbering resets each month.
--              New format: PREFIX-YYYY-MM-NNNNN  (e.g. F-2026-03-00001)
-- Date: 2026-03-25
--
-- BACKWARDS COMPATIBLE: existing yearly-format documents (F-2026-00042) are untouched.
-- Legacy rows keep month = 0 (the DEFAULT), which never conflicts with real months 1–12.

-- Step 1: Add month column (DEFAULT 0 = legacy yearly rows)
ALTER TABLE document_counters ADD COLUMN IF NOT EXISTS month INTEGER NOT NULL DEFAULT 0;

-- Step 2: Drop old yearly unique constraint (both possible names), add new monthly one
ALTER TABLE document_counters DROP CONSTRAINT IF EXISTS document_counters_company_document_type_year_unique;
ALTER TABLE document_counters DROP CONSTRAINT IF EXISTS document_counters_company_document_type_year_key;
ALTER TABLE document_counters DROP CONSTRAINT IF EXISTS document_counters_company_document_type_year_month_unique;
ALTER TABLE document_counters ADD CONSTRAINT document_counters_company_document_type_year_month_unique
  UNIQUE (company_id, document_type, year, month);

-- Step 3: Replace RPC function with monthly-aware version
DROP FUNCTION IF EXISTS generate_document_number(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS generate_document_number(TEXT, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION generate_document_number(
  p_document_type TEXT,
  p_company_id    TEXT    DEFAULT '__SYSTEM__',
  p_year          INTEGER DEFAULT NULL,
  p_month         INTEGER DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year        INTEGER;
  v_month       INTEGER;
  v_next_number INTEGER;
  v_prefix      TEXT;
  v_result      TEXT;
  v_company_key TEXT;
BEGIN
  v_year  := COALESCE(p_year,  EXTRACT(YEAR  FROM NOW())::INTEGER);
  v_month := COALESCE(p_month, EXTRACT(MONTH FROM NOW())::INTEGER);
  v_company_key := COALESCE(NULLIF(TRIM(p_company_id), ''), '__SYSTEM__');

  CASE p_document_type
    WHEN 'TICKET'        THEN v_prefix := 'T';
    WHEN 'INVOICE'       THEN v_prefix := 'F';
    WHEN 'DELIVERY_NOTE' THEN v_prefix := 'BL';
    ELSE RAISE EXCEPTION 'Invalid document type: %', p_document_type;
  END CASE;

  -- Atomic upsert per (company, type, year, month)
  INSERT INTO document_counters (company_id, document_type, year, month, last_number)
  VALUES (v_company_key, p_document_type, v_year, v_month, 1)
  ON CONFLICT (company_id, document_type, year, month)
  DO UPDATE SET
    last_number = document_counters.last_number + 1,
    updated_at  = NOW()
  RETURNING last_number INTO v_next_number;

  -- Format: PREFIX-YYYY-MM-NNNNN  (month zero-padded to 2 digits)
  v_result := v_prefix
    || '-' || v_year
    || '-' || LPAD(v_month::TEXT, 2, '0')
    || '-' || LPAD(v_next_number::TEXT, 5, '0');

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION generate_document_number IS
  'Generates sequential monthly document numbers. Format: PREFIX-YYYY-MM-NNNNN. '
  'Sequence resets each month. Uses __SYSTEM__ sentinel for non-company numbering.';

-- Step 4: Initialize counters for current month (if not already present)
INSERT INTO document_counters (company_id, document_type, year, month, last_number)
VALUES
  ('__SYSTEM__', 'TICKET',        EXTRACT(YEAR  FROM NOW())::INTEGER, EXTRACT(MONTH FROM NOW())::INTEGER, 0),
  ('__SYSTEM__', 'INVOICE',       EXTRACT(YEAR  FROM NOW())::INTEGER, EXTRACT(MONTH FROM NOW())::INTEGER, 0),
  ('__SYSTEM__', 'DELIVERY_NOTE', EXTRACT(YEAR  FROM NOW())::INTEGER, EXTRACT(MONTH FROM NOW())::INTEGER, 0)
ON CONFLICT (company_id, document_type, year, month) DO NOTHING;
