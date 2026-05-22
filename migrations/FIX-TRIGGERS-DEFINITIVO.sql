-- ========================================
-- CORRECCIÓN DEFINITIVA DE TRIGGERS
-- ========================================
-- Este script elimina el manejo silencioso de errores
-- para que podamos ver qué está fallando exactamente
-- ========================================

-- ========================================
-- PASO 1: RECREAR update_stock_level SIN ERRORES SILENCIOSOS
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
  v_warehouse_name TEXT;
  v_product_name TEXT;
BEGIN
  -- Validar que el producto existe
  SELECT name INTO v_product_name FROM products WHERE id = p_product_id;
  IF v_product_name IS NULL THEN
    RAISE EXCEPTION 'ERROR: Producto con ID % no existe', p_product_id;
  END IF;

  -- Validar que el almacén existe
  SELECT name INTO v_warehouse_name FROM warehouses WHERE id = p_warehouse_id;
  IF v_warehouse_name IS NULL THEN
    RAISE EXCEPTION 'ERROR: Almacén con ID % no existe', p_warehouse_id;
  END IF;

  -- Log de inicio
  RAISE NOTICE '>>> update_stock_level INICIADO';
  RAISE NOTICE '    Producto: % (ID: %)', v_product_name, p_product_id;
  RAISE NOTICE '    Almacén: % (ID: %)', v_warehouse_name, p_warehouse_id;
  RAISE NOTICE '    Delta: %', p_delta;
  RAISE NOTICE '    Razón: %', p_reason;

  -- Lock row para evitar race conditions
  SELECT * INTO v_stock
  FROM stock_levels
  WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
  FOR UPDATE;

  -- Calcular nueva cantidad
  IF v_stock.id IS NULL THEN
    v_new_quantity := p_delta;
    RAISE NOTICE '    Stock NO existe, creando nuevo con cantidad: %', v_new_quantity;
  ELSE
    v_new_quantity := COALESCE(v_stock.quantity, 0) + p_delta;
    RAISE NOTICE '    Stock existe con cantidad: %, nueva cantidad: %', v_stock.quantity, v_new_quantity;
  END IF;

  -- Validar stock no negativo
  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'ERROR: Stock insuficiente para producto % en almacén %: actual=%, delta=%, resultado=%',
      v_product_name, v_warehouse_name, COALESCE(v_stock.quantity, 0), p_delta, v_new_quantity;
  END IF;

  -- Upsert stock level
  INSERT INTO stock_levels (product_id, warehouse_id, quantity)
  VALUES (p_product_id, p_warehouse_id, v_new_quantity)
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET
    quantity = v_new_quantity,
    updated_at = TIMEZONE('utc'::text, NOW())
  RETURNING * INTO v_stock;

  RAISE NOTICE '    ✅ Stock actualizado exitosamente: % unidades', v_new_quantity;

  -- Audit log (usando TEXT, no JSONB)
  INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
  VALUES (
    p_user_id,
    'UPDATE',
    'StockLevel',
    p_product_id::TEXT,
    format('Stock %s en almacén %s: %s unidades (%s)',
      CASE WHEN p_delta > 0 THEN 'aumentado' ELSE 'reducido' END,
      v_warehouse_name,
      abs(p_delta),
      p_reason
    )
  );

  RAISE NOTICE '    ✅ Audit log creado';
  RAISE NOTICE '>>> update_stock_level COMPLETADO';

  RETURN v_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- PASO 2: RECREAR TRIGGERS SIN MANEJO SILENCIOSO DE ERRORES
-- ========================================

