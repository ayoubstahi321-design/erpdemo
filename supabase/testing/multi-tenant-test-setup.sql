-- ====================================================================================
-- MULTI-TENANT TESTING SCRIPT
-- ====================================================================================
-- Este script configura datos de prueba para el sistema multi-tenant
-- Ejecuta cada sección por separado para entender el proceso

-- ====================================================================================
-- PARTE 1: VERIFICAR ESTADO ACTUAL
-- ====================================================================================

-- 1.1 Ver todos los usuarios (profiles)
SELECT
  id,
  name,
  email,
  role,
  company_id,
  warehouse_id
FROM profiles
ORDER BY name;

-- 1.2 Ver todos los almacenes (warehouses)
SELECT
  id,
  name,
  location,
  type
FROM warehouses
ORDER BY name;

-- 1.3 Ver asignaciones actuales de warehouse-company
SELECT
  wc.id,
  w.name as warehouse_name,
  wc.company_id,
  COUNT(p.id) as users_in_company
FROM warehouse_companies wc
JOIN warehouses w ON w.id = wc.warehouse_id
LEFT JOIN profiles p ON p.company_id = wc.company_id
GROUP BY wc.id, w.name, wc.company_id
ORDER BY wc.company_id, w.name;

-- 1.4 Ver ventas existentes con company_id
SELECT
  id,
  customer_name,
  company_id,
  total_amount,
  DATE(created_at) as date,
  warehouse_id
FROM sales
ORDER BY created_at DESC
LIMIT 10;

-- ====================================================================================
-- PARTE 2: ASIGNAR COMPANY_ID A USUARIOS
-- ====================================================================================

-- 2.1 Opción A: Asignar automáticamente basado en índice
-- (Solo para testing - ajusta los IDs según tu necesidad)

-- Ver usuarios sin company_id
SELECT id, name, role FROM profiles WHERE company_id IS NULL AND role != 'Admin';

-- IMPORTANTE: Copia los IDs del query anterior y úsalos en los UPDATE siguientes

-- Ejemplo de asignación manual (reemplaza los IDs):
/*
UPDATE profiles
SET company_id = 'COMPANY_A'
WHERE id = 'user-id-1';

UPDATE profiles
SET company_id = 'COMPANY_B'
WHERE id = 'user-id-2';

UPDATE profiles
SET company_id = 'COMPANY_C'
WHERE id = 'user-id-3';
*/

-- 2.2 Opción B: Asignar automáticamente (para testing rápido)
-- Este script asigna users alternadamente a COMPANY_A, COMPANY_B, COMPANY_C

DO $$
DECLARE
  user_record RECORD;
  company_names TEXT[] := ARRAY['COMPANY_A', 'COMPANY_B', 'COMPANY_C'];
  idx INT := 1;
BEGIN
  FOR user_record IN
    SELECT id, role FROM profiles
    WHERE company_id IS NULL AND role != 'Admin'
    ORDER BY created_at
  LOOP
    UPDATE profiles
    SET company_id = company_names[((idx - 1) % 3) + 1]
    WHERE id = user_record.id;

    idx := idx + 1;
  END LOOP;

  RAISE NOTICE 'Usuarios asignados a companies';
END $$;

-- 2.3 Asegurar que Admin no tiene company (cross-company access)
UPDATE profiles
SET company_id = NULL
WHERE role = 'Admin';

-- 2.4 Verificar asignación de usuarios
SELECT
  name,
  role,
  company_id,
  email
FROM profiles
ORDER BY company_id NULLS FIRST, name;

-- ====================================================================================
-- PARTE 3: ASIGNAR WAREHOUSES A COMPANIES
-- ====================================================================================

-- 3.1 Ver warehouses actuales
SELECT id, name, location FROM warehouses ORDER BY name;

-- 3.2 Estrategia de asignación:
-- - Warehouse 1 → COMPANY_A y COMPANY_B (compartido)
-- - Warehouse 2 → COMPANY_A (exclusivo)
-- - Warehouse 3 → COMPANY_B (exclusivo)
-- - Warehouse 4 → COMPANY_C (exclusivo)

