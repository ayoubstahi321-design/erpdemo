-- ========================================
-- MIGRACIÓN: Sistema de 5 Roles Optimizado
-- ========================================
-- Este script actualiza el sistema de roles de 5 roles antiguos → 5 roles nuevos
-- ANTES: Admin, Manager, Sales, Delivery, Cashier
-- DESPUÉS: Admin, Manager, Accountant, Sales, Warehouse
--
-- IMPORTANTE: Ejecutar en ORDEN y verificar cada paso
-- ========================================

-- ==========================================
-- PASO 1: VERIFICAR ESTADO ACTUAL
-- ==========================================
SELECT 'PASO 1: Verificando estado actual...' AS step;

-- Ver roles actuales en uso
SELECT role, COUNT(*) as usuarios
FROM profiles
GROUP BY role
ORDER BY role;

-- Ver constraint actual
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass 
  AND conname LIKE '%role%';

-- ==========================================
-- PASO 2: ELIMINAR CONSTRAINT TEMPORAL
-- ==========================================
SELECT 'PASO 2: Eliminando constraint antiguo...' AS step;

-- Eliminar constraint antiguo para poder migrar
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

SELECT 'Constraint eliminado temporalmente' AS result;

-- ==========================================
-- PASO 3: AGREGAR NUEVO CAMPO discount_limit
-- ==========================================
SELECT 'PASO 3: Agregando campo discount_limit...' AS step;

-- Agregar columna si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'discount_limit'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN discount_limit NUMERIC(5,2) DEFAULT 5.00;
    
    RAISE NOTICE 'Columna discount_limit agregada';
  ELSE
    RAISE NOTICE 'Columna discount_limit ya existe';
  END IF;
END $$;

-- ==========================================
-- PASO 4: MIGRAR ROLES EXISTENTES
-- ==========================================
SELECT 'PASO 4: Migrando roles existentes...' AS step;

-- Delivery → Warehouse (personal de almacén)
UPDATE profiles 
SET role = 'Warehouse' 
WHERE role = 'Delivery';

-- Cashier → Sales (fusionar cajeros con vendedores)
UPDATE profiles 
SET role = 'Sales' 
WHERE role = 'Cashier';

SELECT 'Usuarios migrados correctamente' AS result;

-- ==========================================
-- PASO 5: CREAR NUEVO CONSTRAINT
-- ==========================================
SELECT 'PASO 5: Creando nuevo constraint con 5 roles...' AS step;

-- Ahora que los usuarios están migrados, crear el nuevo constraint
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('Admin', 'Manager', 'Accountant', 'Sales', 'Warehouse'));

SELECT 'Constraint actualizado a 5 roles' AS result;

-- ==========================================
-- PASO 6: ASIGNAR discount_limit POR ROL
-- ==========================================
SELECT 'PASO 6: Asignando límites de descuento...' AS step;

-- Admin: descuento ilimitado
UPDATE profiles 
SET discount_limit = 100.00 
WHERE role = 'Admin';

-- Manager: hasta 15%
UPDATE profiles 
SET discount_limit = 15.00 
WHERE role = 'Manager';

-- Sales: hasta 5%
UPDATE profiles 
SET discount_limit = 5.00 
WHERE role = 'Sales';

-- Accountant y Warehouse: sin descuentos
UPDATE profiles 
SET discount_limit = 0.00 
WHERE role IN ('Accountant', 'Warehouse');

SELECT 'Límites de descuento asignados' AS result;

-- ==========================================
-- PASO 7: VERIFICAR MIGRACIÓN
-- ==========================================
SELECT 'PASO 7: Verificando migración...' AS step;

-- Ver distribución final de roles
SELECT 
  role,
  COUNT(*) as usuarios,
  AVG(discount_limit) as descuento_promedio,
  MAX(discount_limit) as descuento_maximo
FROM profiles
GROUP BY role
ORDER BY role;

-- Ver usuarios que necesitan ser asignados como Accountant (manualmente)
SELECT 
  id,
  name,
  email,
  role,
  discount_limit
FROM profiles
WHERE email ILIKE '%contab%' 
   OR email ILIKE '%accountant%'
   OR email ILIKE '%finanz%';

-- ==========================================
-- PASO 8: CREAR ÍNDICE PARA PERFORMANCE
-- ==========================================
SELECT 'PASO 8: Creando índices de performance...' AS step;

-- Índice para búsquedas por rol
CREATE INDEX IF NOT EXISTS idx_profiles_role 
ON profiles(role);

-- Índice para búsquedas por discount_limit (para validaciones rápidas)
CREATE INDEX IF NOT EXISTS idx_profiles_discount_limit 
ON profiles(discount_limit) 
WHERE discount_limit > 0;

SELECT 'Índices creados' AS result;

-- ==========================================
-- VERIFICACIÓN FINAL
-- ==========================================
SELECT 'VERIFICACIÓN FINAL' AS step;

-- Debe mostrar exactamente 5 roles
SELECT DISTINCT role 
FROM profiles 
ORDER BY role;

-- Debe mostrar el nuevo constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass 
  AND conname = 'profiles_role_check';

-- Resumen final
SELECT 
  '✅ Migración completada' AS status,
  COUNT(DISTINCT role) AS roles_totales,
  COUNT(*) AS usuarios_totales,
  SUM(CASE WHEN discount_limit IS NOT NULL THEN 1 ELSE 0 END) AS usuarios_con_limite
FROM profiles;

-- ==========================================
-- NOTAS POST-MIGRACIÓN
-- ==========================================
/*
ACCIONES MANUALES NECESARIAS:

1. ASIGNAR ROL ACCOUNTANT (si aplica):
   UPDATE profiles 
   SET role = 'Accountant', discount_limit = 0.00
   WHERE email = 'contador@azmol.com';

2. VERIFICAR usuarios sin warehouse_id:
   SELECT id, name, role, warehouse_id
   FROM profiles
   WHERE role IN ('Sales', 'Warehouse') 
     AND warehouse_id IS NULL;

3. ACTUALIZAR EDGE FUNCTIONS:
   - supabase/functions/create-user/index.ts
   - Actualizar validRoles array

4. ACTUALIZAR FRONTEND:
   - src/types.ts (UserRole type)
   - src/services/i18n.tsx (traducciones)
   - src/components/UserManagement.tsx

5. DOCUMENTACIÓN:
   - Actualizar MANUAL-USUARIO.md
   - Actualizar .github/copilot-instructions.md
*/

-- ==========================================
-- ROLLBACK (en caso de emergencia)
-- ==========================================
/*
-- DESHACER MIGRACIÓN:
UPDATE profiles SET role = 'Delivery' WHERE role = 'Warehouse';
UPDATE profiles SET role = 'Cashier' WHERE role = 'Sales' AND discount_limit = 5.00;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('Admin', 'Manager', 'Sales', 'Delivery', 'Cashier'));
ALTER TABLE profiles DROP COLUMN IF EXISTS discount_limit;
*/
