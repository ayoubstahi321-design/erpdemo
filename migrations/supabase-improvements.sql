-- ========================================
-- AZMOL STOCK ERP - MEJORAS Y NUEVAS FUNCIONALIDADES
-- ========================================
-- Ejecutar este script en: Supabase Dashboard > SQL Editor > New Query
-- ========================================

-- ========================================
-- 1. HISTORIAL DE CAMBIOS DE PRECIOS
-- ========================================

-- Tabla para registrar todos los cambios de precio
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price NUMERIC(10, 2) NOT NULL,
  new_price NUMERIC(10, 2) NOT NULL,
  old_cost NUMERIC(10, 2),
  new_cost NUMERIC(10, 2),
  changed_by UUID NOT NULL REFERENCES profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  reason TEXT,

  -- Índices para búsquedas rápidas
  INDEX idx_price_history_product (product_id),
  INDEX idx_price_history_date (changed_at DESC)
);

-- Habilitar RLS
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Authenticated users can view price history" ON price_history;
CREATE POLICY "Authenticated users can view price history" ON price_history
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "System can insert price history" ON price_history;
CREATE POLICY "System can insert price history" ON price_history
  FOR INSERT WITH CHECK (true);

-- Función para registrar cambios de precio automáticamente
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo registrar si el precio o el costo cambiaron
  IF (OLD.price IS DISTINCT FROM NEW.price) OR (OLD.cost IS DISTINCT FROM NEW.cost) THEN
    INSERT INTO price_history (
      product_id,
      old_price,
      new_price,
      old_cost,
      new_cost,
      changed_by,
      reason
    ) VALUES (
      NEW.id,
      COALESCE(OLD.price, 0),
      COALESCE(NEW.price, 0),
      COALESCE(OLD.cost, 0),
      COALESCE(NEW.cost, 0),
      auth.uid(),
      'Product update'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para registrar cambios de precio
DROP TRIGGER IF EXISTS trigger_log_price_change ON products;
CREATE TRIGGER trigger_log_price_change
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (OLD.price IS DISTINCT FROM NEW.price OR OLD.cost IS DISTINCT FROM NEW.cost)
  EXECUTE FUNCTION log_price_change();

-- ========================================
-- 2. SISTEMA DE DESCUENTOS AVANZADO
-- ========================================

-- Tabla para descuentos por volumen
CREATE TABLE IF NOT EXISTS volume_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  category TEXT, -- Si product_id es NULL, aplica a toda la categoría
  min_quantity NUMERIC(10, 2) NOT NULL,
  max_quantity NUMERIC(10, 2), -- NULL = sin límite superior
  discount_percentage NUMERIC(5, 2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  discount_fixed NUMERIC(10, 2) CHECK (discount_fixed >= 0),
  active BOOLEAN DEFAULT true,
  valid_from DATE,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  -- Restricción: debe tener product_id o category, no ambos
  CONSTRAINT check_product_or_category CHECK (
    (product_id IS NOT NULL AND category IS NULL) OR
    (product_id IS NULL AND category IS NOT NULL)
  ),

  -- Restricción: debe tener percentage o fixed, no ambos
  CONSTRAINT check_discount_type CHECK (
    (discount_percentage IS NOT NULL AND discount_fixed IS NULL) OR
    (discount_percentage IS NULL AND discount_fixed IS NOT NULL)
  ),

  INDEX idx_volume_discounts_product (product_id),
  INDEX idx_volume_discounts_category (category),
  INDEX idx_volume_discounts_active (active)
);

ALTER TABLE volume_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view volume discounts" ON volume_discounts;
CREATE POLICY "Authenticated users can view volume discounts" ON volume_discounts
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage volume discounts" ON volume_discounts;
CREATE POLICY "Admins can manage volume discounts" ON volume_discounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  );