-- IMPORTANTE: Ajusta los warehouse IDs según tu base de datos
-- Opción A: Asignación manual (recomendada para producción)
/*
INSERT INTO warehouse_companies (warehouse_id, company_id) VALUES
  ('warehouse-id-1', 'COMPANY_A'),
  ('warehouse-id-1', 'COMPANY_B'),
  ('warehouse-id-2', 'COMPANY_A'),
  ('warehouse-id-3', 'COMPANY_B'),
  ('warehouse-id-4', 'COMPANY_C')
ON CONFLICT (warehouse_id, company_id) DO NOTHING;
*/

-- Opción B: Asignación automática (para testing rápido)
-- Este script asigna cada warehouse a al menos una company

DO $$
DECLARE
  warehouse_record RECORD;
  company_names TEXT[] := ARRAY['COMPANY_A', 'COMPANY_B', 'COMPANY_C'];
  idx INT := 1;
  company_name TEXT;
BEGIN
  -- Primero, asignar cada warehouse a una company única
  FOR warehouse_record IN
    SELECT id FROM warehouses ORDER BY created_at
  LOOP
    company_name := company_names[((idx - 1) % 3) + 1];

    INSERT INTO warehouse_companies (warehouse_id, company_id)
    VALUES (warehouse_record.id, company_name)
    ON CONFLICT (warehouse_id, company_id) DO NOTHING;

    -- Si es el primer warehouse, también asignarlo a COMPANY_B (compartido)
    IF idx = 1 THEN
      INSERT INTO warehouse_companies (warehouse_id, company_id)
      VALUES (warehouse_record.id, 'COMPANY_B')
      ON CONFLICT (warehouse_id, company_id) DO NOTHING;
    END IF;

    idx := idx + 1;
  END LOOP;

  RAISE NOTICE 'Warehouses asignados a companies';
END $$;

-- 3.3 Verificar asignaciones warehouse-company
SELECT
  w.name as warehouse_name,
  w.location,
  wc.company_id,
  COUNT(DISTINCT p.id) as users_in_company
FROM warehouse_companies wc
JOIN warehouses w ON w.id = wc.warehouse_id
LEFT JOIN profiles p ON p.company_id = wc.company_id
GROUP BY w.name, w.location, wc.company_id
ORDER BY wc.company_id, w.name;

-- ====================================================================================
-- PARTE 4: MIGRAR VENTAS EXISTENTES (OPCIONAL)
-- ====================================================================================

-- 4.1 Ver ventas sin company_id
SELECT COUNT(*) as sales_without_company
FROM sales
WHERE company_id IS NULL;

-- 4.2 Opción: Asignar todas las ventas legacy a COMPANY_A
/*
UPDATE sales
SET company_id = 'COMPANY_A'
WHERE company_id IS NULL;
*/

-- 4.3 Opción: Distribuir ventas legacy entre companies (para testing)
DO $$
DECLARE
  sale_record RECORD;
  company_names TEXT[] := ARRAY['COMPANY_A', 'COMPANY_B', 'COMPANY_C'];
  idx INT := 1;
BEGIN
  FOR sale_record IN
    SELECT id FROM sales
    WHERE company_id IS NULL
    ORDER BY created_at
  LOOP
    UPDATE sales
    SET company_id = company_names[((idx - 1) % 3) + 1]
    WHERE id = sale_record.id;

    idx := idx + 1;
  END LOOP;

  RAISE NOTICE 'Ventas legacy asignadas a companies';
END $$;

-- ====================================================================================
-- PARTE 5: VERIFICACIÓN Y TESTS
-- ====================================================================================

-- 5.1 Resumen completo del sistema multi-tenant
SELECT
  'Total Companies' as metric,
  COUNT(DISTINCT company_id)::TEXT as value
FROM profiles WHERE company_id IS NOT NULL
UNION ALL
SELECT
  'Total Users',
  COUNT(*)::TEXT
FROM profiles
UNION ALL
SELECT
  'Users with Company',
  COUNT(*)::TEXT
FROM profiles WHERE company_id IS NOT NULL
UNION ALL
SELECT
  'Admin Users (no company)',
  COUNT(*)::TEXT
FROM profiles WHERE company_id IS NULL
UNION ALL
SELECT
  'Total Warehouses',
  COUNT(*)::TEXT
FROM warehouses
UNION ALL
SELECT
  'Warehouse-Company Assignments',
  COUNT(*)::TEXT
