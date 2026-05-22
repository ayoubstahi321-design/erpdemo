-- Migration: Update Document Counter for Multi-Tenant Support
-- Description: Updates generate_document_number function to support per-company sequences
-- Date: 2026-01-30
--
-- Changes:
-- - Add company_id parameter to generate_document_number()
-- - Use (company_id, document_type, year) unique constraint for per-company numbering
-- - Maintain backward compatibility with NULL company_id for legacy/admin usage

-- Drop existing function
DROP FUNCTION IF EXISTS generate_document_number(TEXT, INTEGER);

-- Create updated function with company_id parameter
CREATE OR REPLACE FUNCTION generate_document_number(
  p_document_type TEXT,
  p_company_id TEXT DEFAULT NULL,
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
BEGIN
  -- Use provided year or current year
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM NOW())::INTEGER);

  -- Determine prefix based on document type
  CASE p_document_type
    WHEN 'TICKET' THEN v_prefix := 'T';
    WHEN 'INVOICE' THEN v_prefix := 'F';
    WHEN 'DELIVERY_NOTE' THEN v_prefix := 'BL';
    ELSE RAISE EXCEPTION 'Invalid document type: %', p_document_type;
  END CASE;

  -- Get and increment counter (atomic operation)
  -- Uses (company_id, document_type, year) unique constraint for per-company sequences
  INSERT INTO document_counters (company_id, document_type, year, last_number)
  VALUES (p_company_id, p_document_type, v_year, 1)
  ON CONFLICT (company_id, document_type, year)
  DO UPDATE SET
    last_number = document_counters.last_number + 1,
    updated_at = NOW()
  RETURNING last_number INTO v_next_number;

  -- Format: PREFIX-YEAR-NUMBER (e.g., F-2026-00001)
  v_document_number := v_prefix || '-' || v_year || '-' || LPAD(v_next_number::TEXT, 5, '0');

  RETURN v_document_number;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION generate_document_number IS 'Generates sequential document numbers per company: T-2026-00001, F-2026-00001, BL-2026-00001. Each company has independent sequences.';

-- ====================================================================================
-- NOTES FOR IMPLEMENTATION
-- ====================================================================================
--
-- 1. Application code must now pass company_id when calling generate_document_number()
-- 2. Each company will have independent document number sequences
-- 3. Company A: F-2026-00001, F-2026-00002, ...
--    Company B: F-2026-00001, F-2026-00002, ... (independent from Company A)
-- 4. Admin users (company_id = NULL) will have their own sequence (for system-wide documents)
-- 5. The unique constraint (company_id, document_type, year) ensures no collisions
-- 6. Existing counters without company_id will continue to work (company_id = NULL)
--
