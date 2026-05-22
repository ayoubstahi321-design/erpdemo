-- ============================================================================
-- Migration: Add signature and tier_configs columns to companies table
-- Problem: logo was saved but signature and tier_configs columns were missing
--          causing silent save failure (Supabase returns error, only logged).
-- Run ONCE in Supabase SQL Editor.
-- ============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS signature    TEXT,
  ADD COLUMN IF NOT EXISTS tier_configs JSONB;

DO $$
BEGIN
  RAISE NOTICE 'companies: signature and tier_configs columns added';
END $$;
