-- ============================================================
-- STOQLY ERP DEMO — COMPLETE DATABASE SCHEMA
-- ============================================================
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ============================================================
-- 0. FUNCIÓN GENÉRICA (sin referencias a tablas)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. PROFILES (primero — otras funciones lo referencian)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  email          TEXT,
  role           TEXT NOT NULL DEFAULT 'Sales'
                   CHECK (role IN ('Admin','Manager','Accountant','Sales','Warehouse')),
  warehouse_id   UUID,
  company_id     TEXT,
  discount_limit NUMERIC DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'Sales')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. HELPER FUNCTIONS (ahora profiles ya existe)
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_is_admin_or_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS profiles (ahora que las funciones existen)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.user_is_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (public.user_is_admin());

-- ============================================================
-- 3. COMPANIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  full_name               TEXT,
  address                 TEXT,
  city                    TEXT,
  country                 TEXT DEFAULT 'Maroc',
  phone                   TEXT,
  email                   TEXT,
  website                 TEXT,
  ice                     TEXT,
  rc                      TEXT,
  if_number               TEXT,
  cnss                    TEXT,
  patente                 TEXT,
  capital                 TEXT,
  bank_name               TEXT,
  rib                     TEXT,
  default_tax_rate        NUMERIC(5,4) DEFAULT 0.20,
  currency_symbol         TEXT DEFAULT 'MAD',
  logo                    TEXT,
  signature               TEXT,
  invoice_prefix          TEXT DEFAULT 'FAC',
  invoice_start           INTEGER DEFAULT 1001,
  tier_configs            JSONB,
  volume_tiers            JSONB,
  volume_discount_enabled BOOLEAN DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "companies_manage" ON public.companies;
CREATE POLICY "companies_manage" ON public.companies
  FOR ALL USING (public.user_is_admin());

DROP TRIGGER IF EXISTS companies_updated_at ON public.companies;
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. WAREHOUSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.warehouses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  location   TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('Central','Branch','Transit')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouses_select" ON public.warehouses;
CREATE POLICY "warehouses_select" ON public.warehouses
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "warehouses_manage" ON public.warehouses;
CREATE POLICY "warehouses_manage" ON public.warehouses
  FOR ALL USING (public.user_is_admin_or_manager());

DROP TRIGGER IF EXISTS on_warehouse_updated ON public.warehouses;
CREATE TRIGGER on_warehouse_updated BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 5. SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  contact    TEXT,
  email      TEXT,
  phone      TEXT,
  address    TEXT,
  city       TEXT,
  country    TEXT DEFAULT 'Maroc',
  ice        TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;
CREATE POLICY "suppliers_select" ON public.suppliers
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "suppliers_manage" ON public.suppliers;
CREATE POLICY "suppliers_manage" ON public.suppliers
  FOR ALL USING (public.user_is_admin_or_manager());

DROP TRIGGER IF EXISTS on_supplier_updated ON public.suppliers;
CREATE TRIGGER on_supplier_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 6. PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             TEXT NOT NULL UNIQUE,
  barcode         TEXT,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  viscosity       TEXT,
  pack_size       NUMERIC NOT NULL DEFAULT 1,
  unit            TEXT NOT NULL DEFAULT 'L',
  units_per_box   INTEGER DEFAULT 1 CHECK (units_per_box >= 1),
  price           NUMERIC NOT NULL CHECK (price >= 0),
  vip_price       NUMERIC CHECK (vip_price >= 0),
  points          NUMERIC DEFAULT 1,
  cost            NUMERIC NOT NULL DEFAULT 0 CHECK (cost >= 0),
  custom_tax_rate NUMERIC CHECK (custom_tax_rate >= 0 AND custom_tax_rate <= 100),
  supplier_id     UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_ref    TEXT,
  min_stock       NUMERIC DEFAULT 10,
  last_restock    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "products_manage" ON public.products;
CREATE POLICY "products_manage" ON public.products
  FOR ALL USING (public.user_is_admin_or_manager());

