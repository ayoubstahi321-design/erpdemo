-- ========================================
-- AZMOL STOCK ERP - CORRECCIÓN COMPLETA DEL SISTEMA
-- ========================================
-- Ejecutar este script en: Supabase Dashboard > SQL Editor > New Query
-- Este script soluciona TODOS los problemas de conexión y funcionamiento
-- ========================================

-- ========================================
-- PROBLEMA 1: Falta trigger para actualizar stock automáticamente
-- ========================================

-- Función que se ejecuta DESPUÉS de insertar transfer_items
CREATE OR REPLACE FUNCTION handle_transfer_items_stock_update()
RETURNS TRIGGER AS $$
DECLARE
  v_transfer_record transfers;
  v_user_id UUID;
BEGIN
  -- Obtener información de la transferencia
  SELECT * INTO v_transfer_record
  FROM transfers
  WHERE id = NEW.transfer_id;

  -- Obtener usuario que creó la transferencia
  v_user_id := v_transfer_record.created_by;

  -- Solo procesar si la transferencia está completada
  IF v_transfer_record.status = 'Completed' THEN

    -- CASO 1: TRANSFERENCIA INTERNA
    IF v_transfer_record.type = 'INTERNAL' THEN
      -- Restar del almacén origen
      PERFORM update_stock_level(
        NEW.product_id,
        v_transfer_record.from_warehouse_id,
        -NEW.quantity,
        format('Transferencia interna a %s - Ref: %s',
          (SELECT name FROM warehouses WHERE id = v_transfer_record.to_warehouse_id),
          v_transfer_record.reference
        ),
        v_user_id
      );

      -- Sumar al almacén destino
      PERFORM update_stock_level(
        NEW.product_id,
        v_transfer_record.to_warehouse_id,
        NEW.quantity,
        format('Transferencia interna desde %s - Ref: %s',
          (SELECT name FROM warehouses WHERE id = v_transfer_record.from_warehouse_id),
          v_transfer_record.reference
        ),
        v_user_id
      );

    -- CASO 2: IMPORTACIÓN (RECEPCIÓN DE CONTENEDOR)
    ELSIF v_transfer_record.type = 'IMPORT' THEN
      -- Solo sumar al almacén destino
      PERFORM update_stock_level(
        NEW.product_id,
        v_transfer_record.to_warehouse_id,
        NEW.quantity,
        format('Recepción de contenedor - Ref: %s', v_transfer_record.reference),
        v_user_id
      );

    -- CASO 3: AJUSTE DE INVENTARIO
    ELSIF v_transfer_record.type = 'ADJUSTMENT' THEN
      -- Determinar si es aumento o disminución según la referencia
      IF v_transfer_record.reference LIKE 'ADJ+%' THEN
        -- Ajuste positivo: sumar
        PERFORM update_stock_level(
          NEW.product_id,
          v_transfer_record.to_warehouse_id,
          NEW.quantity,
          format('Ajuste de inventario (+) - Razón: %s', COALESCE(v_transfer_record.reason, 'No especificada')),
          v_user_id
        );
      ELSE
        -- Ajuste negativo: restar
        PERFORM update_stock_level(
          NEW.product_id,
          v_transfer_record.to_warehouse_id,
          -NEW.quantity,
          format('Ajuste de inventario (-) - Razón: %s', COALESCE(v_transfer_record.reason, 'No especificada')),
          v_user_id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS trigger_update_stock_on_transfer_item ON transfer_items;

-- Crear el trigger que se ejecuta DESPUÉS de insertar cada transfer_item
CREATE TRIGGER trigger_update_stock_on_transfer_item
  AFTER INSERT ON transfer_items
  FOR EACH ROW
  EXECUTE FUNCTION handle_transfer_items_stock_update();

COMMENT ON FUNCTION handle_transfer_items_stock_update IS
  'Actualiza automáticamente el stock cuando se crea un transfer_item. Maneja INTERNAL, IMPORT y ADJUSTMENT.';

-- ========================================
-- PROBLEMA 2: Falta trigger para actualizar stock en ventas
-- ========================================

-- Función que se ejecuta DESPUÉS de insertar sale_items
CREATE OR REPLACE FUNCTION handle_sale_items_stock_update()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_record sales;
  v_user_id UUID;
BEGIN
  -- Obtener información de la venta
  SELECT * INTO v_sale_record
  FROM sales
  WHERE id = NEW.sale_id;

  -- Obtener usuario que creó la venta
  v_user_id := v_sale_record.created_by;

  -- Solo procesar si la venta está completada
  IF v_sale_record.status = 'Completed' THEN
    -- Restar del stock del almacén de la venta
    PERFORM update_stock_level(
      NEW.product_id,
      v_sale_record.warehouse_id,
      -NEW.quantity,
      format('Venta #%s a cliente: %s',
        COALESCE(v_sale_record.sale_number, v_sale_record.id::TEXT),
        v_sale_record.customer_name
      ),
      v_user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS trigger_update_stock_on_sale_item ON sale_items;

-- Crear el trigger que se ejecuta DESPUÉS de insertar cada sale_item
CREATE TRIGGER trigger_update_stock_on_sale_item
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION handle_sale_items_stock_update();

COMMENT ON FUNCTION handle_sale_items_stock_update IS
  'Actualiza automáticamente el stock cuando se crea un sale_item (resta del almacén de la venta).';

-- ========================================
-- PROBLEMA 3: Falta trigger para actualizar stock en devoluciones
-- ========================================

-- Función que se ejecuta DESPUÉS de insertar return_items
CREATE OR REPLACE FUNCTION handle_return_items_stock_update()
RETURNS TRIGGER AS $$
DECLARE
  v_return_record returns;
  v_user_id UUID;
BEGIN
  -- Obtener información de la devolución
  SELECT * INTO v_return_record
  FROM returns
  WHERE id = NEW.return_id;

  -- Obtener usuario que creó la devolución
  v_user_id := v_return_record.created_by;

  -- Devolver stock al almacén (sumar)
  PERFORM update_stock_level(
    NEW.product_id,
    v_return_record.warehouse_id,
    NEW.quantity,
    format('Devolución de venta - Cliente: %s - Razón: %s',
      v_return_record.customer_name,
      v_return_record.reason
    ),
    v_user_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS trigger_update_stock_on_return_item ON return_items;

-- Crear el trigger que se ejecuta DESPUÉS de insertar cada return_item
CREATE TRIGGER trigger_update_stock_on_return_item
  AFTER INSERT ON return_items
  FOR EACH ROW
  EXECUTE FUNCTION handle_return_items_stock_update();

COMMENT ON FUNCTION handle_return_items_stock_update IS
  'Actualiza automáticamente el stock cuando se crea un return_item (devuelve al almacén).';

-- ========================================
-- VERIFICACIÓN: Consultar triggers creados
-- ========================================
SELECT
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'trigger_update_stock_on_transfer_item',
    'trigger_update_stock_on_sale_item',
    'trigger_update_stock_on_return_item'
  )
ORDER BY event_object_table, trigger_name;

-- ========================================
-- VERIFICACIÓN: Consultar funciones RPC disponibles
-- ========================================
SELECT
  routine_name,
  routine_type,
  data_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'update_stock_level',
    'handle_transfer_items_stock_update',
    'handle_sale_items_stock_update',
    'handle_return_items_stock_update'
  )
ORDER BY routine_name;

-- ========================================
-- VERIFICACIÓN: Consultar estructura de tablas críticas
-- ========================================
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('transfers', 'transfer_items', 'stock_levels', 'warehouses', 'products')
ORDER BY table_name, ordinal_position;

-- ========================================
-- MENSAJE FINAL
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SISTEMA CORREGIDO EXITOSAMENTE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Triggers creados:';
  RAISE NOTICE '   1. trigger_update_stock_on_transfer_item';
  RAISE NOTICE '      → Actualiza stock automáticamente al crear transferencias/recepciones';
  RAISE NOTICE '   2. trigger_update_stock_on_sale_item';
  RAISE NOTICE '      → Actualiza stock automáticamente al crear ventas';
  RAISE NOTICE '   3. trigger_update_stock_on_return_item';
  RAISE NOTICE '      → Actualiza stock automáticamente al crear devoluciones';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Comportamiento:';
  RAISE NOTICE '   • TRANSFERENCIA INTERNA: Resta del origen, suma al destino';
  RAISE NOTICE '   • RECEPCIÓN CONTENEDOR: Suma al almacén de destino';
  RAISE NOTICE '   • AJUSTE INVENTARIO: Suma o resta según tipo (ADJ+ o ADJ-)';
  RAISE NOTICE '   • VENTA: Resta del almacén de venta';
  RAISE NOTICE '   • DEVOLUCIÓN: Suma al almacén';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Ahora todas las operaciones actualizan el stock AUTOMÁTICAMENTE';
  RAISE NOTICE '✅ Ya NO necesitas actualizar manualmente el stock';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
