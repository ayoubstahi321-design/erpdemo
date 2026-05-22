-- ============================================================================
-- Migration: Add supplier_id and supplier_ref columns to products table
-- Purpose: Link each product to its default supplier and store the supplier's
--          own product reference code (for ordering and catalogue sorting).
-- Run ONCE in Supabase SQL Editor.
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier_id  TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products(supplier_id);

DO $$
BEGIN
  RAISE NOTICE 'products: supplier_id and supplier_ref columns added';
END $$;