-- Tabla para descuentos por tipo de cliente
CREATE TABLE IF NOT EXISTS customer_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_type TEXT, -- Si customer_id es NULL, aplica a todo el tipo
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  category TEXT, -- Si product_id es NULL, aplica a toda la categoría
  discount_percentage NUMERIC(5, 2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  active BOOLEAN DEFAULT true,
  valid_from DATE,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  -- Restricción: debe tener customer_id o customer_type, no ambos
  CONSTRAINT check_customer_or_type CHECK (
    (customer_id IS NOT NULL AND customer_type IS NULL) OR
    (customer_id IS NULL AND customer_type IS NOT NULL)
  ),

  -- Restricción: debe tener product_id o category
  CONSTRAINT check_product_or_category_customer CHECK (
    (product_id IS NOT NULL AND category IS NULL) OR
    (product_id IS NULL AND category IS NOT NULL) OR
    (product_id IS NULL AND category IS NULL) -- Puede aplicar a todos los productos
  ),

  INDEX idx_customer_discounts_customer (customer_id),
  INDEX idx_customer_discounts_product (product_id),
  INDEX idx_customer_discounts_active (active)
);

ALTER TABLE customer_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view customer discounts" ON customer_discounts;
CREATE POLICY "Authenticated users can view customer discounts" ON customer_discounts
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage customer discounts" ON customer_discounts;
CREATE POLICY "Admins can manage customer discounts" ON customer_discounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  );

-- Tabla para promociones temporales
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  category TEXT,
  discount_percentage NUMERIC(5, 2) CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  discount_fixed NUMERIC(10, 2) CHECK (discount_fixed >= 0),
  min_purchase_amount NUMERIC(10, 2), -- Monto mínimo de compra para aplicar promoción
  active BOOLEAN DEFAULT true,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  -- Restricción: debe tener percentage o fixed
  CONSTRAINT check_promotion_discount_type CHECK (
    (discount_percentage IS NOT NULL AND discount_fixed IS NULL) OR
    (discount_percentage IS NULL AND discount_fixed IS NOT NULL)
  ),

  INDEX idx_promotions_product (product_id),
  INDEX idx_promotions_active (active),
  INDEX idx_promotions_dates (valid_from, valid_until)
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view promotions" ON promotions;
CREATE POLICY "Authenticated users can view promotions" ON promotions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage promotions" ON promotions;
CREATE POLICY "Admins can manage promotions" ON promotions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  );

-- ========================================
-- 3. FUNCIÓN PARA CALCULAR DESCUENTO APLICABLE
-- ========================================

CREATE OR REPLACE FUNCTION get_applicable_discount(
  p_product_id UUID,
  p_customer_id UUID,
  p_quantity NUMERIC,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  discount_type TEXT,
  discount_value NUMERIC,
  discount_source TEXT
) AS $$
DECLARE
  v_customer_type TEXT;
  v_product_category TEXT;
  v_current_date DATE := CURRENT_DATE;
