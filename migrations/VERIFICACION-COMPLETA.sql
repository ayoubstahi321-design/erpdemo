-- ============================================
-- 🔍 VERIFICACIÓN COMPLETA DEL SISTEMA
-- ============================================
-- Ejecuta este script en Supabase SQL Editor para verificar
-- que TODA la estructura de la base de datos esté correcta

-- ============================================
-- 1️⃣ VERIFICAR TABLA CUSTOMERS
-- ============================================

SELECT '🔍 VERIFICANDO TABLA CUSTOMERS...' AS status;

-- Verificar que la tabla existe
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers')
    THEN '✅ Tabla customers existe'
    ELSE '❌ ERROR: Tabla customers NO existe'
  END AS resultado;

-- Verificar columnas de customers
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

-- Verificar que contact_person existe (NO contactPerson)
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'customers' AND column_name = 'contact_person'
    )
    THEN '✅ Columna contact_person existe (correcto)'
    ELSE '❌ ERROR: Columna contact_person NO existe'
  END AS resultado;

-- Verificar que tax_id existe (NO taxId)
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'customers' AND column_name = 'tax_id'
    )
    THEN '✅ Columna tax_id existe (correcto)'
    ELSE '❌ ERROR: Columna tax_id NO existe'
  END AS resultado;

-- ============================================
-- 2️⃣ VERIFICAR TABLA PRODUCTS
-- ============================================

SELECT '🔍 VERIFICANDO TABLA PRODUCTS...' AS status;

-- Verificar columnas de products
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- ============================================
-- 3️⃣ VERIFICAR TABLA STOCK_LEVELS
-- ============================================

SELECT '🔍 VERIFICANDO TABLA STOCK_LEVELS...' AS status;

-- Verificar que la tabla existe
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_levels')
    THEN '✅ Tabla stock_levels existe'
    ELSE '❌ ERROR: Tabla stock_levels NO existe'
  END AS resultado;

-- Verificar columnas
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'stock_levels'
ORDER BY ordinal_position;

-- ============================================
-- 4️⃣ VERIFICAR TRIGGERS
-- ============================================

SELECT '🔍 VERIFICANDO TRIGGERS...' AS status;

-- Ver todos los triggers
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('transfer_items', 'sale_items', 'return_items')
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 5️⃣ VERIFICAR FUNCIONES
-- ============================================

SELECT '🔍 VERIFICANDO FUNCIONES...' AS status;

-- Verificar que update_stock_level existe
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'update_stock_level'
    )
    THEN '✅ Función update_stock_level existe'
    ELSE '❌ ERROR: Función update_stock_level NO existe'
  END AS resultado;

-- ============================================
-- 6️⃣ VERIFICAR RLS (ROW LEVEL SECURITY)
-- ============================================

SELECT '🔍 VERIFICANDO RLS...' AS status;

-- Ver políticas RLS en customers
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'customers';

-- Ver políticas RLS en products
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'products';

-- Ver políticas RLS en stock_levels
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'stock_levels';

-- ============================================
-- 7️⃣ CONTAR REGISTROS
-- ============================================

SELECT '🔍 CONTANDO REGISTROS...' AS status;

SELECT
  'customers' AS tabla,
  COUNT(*) AS total_registros
FROM customers
UNION ALL
SELECT
  'products' AS tabla,
  COUNT(*) AS total_registros
FROM products
UNION ALL
SELECT
  'stock_levels' AS tabla,
  COUNT(*) AS total_registros
FROM stock_levels
UNION ALL
SELECT
  'warehouses' AS tabla,
  COUNT(*) AS total_registros
FROM warehouses;

-- ============================================
-- 8️⃣ TEST DE INSERCIÓN EN CUSTOMERS
-- ============================================

SELECT '🧪 TEST: INSERCIÓN EN CUSTOMERS...' AS status;

-- Intentar insertar un cliente de prueba con contact_person
-- (Se insertará y luego se borrará automáticamente)
WITH test_insert AS (
  INSERT INTO customers (
    type,
    name,
    contact_person,  -- ← SNAKE_CASE (correcto)
    email,
    phone,
    address,
    city,
    ice,
    tax_id  -- ← SNAKE_CASE (correcto)
  ) VALUES (
    'Professional',
    'TEST CUSTOMER - BORRAR',
    'Juan Pérez',
    'test@example.com',
    '+212600000000',
    'Test Address',
    'Casablanca',
    '000000000000000',
    'TEST123'
  )
  RETURNING id, name, contact_person, tax_id
),
test_delete AS (
  DELETE FROM customers WHERE name = 'TEST CUSTOMER - BORRAR' RETURNING id
)
SELECT
  '✅ TEST PASADO: Cliente insertado con contact_person y tax_id, luego eliminado' AS resultado,
  ti.id AS test_id,
  ti.contact_person,
  ti.tax_id
FROM test_insert ti;

-- ============================================
-- 9️⃣ VERIFICAR AUDIT_LOGS
-- ============================================

SELECT '🔍 VERIFICANDO AUDIT_LOGS...' AS status;

-- Verificar estructura
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'audit_logs'
ORDER BY ordinal_position;

-- Ver últimos 10 registros
SELECT
  timestamp,
  user_name,
  action,
  entity,
  details
FROM audit_logs
ORDER BY timestamp DESC
LIMIT 10;

-- ============================================
-- ✅ RESUMEN FINAL
-- ============================================

SELECT '
╔════════════════════════════════════════════╗
║  ✅ VERIFICACIÓN COMPLETA FINALIZADA       ║
╚════════════════════════════════════════════╝

Si todos los resultados muestran ✅, tu base de datos
está configurada correctamente.

Si ves ❌, revisa ese componente específico.

NOTA IMPORTANTE:
- Las columnas en la base de datos deben usar snake_case
- contact_person (NO contactPerson) ✅
- tax_id (NO taxId) ✅

El frontend convierte automáticamente entre:
  Database (snake_case) ↔ App (camelCase)

Esta conversión se hace en:
- src/types/supabase.ts (toCustomer/fromCustomer)
- src/hooks/useSupabaseData.ts (addCustomer/updateCustomer)
' AS resumen;