FROM warehouse_companies
UNION ALL
SELECT
  'Sales with Company',
  COUNT(*)::TEXT
FROM sales WHERE company_id IS NOT NULL
UNION ALL
SELECT
  'Sales without Company',
  COUNT(*)::TEXT
FROM sales WHERE company_id IS NULL;

-- 5.2 Ver distribución por company
SELECT
  COALESCE(p.company_id, 'ADMIN/NO-COMPANY') as company,
  COUNT(DISTINCT p.id) as users,
  COUNT(DISTINCT wc.warehouse_id) as warehouses,
  COUNT(DISTINCT s.id) as sales
FROM profiles p
LEFT JOIN warehouse_companies wc ON wc.company_id = p.company_id
LEFT JOIN sales s ON s.company_id = p.company_id
GROUP BY p.company_id
ORDER BY p.company_id NULLS FIRST;

-- 5.3 Test: Verificar que cada user ve solo sus warehouses asignados
SELECT
  p.name as user_name,
  p.company_id,
  w.name as accessible_warehouse,
  wc.company_id as warehouse_company
FROM profiles p
LEFT JOIN warehouse_companies wc ON wc.company_id = p.company_id
LEFT JOIN warehouses w ON w.id = wc.warehouse_id
WHERE p.company_id IS NOT NULL
ORDER BY p.company_id, p.name, w.name;

-- 5.4 Test: Verificar RLS helper function
SELECT
  id,
  name,
  company_id,
  CASE
    WHEN company_id IS NULL THEN 'Admin - Ve TODOS los datos'
    ELSE 'Regular - Ve solo company: ' || company_id
  END as access_level
FROM profiles
ORDER BY company_id NULLS FIRST, name;

-- 5.5 Test: Simular acceso de un usuario específico (ajusta el user_id)
/*
-- Establece el contexto de usuario (reemplaza con un user ID real)
SET LOCAL "request.jwt.claim.sub" = 'tu-user-id-aqui';

-- Ver qué ventas ve este usuario
SELECT
  id,
  customer_name,
  company_id,
  total_amount
FROM sales
ORDER BY created_at DESC
LIMIT 10;

-- Ver qué warehouses ve este usuario
SELECT
  id,
  name,
  location
FROM warehouses
ORDER BY name;
*/

-- ====================================================================================
-- PARTE 6: DATOS DE PRUEBA ADICIONALES (OPCIONAL)
-- ====================================================================================

-- 6.1 Ver document_counters actuales
SELECT
  document_type,
  year,
  company_id,
  last_number
FROM document_counters
ORDER BY company_id NULLS FIRST, document_type, year;

-- 6.2 Verificar que helper function funciona
SELECT public.user_company_id() as current_user_company;

-- 6.3 Test: Contar políticas RLS activas
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policy_count DESC;

-- ====================================================================================
-- PARTE 7: LIMPIEZA (USAR CON CUIDADO)
-- ====================================================================================

-- Si necesitas resetear el testing, descomenta y ejecuta:

/*
-- Remover todas las asignaciones warehouse-company
TRUNCATE warehouse_companies CASCADE;

-- Remover company_id de todos los usuarios
UPDATE profiles SET company_id = NULL;

-- Remover company_id de todas las ventas
UPDATE sales SET company_id = NULL;

-- Resetear document counters
UPDATE document_counters SET company_id = NULL;
*/

-- ====================================================================================
-- NOTAS FINALES
-- ====================================================================================

-- ✅ Después de ejecutar este script:
-- 1. Los usuarios están asignados a companies
-- 2. Los warehouses están asignados a companies
-- 3. Las ventas tienen company_id (si ejecutaste PARTE 4)
-- 4. Puedes probar el aislamiento en la UI

-- 🧪 Para probar en la aplicación:
-- 1. Inicia sesión con un usuario de COMPANY_A
-- 2. Crea una venta en el POS
-- 3. Verifica que la venta tiene company_id = 'COMPANY_A'
-- 4. Inicia sesión con un usuario de COMPANY_B
-- 5. Verifica que NO ves las ventas de COMPANY_A

-- 🔒 Seguridad:
-- - Admin (company_id = NULL) ve TODO
-- - Usuarios regulares solo ven su company
-- - RLS en la base de datos refuerza el aislamiento
-- - Document numbers son independientes por company

