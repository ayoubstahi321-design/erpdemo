-- ========================================
-- AZMOL STOCK ERP - CORRECCIÓN FINAL COMPLETA
-- ========================================
-- EJECUTAR EN: Supabase Dashboard > SQL Editor > New Query
-- Este script corrige TODOS los problemas de una vez
-- ========================================

-- ========================================
-- PASO 1: CORREGIR TABLA audit_logs
-- ========================================

-- Verificar si falta la columna 'entity'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'entity'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN entity TEXT NOT NULL DEFAULT 'Unknown';
    RAISE NOTICE 'Columna entity agregada a audit_logs';
  ELSE
    RAISE NOTICE 'Columna entity ya existe en audit_logs';
  END IF;
END $$;

-- Asegurar que todas las columnas existen
ALTER TABLE audit_logs
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN entity SET NOT NULL,
  ALTER COLUMN entity_id SET NOT NULL,
  ALTER COLUMN details SET NOT NULL;

-- ========================================
-- PASO 2: VERIFICAR FUNCIÓN update_stock_level
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

-- ========================================
-- PASO 3: TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA DE STOCK
-- ========================================

-- TRIGGER 1: Transferencias/Recepciones/Ajustes
CREATE OR REPLACE FUNCTION handle_transfer_items_stock_update()
RETURNS TRIGGER AS $$
DECLARE
  v_transfer_record transfers;
  v_user_id UUID;
