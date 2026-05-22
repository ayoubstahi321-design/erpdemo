-- ========================================
-- DIAGNÓSTICO DEL SISTEMA
-- ========================================
-- Ejecuta esto para ver qué está pasando
-- ========================================

-- 1. Ver últimas transferencias creadas
SELECT
  t.id,
  t.type,
  t.reference,
  t.status,
  t.to_warehouse_id,
  w.name as warehouse_name,
  t.created_at
FROM transfers t
LEFT JOIN warehouses w ON w.id = t.to_warehouse_id
ORDER BY t.created_at DESC
LIMIT 5;

-- 2. Ver últimos items de transferencia
SELECT
  ti.id,
  ti.transfer_id,
  ti.product_id,
  ti.product_name,
  ti.quantity,
  ti.created_at,
  p.name as product_full_name
FROM transfer_items ti
LEFT JOIN products p ON p.id = ti.product_id
ORDER BY ti.created_at DESC
LIMIT 5;

-- 3. Ver stock_levels actuales
SELECT
  sl.id,
  p.name as product_name,
  w.name as warehouse_name,
  sl.quantity,
  sl.updated_at
FROM stock_levels sl
JOIN products p ON p.id = sl.product_id
JOIN warehouses w ON w.id = sl.warehouse_id
ORDER BY sl.updated_at DESC
LIMIT 10;

-- 4. Verificar triggers instalados
SELECT
  trigger_name,
  event_object_table as tabla,
  action_timing as cuando,
  event_manipulation as evento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%stock%'
ORDER BY event_object_table;

-- 5. Ver últimas entradas en audit_logs
SELECT
  timestamp,
  action,
  entity,
  entity_id,
  details
FROM audit_logs
ORDER BY timestamp DESC
LIMIT 10;

-- 6. Contar registros
DO $$
DECLARE
  v_transfers INTEGER;
  v_transfer_items INTEGER;
  v_stock_levels INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_transfers FROM transfers;
  SELECT COUNT(*) INTO v_transfer_items FROM transfer_items;
  SELECT COUNT(*) INTO v_stock_levels FROM stock_levels;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONTEO DE REGISTROS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Transferencias: %', v_transfers;
  RAISE NOTICE 'Transfer Items: %', v_transfer_items;
  RAISE NOTICE 'Stock Levels: %', v_stock_levels;
  RAISE NOTICE '========================================';
END $$;
