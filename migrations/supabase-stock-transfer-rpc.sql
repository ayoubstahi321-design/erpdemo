-- ========================================
-- RPC TRANSACCIONAL PARA TRANSFERENCIAS DE STOCK
-- ========================================
-- Ejecutar este script en: Supabase Dashboard > SQL Editor > New Query
-- Este RPC garantiza que las transferencias sean atómicas
-- ========================================

-- Función RPC para transferencias atómicas de stock
CREATE OR REPLACE FUNCTION transfer_stock_between_warehouses(
  p_product_id UUID,
  p_from_warehouse_id UUID,
  p_to_warehouse_id UUID,
  p_quantity NUMERIC,
  p_reason TEXT,
  p_user_id UUID
) RETURNS TABLE (success BOOLEAN, error_message TEXT) AS $$
DECLARE
  v_current_stock NUMERIC;
  v_from_warehouse_name TEXT;
  v_to_warehouse_name TEXT;
BEGIN
  -- Validar que no sean el mismo almacén
  IF p_from_warehouse_id = p_to_warehouse_id THEN
    RETURN QUERY SELECT FALSE, 'Source and destination warehouses cannot be the same'::TEXT;
    RETURN;
  END IF;

  -- Validar que la cantidad sea positiva
  IF p_quantity <= 0 THEN
    RETURN QUERY SELECT FALSE, 'Quantity must be positive'::TEXT;
    RETURN;
  END IF;

  -- Obtener nombres de almacenes para auditoría
  SELECT name INTO v_from_warehouse_name FROM warehouses WHERE id = p_from_warehouse_id;
  SELECT name INTO v_to_warehouse_name FROM warehouses WHERE id = p_to_warehouse_id;

  -- Obtener stock actual en almacén origen
  SELECT quantity INTO v_current_stock
  FROM stock_levels
  WHERE product_id = p_product_id AND warehouse_id = p_from_warehouse_id;

  -- Si no existe registro, stock es 0
  v_current_stock := COALESCE(v_current_stock, 0);

  -- Validar stock suficiente
  IF v_current_stock < p_quantity THEN
    RETURN QUERY SELECT FALSE, format('Insufficient stock in origin warehouse. Available: %s, Requested: %s', v_current_stock, p_quantity)::TEXT;
    RETURN;
  END IF;

  -- INICIO DE TRANSACCIÓN ATÓMICA
  BEGIN
    -- Restar del almacén origen usando el RPC existente
    PERFORM update_stock_level(
      p_product_id,
      p_from_warehouse_id,
      -p_quantity,  -- Delta negativo
      format('Transfer to %s: %s', v_to_warehouse_name, p_reason),
      p_user_id
    );

    -- Sumar al almacén destino usando el RPC existente
    PERFORM update_stock_level(
      p_product_id,
      p_to_warehouse_id,
      p_quantity,  -- Delta positivo
      format('Transfer from %s: %s', v_from_warehouse_name, p_reason),
      p_user_id
    );

    -- Si todo salió bien
    RETURN QUERY SELECT TRUE, NULL::TEXT;

  EXCEPTION WHEN OTHERS THEN
    -- Si hubo algún error, la transacción se revierte automáticamente
    RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- PRUEBA DE LA FUNCIÓN (Opcional)
-- ========================================

-- Para probar, descomenta y ajusta los UUIDs:
/*
SELECT * FROM transfer_stock_between_warehouses(
  'product-uuid-here'::UUID,          -- p_product_id
  'from-warehouse-uuid-here'::UUID,   -- p_from_warehouse_id
  'to-warehouse-uuid-here'::UUID,     -- p_to_warehouse_id
  10,                                 -- p_quantity
  'Test transfer',                    -- p_reason
  'user-uuid-here'::UUID              -- p_user_id
);
*/

-- ========================================
-- VERIFICACIÓN
-- ========================================

-- Verificar que la función se creó correctamente
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'transfer_stock_between_warehouses';

-- Mensaje final
DO $$
BEGIN
  RAISE NOTICE '✅ RPC transfer_stock_between_warehouses creado exitosamente';
  RAISE NOTICE '📝 Esta función garantiza transferencias atómicas de stock';
  RAISE NOTICE '📝 Si alguna operación falla, toda la transferencia se revierte';
END $$;