BEGIN
  -- Obtener tipo de cliente
  SELECT type INTO v_customer_type FROM customers WHERE id = p_customer_id;

  -- Obtener categoría del producto si no se proporcionó
  IF p_category IS NULL THEN
    SELECT category INTO v_product_category FROM products WHERE id = p_product_id;
  ELSE
    v_product_category := p_category;
  END IF;

  -- Prioridad 1: Descuento específico para cliente + producto
  RETURN QUERY
  SELECT
    'percentage'::TEXT,
    discount_percentage,
    'customer_specific'::TEXT
  FROM customer_discounts
  WHERE customer_id = p_customer_id
    AND product_id = p_product_id
    AND active = true
    AND (valid_from IS NULL OR valid_from <= v_current_date)
    AND (valid_until IS NULL OR valid_until >= v_current_date)
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Prioridad 2: Promoción activa para el producto
  RETURN QUERY
  SELECT
    CASE
      WHEN discount_percentage IS NOT NULL THEN 'percentage'::TEXT
      ELSE 'fixed'::TEXT
    END,
    COALESCE(discount_percentage, discount_fixed),
    'promotion'::TEXT
  FROM promotions
  WHERE product_id = p_product_id
    AND active = true
    AND valid_from <= v_current_date
    AND valid_until >= v_current_date
  ORDER BY COALESCE(discount_percentage, discount_fixed) DESC
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Prioridad 3: Descuento por volumen
  RETURN QUERY
  SELECT
    CASE
      WHEN discount_percentage IS NOT NULL THEN 'percentage'::TEXT
      ELSE 'fixed'::TEXT
    END,
    COALESCE(discount_percentage, discount_fixed),
    'volume'::TEXT
  FROM volume_discounts
  WHERE (product_id = p_product_id OR (product_id IS NULL AND category = v_product_category))
    AND active = true
    AND min_quantity <= p_quantity
    AND (max_quantity IS NULL OR max_quantity >= p_quantity)
    AND (valid_from IS NULL OR valid_from <= v_current_date)
    AND (valid_until IS NULL OR valid_until >= v_current_date)
  ORDER BY COALESCE(discount_percentage, discount_fixed) DESC
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Prioridad 4: Descuento por tipo de cliente
  RETURN QUERY
  SELECT
    'percentage'::TEXT,
    discount_percentage,
    'customer_type'::TEXT
  FROM customer_discounts
  WHERE customer_type = v_customer_type
    AND (product_id = p_product_id OR category = v_product_category OR (product_id IS NULL AND category IS NULL))
    AND active = true
    AND (valid_from IS NULL OR valid_from <= v_current_date)
    AND (valid_until IS NULL OR valid_until >= v_current_date)
  ORDER BY discount_percentage DESC
  LIMIT 1;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 4. CONFIGURACIÓN DE REALTIME
-- ========================================

-- Habilitar realtime para tablas principales
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_levels;
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE sale_items;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE warehouses;
ALTER PUBLICATION supabase_realtime ADD TABLE price_history;
ALTER PUBLICATION supabase_realtime ADD TABLE volume_discounts;
ALTER PUBLICATION supabase_realtime ADD TABLE customer_discounts;
ALTER PUBLICATION supabase_realtime ADD TABLE promotions;

-- ========================================
-- 5. TABLA PARA CONFIGURACIÓN DE NOTIFICACIONES
-- ========================================

CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'low_stock',
    'payment_due',
    'payment_received',
    'new_sale',
    'price_change',
    'stock_update'
  )),
  enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,
  sms_enabled BOOLEAN DEFAULT false,
  email_address TEXT,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  UNIQUE(user_id, notification_type)
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own notification settings" ON notification_settings;
CREATE POLICY "Users can manage own notification settings" ON notification_settings
  FOR ALL USING (auth.uid() = user_id);

-- Tabla para registro de notificaciones enviadas
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push')),
  recipient TEXT NOT NULL, -- email o número de teléfono
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  INDEX idx_notification_log_user (user_id),
  INDEX idx_notification_log_status (status),
  INDEX idx_notification_log_sent_at (sent_at DESC)
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view notification log" ON notification_log;
CREATE POLICY "Admins can view notification log" ON notification_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  );

DROP POLICY IF EXISTS "Users can view own notification log" ON notification_log;
CREATE POLICY "Users can view own notification log" ON notification_log
  FOR SELECT USING (auth.uid() = user_id);

-- ========================================
-- 6. ÍNDICES ADICIONALES PARA PERFORMANCE
-- ========================================

-- Índices para mejorar búsquedas en sales
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_warehouse ON sales(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);

-- Índices para sale_items
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- Índices para products
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Índices compuestos para stock_levels
CREATE INDEX IF NOT EXISTS idx_stock_levels_product_warehouse ON stock_levels(product_id, warehouse_id);

-- ========================================
-- FIN DEL SCRIPT
-- ========================================

-- Mostrar resumen de tablas creadas
SELECT
  'price_history' as tabla,
  count(*) as registros
FROM price_history
UNION ALL
SELECT 'volume_discounts', count(*) FROM volume_discounts
UNION ALL
SELECT 'customer_discounts', count(*) FROM customer_discounts
UNION ALL
SELECT 'promotions', count(*) FROM promotions
UNION ALL
SELECT 'notification_settings', count(*) FROM notification_settings
UNION ALL
SELECT 'notification_log', count(*) FROM notification_log;
