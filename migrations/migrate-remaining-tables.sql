-- ========================================
-- MIGRACIÓN FINAL - TABLAS RESTANTES
-- ========================================
-- Ejecutar este script en: Supabase Dashboard > SQL Editor > New Query
-- Este script completa la migración al 100%
-- ========================================

-- ========================================
-- 1. TABLA: audit_logs (Registros de Auditoría)
-- ========================================

-- Eliminar tabla existente si tiene estructura incorrecta
DROP TABLE IF EXISTS audit_logs CASCADE;

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  user_id UUID REFERENCES profiles(id),
  user_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'CREATE', 'UPDATE', 'DELETE',
    'LOGIN', 'LOGOUT',
    'SALE_CREATED', 'PAYMENT_RECEIVED',
    'TRANSFER_CREATED', 'RETURN_PROCESSED',
    'PRODUCT_ADDED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED',
    'CUSTOMER_ADDED', 'CUSTOMER_UPDATED', 'CUSTOMER_DELETED',
    'STOCK_ADJUSTED', 'PRICE_CHANGED'
  )),
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'User', 'Product', 'Customer', 'Sale', 'Payment',
    'Transfer', 'Return', 'Warehouse', 'Stock', 'Price'
  )),
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Crear índices para audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Habilitar RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  );

DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;
CREATE POLICY "Users can view own audit logs" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- ========================================
-- 2. VERIFICAR TABLAS TRANSFERS Y RETURNS
-- ========================================

-- Estas tablas ya deberían existir del schema completo
-- Si no existen, las creamos ahora

-- Verificar transfers
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transfers') THEN
    RAISE NOTICE 'Creating transfers table...';

    CREATE TABLE transfers (
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

    CREATE POLICY "Authenticated users can view transfers" ON transfers
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "Authorized users can manage transfers" ON transfers
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Delivery')
        )
      );
  ELSE
    RAISE NOTICE 'transfers table already exists';
  END IF;
END $$;

-- Verificar transfer_items
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transfer_items') THEN
    RAISE NOTICE 'Creating transfer_items table...';

    CREATE TABLE transfer_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity NUMERIC NOT NULL CHECK (quantity > 0),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
    );

    ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Authenticated users can view transfer items" ON transfer_items
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "Authorized users can manage transfer items" ON transfer_items
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Delivery')
        )
      );
  ELSE
    RAISE NOTICE 'transfer_items table already exists';
  END IF;
END $$;

-- Verificar returns
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'returns') THEN
    RAISE NOTICE 'Creating returns table...';

    CREATE TABLE returns (
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

    CREATE POLICY "Authenticated users can view returns" ON returns
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "Authorized users can manage returns" ON returns
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales')
        )
      );
  ELSE
    RAISE NOTICE 'returns table already exists';
  END IF;
END $$;

-- Verificar return_items
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'return_items') THEN
    RAISE NOTICE 'Creating return_items table...';

    CREATE TABLE return_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity NUMERIC NOT NULL CHECK (quantity > 0),
      unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
      total NUMERIC NOT NULL CHECK (total >= 0),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
    );

    ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Authenticated users can view return items" ON return_items
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "Authorized users can manage return items" ON return_items
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales')
        )
      );
  ELSE
    RAISE NOTICE 'return_items table already exists';
  END IF;
END $$;

-- ========================================
-- 3. HABILITAR REALTIME
-- ========================================

-- Agregar tablas restantes a realtime
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE transfer_items;
ALTER PUBLICATION supabase_realtime ADD TABLE returns;
ALTER PUBLICATION supabase_realtime ADD TABLE return_items;

-- ========================================
-- 4. ÍNDICES ADICIONALES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_warehouses ON transfers(from_warehouse_id, to_warehouse_id);

