-- ========================================
-- TEST MANUAL COMPLETO DEL SISTEMA
-- ========================================

-- PASO 1: Usar un producto real de tu lista
-- ID del primer producto: af0aec68-9950-4c68-a95e-426dbc31391a

-- PASO 2: Crear una transferencia de prueba manualmente
INSERT INTO transfers (
  id,
  date,
  type,
  to_warehouse_id,
  reference,
  status,
  created_by
) VALUES (
  gen_random_uuid(),
  NOW(),
  'IMPORT',
  '550e8400-e29b-41d4-a716-446655440001'::UUID,  -- Almacén Central
  'TEST-MANUAL-001',
  'Completed',
  '00000000-0000-0000-0000-000000000000'::UUID
) RETURNING id;

-- ANOTA EL ID QUE RETORNA LA CONSULTA ANTERIOR
-- Luego reemplaza 'TRANSFER-ID-AQUI' en la siguiente consulta con ese ID

-- PASO 3: Crear el item de transferencia (ESTO DEBE DISPARAR EL TRIGGER)
INSERT INTO transfer_items (
  transfer_id,
  product_id,
  product_name,
  quantity
) VALUES (
  'TRANSFER-ID-AQUI'::UUID,  -- ← REEMPLAZAR CON EL ID DEL PASO 2
  'af0aec68-9950-4c68-a95e-426dbc31391a'::UUID,  -- Producto DOT 4
  'DOT 4 (Test)',
  25
);

-- PASO 4: Verificar si se creó el stock_level
SELECT
  sl.id,
  p.name,
  w.name as warehouse,
  sl.quantity,
  sl.created_at,
  sl.updated_at
FROM stock_levels sl
JOIN products p ON p.id = sl.product_id
JOIN warehouses w ON w.id = sl.warehouse_id
WHERE sl.product_id = 'af0aec68-9950-4c68-a95e-426dbc31391a'
ORDER BY sl.updated_at DESC;

-- PASO 5: Ver warnings del trigger (si hay)
SELECT * FROM pg_stat_activity
WHERE state = 'active'
  AND query LIKE '%transfer%';

-- PASO 6: Verificar audit_logs
SELECT * FROM audit_logs
WHERE entity = 'StockLevel'
ORDER BY timestamp DESC
LIMIT 5;
