-- ========================================
-- AZMOL STOCK ERP - SIMPLIFIED SCHEMA (Sin recursión RLS)
-- ========================================
-- Ejecutar este script en: Supabase Dashboard > SQL Editor > New Query
-- ========================================

-- ========================================
-- 1. TABLA: profiles (Usuarios)
-- ========================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'Sales' CHECK (role IN ('Admin', 'Manager', 'Sales', 'Delivery', 'Cashier')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS simplificadas (sin recursión)
DROP POLICY IF EXISTS "Allow authenticated read" ON profiles;
CREATE POLICY "Allow authenticated read" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated write" ON profiles;
CREATE POLICY "Allow authenticated write" ON profiles
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- 2. TABLA: warehouses (Almacenes)
-- ========================================
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Central', 'Branch', 'Transit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON warehouses;
CREATE POLICY "Allow authenticated access" ON warehouses
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- 3. TABLA: customers (Clientes)
-- ========================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('Individual', 'Professional')),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  ice TEXT,
  tax_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON customers;
CREATE POLICY "Allow authenticated access" ON customers
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- 4. TABLA: products (Productos)
-- ========================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  viscosity TEXT,
  pack_size NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  cost NUMERIC NOT NULL CHECK (cost >= 0),
  custom_tax_rate NUMERIC CHECK (custom_tax_rate >= 0 AND custom_tax_rate <= 100),
  min_stock NUMERIC DEFAULT 10,
  last_restock TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON products;
CREATE POLICY "Allow authenticated access" ON products
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- 5. TABLA: stock_levels (Niveles de Stock por Almacén)
-- ========================================
CREATE TABLE IF NOT EXISTS stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(product_id, warehouse_id)
);

ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON stock_levels;
CREATE POLICY "Allow authenticated access" ON stock_levels
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- 6. TABLA: sales (Ventas)
-- ========================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number TEXT UNIQUE,
  date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  customer_type TEXT NOT NULL,
  subtotal_amount NUMERIC NOT NULL CHECK (subtotal_amount >= 0),
  tax_rate NUMERIC NOT NULL DEFAULT 0.20,
  tax_amount NUMERIC NOT NULL CHECK (tax_amount >= 0),
  total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('Paid', 'Partial', 'Unpaid')),
  credited_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Completed', 'Pending', 'Cancelled')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON sales;
CREATE POLICY "Allow authenticated access" ON sales
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- 7. TABLA: sale_items (Items de Venta)
-- ========================================
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  discount NUMERIC DEFAULT 0 CHECK (discount >= 0 AND discount <= 100),
  total NUMERIC NOT NULL CHECK (total >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON sale_items;
CREATE POLICY "Allow authenticated access" ON sale_items
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- 8. TABLA: payments (Pagos)
-- ========================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('Cash', 'Check', 'Bank Transfer', 'Traite', 'Credit Card')),
  reference TEXT,
  recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON payments;
CREATE POLICY "Allow authenticated access" ON payments
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- 9. TABLA: transfers (Transferencias)
-- ========================================
CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('INTERNAL', 'IMPORT', 'ADJUSTMENT')),
  from_warehouse_id UUID REFERENCES warehouses(id),
  to_warehouse_id UUID REFERENCES warehouses(id),
  reference TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Completed', 'Pending')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON transfers;
