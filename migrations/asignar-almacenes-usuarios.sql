-- ========================================
-- ASIGNAR ALMACENES A USUARIOS EXISTENTES
-- ========================================
-- Este script asigna almacenes específicos a usuarios que actualmente tienen NULL

-- Primero, ver los almacenes disponibles
SELECT
  '📦 ALMACENES DISPONIBLES:' AS info,
  id,
  name,
  location,
  type
FROM warehouses
ORDER BY name;

-- Ver usuarios que necesitan almacén asignado
SELECT
  '⚠️ USUARIOS SIN ALMACÉN (que NO son Admin/Manager):' AS info,
  name AS usuario,
  role AS rol,
  email,
  warehouse_id
FROM profiles
WHERE warehouse_id IS NULL
  AND role NOT IN ('Admin', 'Manager')
ORDER BY role, name;

-- ========================================
-- OPCIÓN 1: ASIGNAR ALMACENES MANUALMENTE
-- ========================================
-- Descomenta y ajusta según tus necesidades

-- Ejemplo 1: Asignar "Almacén Central" a basma (Cashier)
-- UPDATE profiles
-- SET warehouse_id = '550e8400-e29b-41d4-a716-446655440001'  -- Reemplazar con ID real
-- WHERE email = 'basma@azmol.ma';

-- Ejemplo 2: Asignar "Almacén Tánger" a halima (Delivery)
-- UPDATE profiles
-- SET warehouse_id = '550e8400-e29b-41d4-a716-446655440003'  -- Reemplazar con ID real
-- WHERE email = 'halima@azmol.ma';

-- Ejemplo 3: Asignar "Almacén Central" a lkhdar (Sales)
-- UPDATE profiles
-- SET warehouse_id = '550e8400-e29b-41d4-a716-446655440001'  -- Reemplazar con ID real
-- WHERE email = 'lkhdar@azmol.ma';


-- ========================================
-- OPCIÓN 2: ASIGNAR PRIMER ALMACÉN A TODOS
-- ========================================
-- Asigna automáticamente el primer almacén disponible a todos los usuarios sin almacén

-- DESCOMENTAR PARA EJECUTAR:
-- UPDATE profiles
-- SET warehouse_id = (
--   SELECT id FROM warehouses ORDER BY name LIMIT 1
-- )
-- WHERE warehouse_id IS NULL
--   AND role NOT IN ('Admin', 'Manager');


-- ========================================
-- VERIFICACIÓN DESPUÉS DE ASIGNAR
-- ========================================
-- Ejecuta esto después de hacer los UPDATEs para verificar

SELECT
  '✅ ESTADO FINAL DE USUARIOS:' AS info,
  p.name AS usuario,
  p.role AS rol,
  p.email,
  COALESCE(w.name, 'TODOS LOS ALMACENES') AS almacen_asignado,
  CASE
    WHEN p.warehouse_id IS NULL AND p.role IN ('Admin', 'Manager') THEN '✓ Correcto (Admin/Manager)'
    WHEN p.warehouse_id IS NULL AND p.role NOT IN ('Admin', 'Manager') THEN '❌ FALTA ASIGNAR ALMACÉN'
    WHEN p.warehouse_id IS NOT NULL THEN '✓ Correcto'
  END AS estado
FROM profiles p
LEFT JOIN warehouses w ON p.warehouse_id = w.id
ORDER BY p.role, p.name;


-- ========================================
-- INSTRUCCIONES DE USO
-- ========================================
--
-- PASO 1: Ejecuta las primeras 2 consultas SELECT para ver almacenes y usuarios
--
-- PASO 2: Elige una opción:
--   - OPCIÓN 1 (Recomendada): Asigna manualmente según la ubicación de cada empleado
--   - OPCIÓN 2: Asigna automáticamente el primer almacén a todos
--
-- PASO 3: Descomenta los UPDATEs que quieras ejecutar
--
-- PASO 4: Ejecuta el script completo
--
-- PASO 5: Verifica con la última consulta SELECT que todo está correcto
--
-- ========================================
