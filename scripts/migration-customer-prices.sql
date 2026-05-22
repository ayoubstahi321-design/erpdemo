-- ============================================
-- Migration: Customer-Specific Pricing
-- Run this in Supabase SQL Editor BEFORE using the feature
-- ============================================

-- Table: customer_prices
-- Stores special prices per customer/product combination
CREATE TABLE IF NOT EXISTS customer_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  special_price NUMERIC(12,2),          -- Fixed special price (NULL = use discount instead)
  discount_percentage NUMERIC(5,2),      -- Discount % off regular price (NULL = use special_price)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Each customer can only have one special price per product
  CONSTRAINT unique_customer_product UNIQUE (company_id, customer_id, product_id),

  -- At least one pricing method must be set
  CONSTRAINT price_or_discount CHECK (special_price IS NOT NULL OR discount_percentage IS NOT NULL)
);

-- Index for fast lookup by customer
CREATE INDEX IF NOT EXISTS idx_customer_prices_customer ON customer_prices(company_id, customer_id);

-- Index for fast lookup by product
CREATE INDEX IF NOT EXISTS idx_customer_prices_product ON customer_prices(company_id, product_id);

-- Enable RLS
ALTER TABLE customer_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policy: users can only see prices from their company
CREATE POLICY "Users can view own company customer prices"
  ON customer_prices
  FOR SELECT
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company customer prices"
  ON customer_prices
  FOR INSERT
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company customer prices"
  ON customer_prices
  FOR UPDATE
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company customer prices"
  ON customer_prices
  FOR DELETE
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION trg_cp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cp_set_updated_at
  BEFORE UPDATE ON customer_prices
  FOR EACH ROW
  EXECUTE FUNCTION trg_cp_updated_at();