CREATE POLICY "Allow authenticated access" ON transfers
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- 10. TABLA: transfer_items (Items de Transferencia)
-- ========================================
CREATE TABLE IF NOT EXISTS transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON transfer_items;
CREATE POLICY "Allow authenticated access" ON transfer_items
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- 11. TABLA: returns (Devoluciones)
-- ========================================
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  original_sale_id UUID NOT NULL REFERENCES sales(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  reason TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON returns;
CREATE POLICY "Allow authenticated access" ON returns
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- 12. TABLA: return_items (Items de Devolución)
-- ========================================
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total NUMERIC NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON return_items;
CREATE POLICY "Allow authenticated access" ON return_items
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- 13. TABLA: audit_logs (Registro de Auditoría)
-- ========================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  user_id UUID REFERENCES profiles(id),
  user_name TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON audit_logs;
CREATE POLICY "Allow authenticated access" ON audit_logs
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- 14. TABLA: company_settings (Configuración de la Empresa)
-- ========================================
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON company_settings;
CREATE POLICY "Allow authenticated access" ON company_settings
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- TRIGGERS: Auto-update timestamps
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DROP TRIGGER IF EXISTS on_profile_updated ON profiles;
CREATE TRIGGER on_profile_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_warehouse_updated ON warehouses;
CREATE TRIGGER on_warehouse_updated BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_customer_updated ON customers;
CREATE TRIGGER on_customer_updated BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_product_updated ON products;
CREATE TRIGGER on_product_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_stock_level_updated ON stock_levels;
CREATE TRIGGER on_stock_level_updated BEFORE UPDATE ON stock_levels
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_sale_updated ON sales;
CREATE TRIGGER on_sale_updated BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_transfer_updated ON transfers;
CREATE TRIGGER on_transfer_updated BEFORE UPDATE ON transfers
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_company_settings_updated ON company_settings;
CREATE TRIGGER on_company_settings_updated BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ========================================
-- TRIGGER: Auto-create profile on user signup
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Sales')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- ========================================
-- ÍNDICES para mejor performance
-- ========================================
CREATE INDEX IF NOT EXISTS idx_stock_levels_product ON stock_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_warehouse ON stock_levels(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_warehouse ON sales(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_warehouse ON transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_warehouse ON transfers(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- ========================================
-- FUNCIÓN: update_stock_level (Actualización atómica de stock)
-- ========================================
CREATE OR REPLACE FUNCTION update_stock_level(
  p_product_id UUID,
  p_warehouse_id UUID,
  p_delta NUMERIC,
  p_reason TEXT,
  p_user_id UUID
) RETURNS stock_levels AS $$
DECLARE
  v_stock stock_levels;
  v_new_quantity NUMERIC;
BEGIN
  -- Lock row para evitar race conditions
  SELECT * INTO v_stock
  FROM stock_levels
  WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
  FOR UPDATE;

  -- Calcular nueva cantidad
  IF v_stock.id IS NULL THEN
    v_new_quantity := p_delta;
  ELSE
    v_new_quantity := COALESCE(v_stock.quantity, 0) + p_delta;
  END IF;

  -- Validar stock no negativo
  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente: actual=%, delta=%, resultado=%',
      COALESCE(v_stock.quantity, 0), p_delta, v_new_quantity;
  END IF;

  -- Upsert stock level
  INSERT INTO stock_levels (product_id, warehouse_id, quantity)
  VALUES (p_product_id, p_warehouse_id, v_new_quantity)
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET
    quantity = v_new_quantity,
    updated_at = TIMEZONE('utc'::text, NOW())
  RETURNING * INTO v_stock;

  -- Audit log
  INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
  VALUES (
    p_user_id,
    'UPDATE',
    'StockLevel',
    p_product_id::TEXT,
    format('Stock %s en almacén %s: %s unidades (%s)',
      CASE WHEN p_delta > 0 THEN 'aumentado' ELSE 'reducido' END,
      (SELECT name FROM warehouses WHERE id = p_warehouse_id),
      abs(p_delta),
      p_reason
    )
  );

  RETURN v_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_stock_level IS 'Actualiza stock de forma atómica con validación y audit log';

-- ========================================
-- DATOS INICIALES
-- ========================================

-- Almacenes por defecto
INSERT INTO warehouses (id, name, location, type) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Almacén Central', 'Casablanca', 'Central'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Sucursal Rabat', 'Rabat', 'Branch'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Almacén Tánger', 'Tánger', 'Branch')
ON CONFLICT (id) DO NOTHING;

-- Datos iniciales de configuración
INSERT INTO company_settings (key, value) VALUES
  ('company_info', '{
    "name": "Azmol British Petrochemicals",
    "address": "Casablanca, Morocco",
    "phone": "+212 XXX XXX XXX",
    "email": "contact@azmol.ma",
    "ice": "XXXXXXXXX",
    "rc": "XXXXXXX",
    "patent": "XXXXXXX",
    "cnss": "XXXXXXX",
    "invoicePrefix": "AZ",
    "invoiceStartNumber": 1001,
    "taxRate": 20
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- FIN DEL SCRIPT
-- ========================================