DROP TRIGGER IF EXISTS on_product_updated ON public.products;
CREATE TRIGGER on_product_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 7. STOCK LEVELS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock_levels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity     NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (product_id, warehouse_id)
);
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_select" ON public.stock_levels;
CREATE POLICY "stock_select" ON public.stock_levels
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "stock_manage" ON public.stock_levels;
CREATE POLICY "stock_manage" ON public.stock_levels
  FOR ALL USING (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS on_stock_updated ON public.stock_levels;
CREATE TRIGGER on_stock_updated BEFORE UPDATE ON public.stock_levels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 8. CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type           TEXT NOT NULL CHECK (type IN ('Individual','Professional')),
  name           TEXT NOT NULL,
  contact_person TEXT,
  email          TEXT,
  phone          TEXT,
  address        TEXT,
  city           TEXT,
  ice            TEXT,
  tax_id         TEXT,
  credit_limit   NUMERIC DEFAULT 0,
  notes          TEXT,
  latitude       NUMERIC,
  longitude      NUMERIC,
  company_id     TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  assigned_to    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select" ON public.customers;
CREATE POLICY "customers_select" ON public.customers
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "customers_manage" ON public.customers;
CREATE POLICY "customers_manage" ON public.customers
  FOR ALL USING (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS on_customer_updated ON public.customers;
CREATE TRIGGER on_customer_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 9. SALES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sales (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number         TEXT UNIQUE,
  delivery_note_number   TEXT UNIQUE,
  date                   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  warehouse_id           UUID NOT NULL REFERENCES public.warehouses(id),
  customer_id            UUID NOT NULL REFERENCES public.customers(id),
  customer_name          TEXT NOT NULL,
  customer_type          TEXT NOT NULL,
  source                 TEXT DEFAULT 'B2B' CHECK (source IN ('POS','B2B')),
  document_type          TEXT DEFAULT 'INVOICE'
                           CHECK (document_type IN ('TICKET','INVOICE','DELIVERY_NOTE','QUOTE')),
  company_id             TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  global_discount_type   TEXT CHECK (global_discount_type IN ('percentage','fixed')),
  global_discount_value  NUMERIC DEFAULT 0,
  global_discount_amount NUMERIC DEFAULT 0,
  items_subtotal         NUMERIC NOT NULL DEFAULT 0,
  subtotal_amount        NUMERIC NOT NULL CHECK (subtotal_amount >= 0),
  tax_rate               NUMERIC NOT NULL DEFAULT 0.20,
  tax_amount             NUMERIC NOT NULL CHECK (tax_amount >= 0),
  total_amount           NUMERIC NOT NULL CHECK (total_amount >= 0),
  amount_paid            NUMERIC NOT NULL DEFAULT 0,
  credited_amount        NUMERIC DEFAULT 0,
  payment_status         TEXT NOT NULL CHECK (payment_status IN ('Paid','Partial','Unpaid')),
  return_status          TEXT CHECK (return_status IN ('partial','full')),
  status                 TEXT NOT NULL DEFAULT 'Completed'
                           CHECK (status IN ('Completed','Pending','Cancelled')),
  created_by             UUID REFERENCES public.profiles(id),
  created_at             TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at             TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select" ON public.sales;
CREATE POLICY "sales_select" ON public.sales
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sales_insert" ON public.sales;
CREATE POLICY "sales_insert" ON public.sales
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sales_update" ON public.sales;
CREATE POLICY "sales_update" ON public.sales
  FOR UPDATE USING (public.user_is_admin_or_manager());

DROP POLICY IF EXISTS "sales_delete" ON public.sales;
CREATE POLICY "sales_delete" ON public.sales
  FOR DELETE USING (public.user_is_admin());

DROP TRIGGER IF EXISTS on_sale_updated ON public.sales;
CREATE TRIGGER on_sale_updated BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 10. SALE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sale_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id       UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id),
  product_name  TEXT NOT NULL,
  quantity      NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC NOT NULL CHECK (unit_price >= 0),
  discount      NUMERIC DEFAULT 0 CHECK (discount >= 0),
  discount_type TEXT DEFAULT 'percentage' CHECK (discount_type IN ('percentage','fixed')),
  sell_mode     TEXT DEFAULT 'unit' CHECK (sell_mode IN ('unit','box')),
  units_per_box INTEGER DEFAULT 1,
  stock_delta   NUMERIC,
  is_gift       BOOLEAN DEFAULT FALSE,
  total         NUMERIC NOT NULL CHECK (total >= 0),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sale_items_select" ON public.sale_items;
CREATE POLICY "sale_items_select" ON public.sale_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sale_items_manage" ON public.sale_items;
CREATE POLICY "sale_items_manage" ON public.sale_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 11. PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id        UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  date           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  amount         NUMERIC NOT NULL CHECK (amount > 0),
  method         TEXT NOT NULL
                   CHECK (method IN ('Cash','Check','Bank Transfer','Traite','Credit Card')),
  reference      TEXT,
  check_number   TEXT,
  bank_name      TEXT,
  due_date       DATE,
  payment_status TEXT DEFAULT 'Pending'
                   CHECK (payment_status IN ('Pending','Cashed','Bounced')),
  recorded_by    UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "payments_manage" ON public.payments;
CREATE POLICY "payments_manage" ON public.payments
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 12. TRANSFERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transfers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('INTERNAL','IMPORT','ADJUSTMENT')),
  from_warehouse_id UUID REFERENCES public.warehouses(id),
  to_warehouse_id   UUID REFERENCES public.warehouses(id),
  reference         TEXT NOT NULL,
  reason            TEXT,
  company_id        TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'Completed'
                      CHECK (status IN ('Completed','Pending')),
  created_by        UUID REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transfers_select" ON public.transfers;
CREATE POLICY "transfers_select" ON public.transfers
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "transfers_manage" ON public.transfers;
CREATE POLICY "transfers_manage" ON public.transfers
  FOR ALL USING (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS on_transfer_updated ON public.transfers;
CREATE TRIGGER on_transfer_updated BEFORE UPDATE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 13. TRANSFER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transfer_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id   UUID NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id),
  product_name  TEXT NOT NULL,
  quantity      NUMERIC NOT NULL CHECK (quantity > 0),
  boxes_entered NUMERIC,
  loose_entered NUMERIC,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.transfer_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transfer_items_select" ON public.transfer_items;
CREATE POLICY "transfer_items_select" ON public.transfer_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "transfer_items_manage" ON public.transfer_items;
CREATE POLICY "transfer_items_manage" ON public.transfer_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 14. RETURNS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.returns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date             TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  original_sale_id UUID NOT NULL REFERENCES public.sales(id),
  customer_id      UUID NOT NULL REFERENCES public.customers(id),
  customer_name    TEXT NOT NULL,
  warehouse_id     UUID NOT NULL REFERENCES public.warehouses(id),
  reason           TEXT NOT NULL,
  status           TEXT DEFAULT 'Pending'
                     CHECK (status IN ('Pending','Approved','Rejected')),
  credited_amount  NUMERIC DEFAULT 0,
  created_by       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "returns_select" ON public.returns;
CREATE POLICY "returns_select" ON public.returns
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "returns_manage" ON public.returns;
CREATE POLICY "returns_manage" ON public.returns
  FOR ALL USING (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS on_return_updated ON public.returns;
CREATE TRIGGER on_return_updated BEFORE UPDATE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 15. RETURN ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.return_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id    UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity     NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC NOT NULL DEFAULT 0,
  total        NUMERIC NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "return_items_select" ON public.return_items;
CREATE POLICY "return_items_select" ON public.return_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "return_items_manage" ON public.return_items;
CREATE POLICY "return_items_manage" ON public.return_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 16. PURCHASE ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number     TEXT UNIQUE,
  date          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  supplier_id   UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  warehouse_id  UUID REFERENCES public.warehouses(id),
  status        TEXT DEFAULT 'Draft'
                  CHECK (status IN ('Draft','Sent','Received','Cancelled')),
  total_amount  NUMERIC DEFAULT 0,
  notes         TEXT,
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_select" ON public.purchase_orders;
CREATE POLICY "po_select" ON public.purchase_orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "po_manage" ON public.purchase_orders;
CREATE POLICY "po_manage" ON public.purchase_orders
  FOR ALL USING (public.user_is_admin_or_manager());

DROP TRIGGER IF EXISTS on_po_updated ON public.purchase_orders;
CREATE TRIGGER on_po_updated BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 17. DOCUMENT COUNTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_counters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  TEXT NOT NULL,
  doc_type    TEXT NOT NULL,
  year        INTEGER NOT NULL,
  month       INTEGER,
  last_number INTEGER NOT NULL DEFAULT 0,
  UNIQUE (company_id, doc_type, year, month)
);
ALTER TABLE public.document_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "counters_select" ON public.document_counters;
CREATE POLICY "counters_select" ON public.document_counters
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "counters_manage" ON public.document_counters;
CREATE POLICY "counters_manage" ON public.document_counters
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 18. APP SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT UNIQUE NOT NULL,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON public.app_settings;
CREATE POLICY "settings_select" ON public.app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "settings_manage" ON public.app_settings;
CREATE POLICY "settings_manage" ON public.app_settings
  FOR ALL USING (public.user_is_admin());

-- ============================================================
-- 19. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id    UUID REFERENCES public.profiles(id),
  user_name  TEXT,
  user_role  TEXT,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  details    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select" ON public.audit_logs;
CREATE POLICY "audit_select" ON public.audit_logs
  FOR SELECT USING (public.user_is_admin_or_manager());

DROP POLICY IF EXISTS "audit_insert" ON public.audit_logs;
CREATE POLICY "audit_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_stock_product   ON public.stock_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_warehouse ON public.stock_levels(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer  ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_warehouse ON public.sales(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sales_date      ON public.sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_company   ON public.sales(company_id);
CREATE INDEX IF NOT EXISTS idx_si_sale         ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_si_product      ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_pay_sale        ON public.payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_tr_from         ON public.transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_tr_to           ON public.transfers(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_tr_date         ON public.transfers(date DESC);
CREATE INDEX IF NOT EXISTS idx_ti_transfer     ON public.transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_ti_product      ON public.transfer_items(product_id);
CREATE INDEX IF NOT EXISTS idx_ret_sale        ON public.returns(original_sale_id);
CREATE INDEX IF NOT EXISTS idx_audit_user      ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts        ON public.audit_logs(timestamp DESC);

-- ============================================================
-- RPC: Atomic stock update
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_stock_level(
  p_product_id   UUID,
  p_warehouse_id UUID,
  p_delta        NUMERIC,
  p_reason       TEXT,
  p_user_id      UUID
) RETURNS public.stock_levels AS $$
DECLARE
  v_stock   public.stock_levels;
  v_new_qty NUMERIC;
BEGIN
  SELECT * INTO v_stock
  FROM public.stock_levels
  WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
  FOR UPDATE;

  v_new_qty := COALESCE(v_stock.quantity, 0) + p_delta;

  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Insufficient stock: current=%, delta=%, result=%',
      COALESCE(v_stock.quantity, 0), p_delta, v_new_qty;
  END IF;

  INSERT INTO public.stock_levels (product_id, warehouse_id, quantity)
  VALUES (p_product_id, p_warehouse_id, v_new_qty)
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET quantity = v_new_qty, updated_at = NOW()
  RETURNING * INTO v_stock;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, details)
  VALUES (
    p_user_id, 'UPDATE', 'StockLevel', p_product_id::TEXT,
    format('Stock %s in warehouse %s: %s units (%s)',
      CASE WHEN p_delta > 0 THEN 'increased' ELSE 'decreased' END,
      (SELECT name FROM public.warehouses WHERE id = p_warehouse_id),
      abs(p_delta), p_reason)
  );

  RETURN v_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- DEMO DATA
-- ============================================================

INSERT INTO public.companies (id, name, full_name, address, city, country,
  phone, email, website, ice, rc, if_number,
  default_tax_rate, currency_symbol, invoice_prefix)
VALUES (
  'demo-company-001', 'Stoqly Demo', 'DEMO COMPANY SARL',
  '45 Bd. Hassan II, Zone Industrielle', 'Casablanca', 'Maroc',
  '+212 522 00 11 22', 'demo@stoqly.com', 'www.stoqly.com',
  '001234567000099', '234567', '8765432',
  0.20, 'MAD', 'FAC'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_settings (key, value) VALUES
  ('stock_migrated', 'true'),
  ('demo_mode',      'true')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.warehouses (id, name, location, type) VALUES
  ('aaaaaaaa-0001-0001-0001-000000000001', 'Almacén Central', 'Casablanca', 'Central'),
  ('aaaaaaaa-0001-0001-0001-000000000002', 'Sucursal Norte',  'Tánger',     'Branch'),
  ('aaaaaaaa-0001-0001-0001-000000000003', 'Sucursal Sur',    'Marrakech',  'Branch')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.suppliers (id, name, contact, email, phone, city, country)
VALUES (
  'bbbbbbbb-0001-0001-0001-000000000001',
  'Global Lubricants Supply', 'Ahmed Benali',
  'supply@globallub.com', '+212 600 11 22 33', 'Casablanca', 'Maroc'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products
  (id, sku, name, category, viscosity, pack_size, unit, units_per_box, price, cost, min_stock, supplier_id)
VALUES
  ('cccccccc-0001-0001-0001-000000000001','STQ-001','Ultra Plus 5W-30 1L',        'Huile Moteur',    '5W-30', 1,   'L', 12, 65.00, 42.00, 48,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000002','STQ-002','Ultra Plus 5W-30 5L',        'Huile Moteur',    '5W-30', 5,   'L',  4,185.00,130.00, 20,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000003','STQ-003','Leader Plus 10W-40 1L',      'Huile Moteur',   '10W-40', 1,   'L', 12, 55.00, 35.00, 48,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000004','STQ-004','Leader Plus 10W-40 5L',      'Huile Moteur',   '10W-40', 5,   'L',  4,155.00,105.00, 20,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000005','STQ-005','Antifreeze G11 1L',          'Additifs',          NULL, 1,   'L', 12, 35.00, 22.00, 36,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000006','STQ-006','Antifreeze G12+ 1L',         'Additifs',          NULL, 1,   'L', 12, 40.00, 26.00, 36,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000007','STQ-007','ATF Dexron III 1L',          'Transmission',      NULL, 1,   'L', 12, 75.00, 50.00, 24,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000008','STQ-008','DOT-4 Brake Fluid 500ml',    'Liquide de Frein',  NULL, 0.5, 'L', 24, 28.00, 17.00, 48,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000009','STQ-009','EP2 Grease 400g',            'Graisses',          NULL, 400, 'g', 12, 32.00, 20.00, 24,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000010','STQ-010','Ultra Synth 5W-30 Hybrid 5L','Huile Moteur',    '5W-30', 5,   'L',  4,220.00,160.00, 16,'bbbbbbbb-0001-0001-0001-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.stock_levels (product_id, warehouse_id, quantity) VALUES
  ('cccccccc-0001-0001-0001-000000000001','aaaaaaaa-0001-0001-0001-000000000001',144),
  ('cccccccc-0001-0001-0001-000000000002','aaaaaaaa-0001-0001-0001-000000000001', 60),
  ('cccccccc-0001-0001-0001-000000000003','aaaaaaaa-0001-0001-0001-000000000001',192),
  ('cccccccc-0001-0001-0001-000000000004','aaaaaaaa-0001-0001-0001-000000000001', 80),
  ('cccccccc-0001-0001-0001-000000000005','aaaaaaaa-0001-0001-0001-000000000001',216),
  ('cccccccc-0001-0001-0001-000000000006','aaaaaaaa-0001-0001-0001-000000000001',180),
  ('cccccccc-0001-0001-0001-000000000007','aaaaaaaa-0001-0001-0001-000000000001', 96),
  ('cccccccc-0001-0001-0001-000000000008','aaaaaaaa-0001-0001-0001-000000000001',240),
  ('cccccccc-0001-0001-0001-000000000009','aaaaaaaa-0001-0001-0001-000000000001',120),
  ('cccccccc-0001-0001-0001-000000000010','aaaaaaaa-0001-0001-0001-000000000001', 48),
  ('cccccccc-0001-0001-0001-000000000001','aaaaaaaa-0001-0001-0001-000000000002', 60),
  ('cccccccc-0001-0001-0001-000000000003','aaaaaaaa-0001-0001-0001-000000000002', 72),
  ('cccccccc-0001-0001-0001-000000000005','aaaaaaaa-0001-0001-0001-000000000002', 84),
  ('cccccccc-0001-0001-0001-000000000007','aaaaaaaa-0001-0001-0001-000000000002', 48),
  ('cccccccc-0001-0001-0001-000000000008','aaaaaaaa-0001-0001-0001-000000000002', 96)
ON CONFLICT (product_id, warehouse_id) DO NOTHING;

INSERT INTO public.customers
  (id, type, name, contact_person, email, phone, address, city, company_id)
VALUES
  ('dddddddd-0001-0001-0001-000000000001','Professional','AutoService Benali', 'Hassan Benali',  'hassan@autoservice.ma', '+212 600 11 11 11','12 Rue Anfa',      'Casablanca','demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000002','Professional','Garage El Fath',     'Youssef El Fath','youssef@elfath.ma',     '+212 600 22 22 22','34 Bd. Zerktouni', 'Casablanca','demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000003','Professional','Mécanique Nord SARL','Khalid Tazi',    'ktazi@meca-nord.ma',    '+212 600 33 33 33','5 Av. Mohamed V',  'Tánger',    'demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000004','Professional','Lubri Sud',          'Fatima Ouali',   'f.ouali@lubrisud.ma',   '+212 600 44 44 44','89 Rue Derb Omar', 'Marrakech', 'demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000005','Individual',  'Mohamed Rachidi',    NULL,              NULL,                   '+212 600 55 55 55','7 Hay Nahda',      'Casablanca','demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000006','Professional','Trans Auto Rabat',   'Omar Berrada',   'omar@transauto.ma',     '+212 600 66 66 66','23 Av. Allal',     'Rabat',     'demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000007','Professional','FleetPro Services',  'Sara Idrissi',   's.idrissi@fleetpro.ma', '+212 600 77 77 77','56 Bd. Massira',   'Casablanca','demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000008','Individual',  'Karim Alaoui',       NULL,              NULL,                   '+212 600 88 88 88','14 Rue Imam',      'Tánger',    'demo-company-001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- END — paste into Supabase SQL Editor and click Run
-- ============================================================
