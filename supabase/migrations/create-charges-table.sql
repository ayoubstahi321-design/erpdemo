-- Migration: Create charges table for expense tracking
-- Run ONCE in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.charges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    TEXT,
  date          DATE NOT NULL,
  category      TEXT NOT NULL,
  description   TEXT NOT NULL,
  amount_ht     NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate      NUMERIC(5,4) NOT NULL DEFAULT 0,
  amount_ttc    NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  reference     TEXT,
  supplier_id   TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_charges_company_id ON public.charges(company_id);
CREATE INDEX IF NOT EXISTS idx_charges_date ON public.charges(date);

-- RLS
ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "charges_authenticated" ON public.charges
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$ BEGIN
  RAISE NOTICE 'charges table created successfully';
END $$;
