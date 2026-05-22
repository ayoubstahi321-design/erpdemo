-- Migration: Document Numbering System
-- Description: Creates automatic sequential numbering for invoices, tickets, and delivery notes
-- Date: 2026-01-29

-- Create table to store document counters
CREATE TABLE IF NOT EXISTS document_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL CHECK (document_type IN ('TICKET', 'INVOICE', 'DELIVERY_NOTE')),
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(document_type, year)
);

-- Enable RLS
ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read counters
CREATE POLICY "Authenticated users can view counters" ON document_counters
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Policy: System can manage counters (for RPC function)
CREATE POLICY "System can manage counters" ON document_counters
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to generate next document number
CREATE OR REPLACE FUNCTION generate_document_number(
  p_document_type TEXT,
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
  INSERT INTO document_counters (document_type, year, last_number)
  VALUES (p_document_type, v_year, 1)
  ON CONFLICT (document_type, year)
  DO UPDATE SET
    last_number = document_counters.last_number + 1,
    updated_at = NOW()
  RETURNING last_number INTO v_next_number;

  -- Format: PREFIX-YEAR-NUMBER (e.g., F-2026-00001)
  v_document_number := v_prefix || '-' || v_year || '-' || LPAD(v_next_number::TEXT, 5, '0');

  RETURN v_document_number;
END;
$$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_document_counters_type_year ON document_counters(document_type, year);

-- Add comment
COMMENT ON FUNCTION generate_document_number IS 'Generates sequential document numbers: T-2026-00001, F-2026-00001, BL-2026-00001';
COMMENT ON TABLE document_counters IS 'Stores sequential counters for document numbering by type and year';

-- Initialize counters for current year (optional)
INSERT INTO document_counters (document_type, year, last_number)
VALUES
  ('TICKET', EXTRACT(YEAR FROM NOW())::INTEGER, 0),
  ('INVOICE', EXTRACT(YEAR FROM NOW())::INTEGER, 0),
  ('DELIVERY_NOTE', EXTRACT(YEAR FROM NOW())::INTEGER, 0)
ON CONFLICT (document_type, year) DO NOTHING;
