-- ============================================
-- Migration: Suppliers & Purchase Orders
-- Run this in Supabase SQL Editor BEFORE using the feature
-- ============================================

-- Table: suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  ice TEXT,
  tax_id TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company suppliers"
  ON suppliers FOR SELECT
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company suppliers"
  ON suppliers FOR INSERT
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company suppliers"
  ON suppliers FOR UPDATE
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company suppliers"
  ON suppliers FOR DELETE
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Table: purchase_orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  reference TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  supplier_name TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Received', 'Cancelled')),
  items JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_company ON purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company purchase orders"
  ON purchase_orders FOR SELECT
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company purchase orders"
  ON purchase_orders FOR INSERT
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company purchase orders"
  ON purchase_orders FOR UPDATE
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company purchase orders"
  ON purchase_orders FOR DELETE
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_suppliers_updated_at();

CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_purchase_orders_updated_at();