-- TRIGGER 1: Transferencias/Recepciones/Ajustes
CREATE OR REPLACE FUNCTION handle_transfer_items_stock_update()
RETURNS TRIGGER AS $$
DECLARE
  v_transfer_record transfers;
  v_user_id UUID;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔥 TRIGGER handle_transfer_items_stock_update DISPARADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Transfer Item ID: %', NEW.id;
  RAISE NOTICE 'Transfer ID: %', NEW.transfer_id;
  RAISE NOTICE 'Product ID: %', NEW.product_id;
  RAISE NOTICE 'Quantity: %', NEW.quantity;

  -- Obtener información de la transferencia
  SELECT * INTO v_transfer_record FROM transfers WHERE id = NEW.transfer_id;

  IF v_transfer_record.id IS NULL THEN
    RAISE EXCEPTION 'ERROR: Transfer con ID % no existe', NEW.transfer_id;
  END IF;

  RAISE NOTICE 'Transfer Type: %', v_transfer_record.type;
  RAISE NOTICE 'Transfer Status: %', v_transfer_record.status;
  RAISE NOTICE 'From Warehouse: %', v_transfer_record.from_warehouse_id;
  RAISE NOTICE 'To Warehouse: %', v_transfer_record.to_warehouse_id;

  v_user_id := COALESCE(v_transfer_record.created_by, '00000000-0000-0000-0000-000000000000'::UUID);

  IF v_transfer_record.status = 'Completed' THEN
    RAISE NOTICE '✅ Status es Completed, procesando...';

    -- TRANSFERENCIA INTERNA
    IF v_transfer_record.type = 'INTERNAL' THEN
      RAISE NOTICE '→ Tipo: INTERNAL';
      IF v_transfer_record.from_warehouse_id IS NOT NULL AND v_transfer_record.to_warehouse_id IS NOT NULL THEN
        RAISE NOTICE '→ Descontando del almacén origen...';
        PERFORM update_stock_level(NEW.product_id, v_transfer_record.from_warehouse_id, -NEW.quantity, 'Transferencia interna', v_user_id);
        RAISE NOTICE '→ Sumando al almacén destino...';
        PERFORM update_stock_level(NEW.product_id, v_transfer_record.to_warehouse_id, NEW.quantity, 'Transferencia interna', v_user_id);
      ELSE
        RAISE WARNING '⚠️ Almacenes NULL: from=%, to=%', v_transfer_record.from_warehouse_id, v_transfer_record.to_warehouse_id;
      END IF;

    -- RECEPCIÓN DE CONTENEDOR
    ELSIF v_transfer_record.type = 'IMPORT' THEN
      RAISE NOTICE '→ Tipo: IMPORT (Recepción de Contenedor)';
      IF v_transfer_record.to_warehouse_id IS NOT NULL THEN
        RAISE NOTICE '→ Sumando al almacén destino: %', v_transfer_record.to_warehouse_id;
        PERFORM update_stock_level(
          NEW.product_id,
          v_transfer_record.to_warehouse_id,
          NEW.quantity,
          format('Recepción contenedor - Ref: %s', v_transfer_record.reference),
          v_user_id
        );
      ELSE
        RAISE WARNING '⚠️ to_warehouse_id es NULL para IMPORT';
      END IF;

    -- AJUSTE DE INVENTARIO
    ELSIF v_transfer_record.type = 'ADJUSTMENT' THEN
      RAISE NOTICE '→ Tipo: ADJUSTMENT';
      IF v_transfer_record.to_warehouse_id IS NOT NULL THEN
        IF v_transfer_record.reference LIKE 'ADJ+%' THEN
          RAISE NOTICE '→ Ajuste positivo (+)';
          PERFORM update_stock_level(NEW.product_id, v_transfer_record.to_warehouse_id, NEW.quantity, format('Ajuste (+): %s', COALESCE(v_transfer_record.reason, 'N/A')), v_user_id);
        ELSE
          RAISE NOTICE '→ Ajuste negativo (-)';
          PERFORM update_stock_level(NEW.product_id, v_transfer_record.to_warehouse_id, -NEW.quantity, format('Ajuste (-): %s', COALESCE(v_transfer_record.reason, 'N/A')), v_user_id);
        END IF;
      ELSE
        RAISE WARNING '⚠️ to_warehouse_id es NULL para ADJUSTMENT';
      END IF;
    END IF;

    RAISE NOTICE '✅ Trigger completado exitosamente';
  ELSE
    RAISE NOTICE '⏭️ Status no es Completed (es %), no se actualiza stock', v_transfer_record.status;
  END IF;

  RAISE NOTICE '========================================';
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
  RAISE NOTICE '🔥 TRIGGER handle_sale_items_stock_update DISPARADO';

  SELECT * INTO v_sale_record FROM sales WHERE id = NEW.sale_id;
  v_user_id := COALESCE(v_sale_record.created_by, '00000000-0000-0000-0000-000000000000'::UUID);

  IF v_sale_record.status = 'Completed' AND v_sale_record.warehouse_id IS NOT NULL THEN
    RAISE NOTICE '→ Descontando stock por venta...';
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
  RAISE NOTICE '🔥 TRIGGER handle_return_items_stock_update DISPARADO';

  SELECT * INTO v_return_record FROM returns WHERE id = NEW.return_id;
  v_user_id := COALESCE(v_return_record.created_by, '00000000-0000-0000-0000-000000000000'::UUID);

  IF v_return_record.warehouse_id IS NOT NULL THEN
    RAISE NOTICE '→ Sumando stock por devolución...';
    PERFORM update_stock_level(
      NEW.product_id,
      v_return_record.warehouse_id,
      NEW.quantity,
      format('Devolución - Cliente: %s - Razón: %s', v_return_record.customer_name, v_return_record.reason),
      v_user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_stock_on_return_item ON return_items;
CREATE TRIGGER trigger_update_stock_on_return_item
  AFTER INSERT ON return_items
  FOR EACH ROW EXECUTE FUNCTION handle_return_items_stock_update();

-- ========================================
-- PASO 3: VERIFICACIÓN
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ TRIGGERS RECREADOS CON LOGGING COMPLETO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Ahora cuando insertes productos en una recepción,';
  RAISE NOTICE 'verás mensajes detallados en los LOGS mostrando';
  RAISE NOTICE 'exactamente qué está pasando en cada paso.';
  RAISE NOTICE '';
  RAISE NOTICE 'Si hay algún error, SE MOSTRARÁ y NO SE OCULTARÁ.';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
