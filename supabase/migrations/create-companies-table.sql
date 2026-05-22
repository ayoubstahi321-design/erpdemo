-- ============================================================================
-- Migration: Create companies table
-- Date: 2026-02-15
-- Problem: Company profiles were stored only in localStorage (lost on
--          browser clear, device change, or incognito). All Supabase data
--          references company_id TEXT that must be durable server-side.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.companies (
  id          TEXT PRIMARY KEY,              -- same TEXT id used in sales/transfers/etc.
  name        TEXT NOT NULL,                 -- profile display name (e.g. "Azmol Capo")
  full_name   TEXT,                          -- legal company name
  address     TEXT,
  city        TEXT,
  country     TEXT,
  phone       TEXT,
  email       TEXT,
  website     TEXT,
  ice         TEXT,
  rc          TEXT,
  if_number   TEXT,
  cnss        TEXT,
  patente     TEXT,
  capital     TEXT,
  bank_name   TEXT,
  rib         TEXT,
  default_tax_rate NUMERIC(5,4) DEFAULT 0.20,
  logo        TEXT,                          -- base64 or URL
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read companies (needed for invoices, filters)
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only Admin can insert/update/delete companies
CREATE POLICY "companies_insert" ON public.companies
  FOR INSERT WITH CHECK (public.user_is_admin());

CREATE POLICY "companies_update" ON public.companies
  FOR UPDATE USING (public.user_is_admin());

CREATE POLICY "companies_delete" ON public.companies
  FOR DELETE USING (public.user_is_admin());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS companies_updated_at ON public.companies;
CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  RAISE NOTICE 'companies table created with RLS policies';
END $$;