CREATE INDEX IF NOT EXISTS idx_returns_date ON returns(date DESC);
CREATE INDEX IF NOT EXISTS idx_returns_sale ON returns(original_sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_customer ON returns(customer_id);

-- ========================================
-- 5. TRIGGERS PARA AUDITORÍA AUTOMÁTICA
-- ========================================

-- Función para registrar logs automáticamente
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
BEGIN
  -- Mapear nombre de tabla a tipo de entidad
  v_entity_type := CASE TG_TABLE_NAME
    WHEN 'profiles' THEN 'User'
    WHEN 'products' THEN 'Product'
    WHEN 'customers' THEN 'Customer'
    WHEN 'sales' THEN 'Sale'
    WHEN 'payments' THEN 'Payment'
    WHEN 'transfers' THEN 'Transfer'
    WHEN 'returns' THEN 'Return'
    WHEN 'warehouses' THEN 'Warehouse'
    WHEN 'stock_levels' THEN 'Stock'
    WHEN 'price_history' THEN 'Price'
    ELSE 'User' -- Valor por defecto
  END;

  -- Registrar evento de auditoría
  INSERT INTO audit_logs (
    user_id,
    user_name,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    auth.uid(),
    COALESCE((SELECT name FROM profiles WHERE id = auth.uid()), 'System'),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'CREATE'
      WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
      WHEN TG_OP = 'DELETE' THEN 'DELETE'
    END,
    v_entity_type,
    COALESCE(NEW.id::TEXT, OLD.id::TEXT),
    jsonb_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers para auditoría en tablas críticas (opcional - puede generar muchos logs)
-- Puedes comentar/descomentar según necesites

-- DROP TRIGGER IF EXISTS trigger_audit_products ON products;
-- CREATE TRIGGER trigger_audit_products
--   AFTER INSERT OR UPDATE OR DELETE ON products
--   FOR EACH ROW
--   EXECUTE FUNCTION log_audit_event();

-- DROP TRIGGER IF EXISTS trigger_audit_transfers ON transfers;
-- CREATE TRIGGER trigger_audit_transfers
--   AFTER INSERT OR UPDATE OR DELETE ON transfers
--   FOR EACH ROW
--   EXECUTE FUNCTION log_audit_event();

-- DROP TRIGGER IF EXISTS trigger_audit_returns ON returns;
-- CREATE TRIGGER trigger_audit_returns
--   AFTER INSERT OR UPDATE OR DELETE ON returns
--   FOR EACH ROW
--   EXECUTE FUNCTION log_audit_event();

-- ========================================
-- 6. VERIFICACIÓN FINAL
-- ========================================

-- Mostrar resumen de tablas creadas/verificadas
SELECT
  'audit_logs' as tabla,
  count(*) as registros,
  'NUEVA' as estado
FROM audit_logs
UNION ALL
SELECT
  'transfers',
  count(*),
  CASE WHEN count(*) > 0 THEN 'CON DATOS' ELSE 'VACÍA' END
FROM transfers
UNION ALL
SELECT
  'transfer_items',
  count(*),
  CASE WHEN count(*) > 0 THEN 'CON DATOS' ELSE 'VACÍA' END
FROM transfer_items
UNION ALL
SELECT
  'returns',
  count(*),
  CASE WHEN count(*) > 0 THEN 'CON DATOS' ELSE 'VACÍA' END
FROM returns
UNION ALL
SELECT
  'return_items',
  count(*),
  CASE WHEN count(*) > 0 THEN 'CON DATOS' ELSE 'VACÍA' END
FROM return_items;

-- ========================================
-- FIN DEL SCRIPT
-- ========================================

-- Mensaje final
DO $$
BEGIN
  RAISE NOTICE '✅ Migración completada!';
  RAISE NOTICE '✅ Tablas creadas/verificadas: audit_logs, transfers, transfer_items, returns, return_items';
  RAISE NOTICE '✅ RLS habilitado en todas las tablas';
  RAISE NOTICE '✅ Realtime configurado';
  RAISE NOTICE '✅ Índices creados para performance';
  RAISE NOTICE '📝 Siguiente paso: Implementar los hooks en la aplicación React';
END $$;