BEGIN
  SELECT * INTO v_transfer_record FROM transfers WHERE id = NEW.transfer_id;
  v_user_id := COALESCE(v_transfer_record.created_by, '00000000-0000-0000-0000-000000000000'::UUID);

  IF v_transfer_record.status = 'Completed' THEN
    -- TRANSFERENCIA INTERNA
    IF v_transfer_record.type = 'INTERNAL' THEN
      PERFORM update_stock_level(NEW.product_id, v_transfer_record.from_warehouse_id, -NEW.quantity, 'Transferencia interna', v_user_id);
      PERFORM update_stock_level(NEW.product_id, v_transfer_record.to_warehouse_id, NEW.quantity, 'Transferencia interna', v_user_id);

    -- RECEPCIÓN DE CONTENEDOR
    ELSIF v_transfer_record.type = 'IMPORT' THEN
      PERFORM update_stock_level(NEW.product_id, v_transfer_record.to_warehouse_id, NEW.quantity, format('Recepción contenedor - Ref: %s', v_transfer_record.reference), v_user_id);

    -- AJUSTE DE INVENTARIO
    ELSIF v_transfer_record.type = 'ADJUSTMENT' THEN
      IF v_transfer_record.reference LIKE 'ADJ+%' THEN
        PERFORM update_stock_level(NEW.product_id, v_transfer_record.to_warehouse_id, NEW.quantity, format('Ajuste (+): %s', COALESCE(v_transfer_record.reason, 'N/A')), v_user_id);
      ELSE
        PERFORM update_stock_level(NEW.product_id, v_transfer_record.to_warehouse_id, -NEW.quantity, format('Ajuste (-): %s', COALESCE(v_transfer_record.reason, 'N/A')), v_user_id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_stock_on_transfer_item ON transfer_items;
CREATE TRIGGER trigger_update_stock_on_transfer_item
  AFTER INSERT ON transfer_items
  FOR EACH ROW EXECUTE FUNCTION handle_transfer_items_stock_update();

-- TRIGGER 2: Ventas
CREATE OR REPLACE FUNCTION handle_sale_items_stock_update()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_record sales;
  v_user_id UUID;
BEGIN
  SELECT * INTO v_sale_record FROM sales WHERE id = NEW.sale_id;
  v_user_id := COALESCE(v_sale_record.created_by, '00000000-0000-0000-0000-000000000000'::UUID);

  IF v_sale_record.status = 'Completed' THEN
    PERFORM update_stock_level(
      NEW.product_id,
      v_sale_record.warehouse_id,
      -NEW.quantity,
      format('Venta #%s - Cliente: %s', COALESCE(v_sale_record.sale_number, 'N/A'), v_sale_record.customer_name),
      v_user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_stock_on_sale_item ON sale_items;
CREATE TRIGGER trigger_update_stock_on_sale_item
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION handle_sale_items_stock_update();

-- TRIGGER 3: Devoluciones
CREATE OR REPLACE FUNCTION handle_return_items_stock_update()
RETURNS TRIGGER AS $$
DECLARE
  v_return_record returns;
  v_user_id UUID;
BEGIN
  SELECT * INTO v_return_record FROM returns WHERE id = NEW.return_id;
  v_user_id := COALESCE(v_return_record.created_by, '00000000-0000-0000-0000-000000000000'::UUID);

  PERFORM update_stock_level(
    NEW.product_id,
    v_return_record.warehouse_id,
    NEW.quantity,
    format('Devolución - Cliente: %s - Razón: %s', v_return_record.customer_name, v_return_record.reason),
    v_user_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_stock_on_return_item ON return_items;
CREATE TRIGGER trigger_update_stock_on_return_item
  AFTER INSERT ON return_items
  FOR EACH ROW EXECUTE FUNCTION handle_return_items_stock_update();

-- ========================================
-- PASO 4: VERIFICACIÓN COMPLETA DEL SISTEMA
-- ========================================

-- Verificar todas las tablas críticas
DO $$
DECLARE
  v_tables TEXT[] := ARRAY['profiles', 'warehouses', 'customers', 'products', 'stock_levels',
                           'sales', 'sale_items', 'payments', 'transfers', 'transfer_items',
                           'returns', 'return_items', 'audit_logs', 'company_settings'];
  v_table TEXT;
  v_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN DE TABLAS';
  RAISE NOTICE '========================================';

  FOREACH v_table IN ARRAY v_tables LOOP
    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = v_table;

    IF v_count > 0 THEN
      RAISE NOTICE '✅ Tabla % existe', v_table;
    ELSE
      RAISE NOTICE '❌ Tabla % NO existe', v_table;
    END IF;
  END LOOP;
END $$;

-- Verificar triggers
SELECT
  '✅ Trigger: ' || trigger_name || ' en tabla ' || event_object_table AS status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'trigger_update_stock_on_transfer_item',
    'trigger_update_stock_on_sale_item',
    'trigger_update_stock_on_return_item'
  )
ORDER BY event_object_table;

-- Verificar columnas de audit_logs
SELECT
  '✅ Columna audit_logs.' || column_name || ' (' || data_type || ')' AS status
FROM information_schema.columns
WHERE table_name = 'audit_logs' AND table_schema = 'public'
ORDER BY ordinal_position;

-- ========================================
-- MENSAJE FINAL
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SISTEMA COMPLETAMENTE CORREGIDO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Tabla audit_logs corregida';
  RAISE NOTICE '✅ Función update_stock_level actualizada';
  RAISE NOTICE '✅ Triggers de stock creados:';
  RAISE NOTICE '   • trigger_update_stock_on_transfer_item (IMPORT/INTERNAL/ADJUSTMENT)';
  RAISE NOTICE '   • trigger_update_stock_on_sale_item (VENTAS)';
  RAISE NOTICE '   • trigger_update_stock_on_return_item (DEVOLUCIONES)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 TODO LISTO PARA USAR:';
  RAISE NOTICE '   • Recepción de contenedores → Stock actualizado automáticamente';
  RAISE NOTICE '   • Transferencias internas → Stock movido automáticamente';
  RAISE NOTICE '   • Ventas → Stock descontado automáticamente';
  RAISE NOTICE '   • Devoluciones → Stock devuelto automáticamente';
  RAISE NOTICE '   • Ajustes de inventario → Stock ajustado automáticamente';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
