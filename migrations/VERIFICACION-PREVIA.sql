-- ========================================
-- VERIFICACIÓN ANTES DE APLICAR EL FIX
-- ========================================
-- Este script verifica el estado actual del sistema
-- ========================================

-- 1. Verificar que existen productos
SELECT
  '📦 PRODUCTOS' as seccion,
  COUNT(*) as cantidad
FROM products;

-- 2. Mostrar primeros 5 productos
SELECT
  '📦 Productos disponibles:' as info,
  id,
  name,
  sku
FROM products
ORDER BY name
LIMIT 5;

-- 3. Verificar que existen almacenes
SELECT
  '🏢 ALMACENES' as seccion,
  COUNT(*) as cantidad
FROM warehouses;

-- 4. Mostrar todos los almacenes
SELECT
  '🏢 Almacenes disponibles:' as info,
  id,
  name,
  location,
  type
FROM warehouses
ORDER BY name;

-- 5. Verificar últimas transferencias
SELECT
  '📋 ÚLTIMAS 5 TRANSFERENCIAS' as seccion;

SELECT
  t.id,
  t.type,
  t.status,
  t.reference,
  t.to_warehouse_id,
  w.name as warehouse_name,
  t.created_at
FROM transfers t
LEFT JOIN warehouses w ON w.id = t.to_warehouse_id
ORDER BY t.created_at DESC
LIMIT 5;

-- 6. Verificar últimos transfer_items
SELECT
  '📋 ÚLTIMOS 5 TRANSFER ITEMS' as seccion;

SELECT
  ti.id,
  ti.transfer_id,
  ti.product_id,
  ti.product_name,
  ti.quantity,
  ti.created_at
FROM transfer_items ti
ORDER BY ti.created_at DESC
LIMIT 5;

-- 7. Estado actual de stock_levels
SELECT
  '📊 STOCK LEVELS (últimos 10)' as seccion;

SELECT
  sl.id,
  p.name as product_name,
  p.id as product_id,
  w.name as warehouse_name,
  w.id as warehouse_id,
  sl.quantity,
  sl.updated_at
FROM stock_levels sl
LEFT JOIN products p ON p.id = sl.product_id
LEFT JOIN warehouses w ON w.id = sl.warehouse_id
ORDER BY sl.updated_at DESC
LIMIT 10;

-- 8. Verificar triggers instalados
SELECT
  '🔧 TRIGGERS INSTALADOS' as seccion;

SELECT
  trigger_name,
  event_object_table as tabla,
  action_timing as cuando,
  event_manipulation as evento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (
    trigger_name LIKE '%stock%' OR
    trigger_name LIKE '%transfer%'
  )
ORDER BY event_object_table, trigger_name;

-- 9. Verificar funciones relacionadas con stock
SELECT
  '⚙️ FUNCIONES DE STOCK' as seccion;

SELECT
  routine_name as function_name,
  routine_type as type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%stock%' OR
    routine_name LIKE '%transfer%'
  )
ORDER BY routine_name;

-- 10. Buscar registros huérfanos en stock_levels
SELECT
  '⚠️ REGISTROS HUÉRFANOS EN STOCK_LEVELS' as seccion;

SELECT
  sl.id,
  sl.product_id,
  sl.warehouse_id,
  sl.quantity,
  CASE
    WHEN p.id IS NULL THEN '❌ Producto no existe'
    WHEN w.id IS NULL THEN '❌ Almacén no existe'
    ELSE '✅ OK'
  END as estado
FROM stock_levels sl
LEFT JOIN products p ON p.id = sl.product_id
LEFT JOIN warehouses w ON w.id = sl.warehouse_id
WHERE p.id IS NULL OR w.id IS NULL;

-- 11. Contar stock_levels con cantidad 0
SELECT
  '⚠️ STOCK LEVELS EN CERO' as seccion,
  COUNT(*) as cantidad_en_cero
FROM stock_levels
WHERE quantity = 0;

-- 12. Ver audit_logs recientes
SELECT
  '📝 ÚLTIMOS AUDIT LOGS' as seccion;

SELECT
  timestamp,
  action,
  entity,
  entity_id,
  details
FROM audit_logs
ORDER BY timestamp DESC
LIMIT 5;

-- ========================================
-- RESUMEN FINAL
-- ========================================
DO $$
DECLARE
  v_products INTEGER;
  v_warehouses INTEGER;
  v_transfers INTEGER;
  v_transfer_items INTEGER;
  v_stock_levels INTEGER;
  v_stock_zeros INTEGER;
  v_triggers INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_products FROM products;
  SELECT COUNT(*) INTO v_warehouses FROM warehouses;
  SELECT COUNT(*) INTO v_transfers FROM transfers;
  SELECT COUNT(*) INTO v_transfer_items FROM transfer_items;
  SELECT COUNT(*) INTO v_stock_levels FROM stock_levels;
  SELECT COUNT(*) INTO v_stock_zeros FROM stock_levels WHERE quantity = 0;

  SELECT COUNT(*) INTO v_triggers
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND trigger_name LIKE '%stock%';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 RESUMEN DEL SISTEMA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Productos: %', v_products;
  RAISE NOTICE 'Almacenes: %', v_warehouses;
  RAISE NOTICE 'Transferencias: %', v_transfers;
  RAISE NOTICE 'Transfer Items: %', v_transfer_items;
  RAISE NOTICE 'Stock Levels: %', v_stock_levels;
  RAISE NOTICE '  └─ Con cantidad 0: % ⚠️', v_stock_zeros;
  RAISE NOTICE 'Triggers instalados: %', v_triggers;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  IF v_stock_zeros > 0 AND v_transfer_items > 0 THEN
    RAISE NOTICE '⚠️ PROBLEMA DETECTADO:';
    RAISE NOTICE '   Hay % transfer_items creados', v_transfer_items;
    RAISE NOTICE '   Pero % stock_levels tienen cantidad 0', v_stock_zeros;
    RAISE NOTICE '   Esto indica que los triggers NO están actualizando el stock';
    RAISE NOTICE '   o están fallando silenciosamente.';
    RAISE NOTICE '';
    RAISE NOTICE '✅ SOLUCIÓN: Ejecutar FIX-TRIGGERS-DEFINITIVO.sql';
  ELSIF v_stock_levels > 0 THEN
    RAISE NOTICE '✅ Sistema parece estar funcionando correctamente';
  ELSE
    RAISE NOTICE 'ℹ️ No hay suficientes datos para diagnosticar';
  END IF;

  RAISE NOTICE '========================================';
END $$;
