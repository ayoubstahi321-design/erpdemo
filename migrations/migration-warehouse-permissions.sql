-- ========================================
-- MIGRACIÓN: Sistema de Permisos por Almacén
-- Fecha: 2026-01-11
-- Descripción: Agregar campo warehouse_id a profiles y actualizar políticas RLS
-- ========================================

-- 1. AGREGAR CAMPO WAREHOUSE_ID A PROFILES
-- ========================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

-- Índice para mejorar performance en queries de usuarios por almacén
CREATE INDEX IF NOT EXISTS idx_profiles_warehouse ON profiles(warehouse_id);

-- Comentario de documentación
COMMENT ON COLUMN profiles.warehouse_id IS 'Almacén asignado al usuario (NULL = Admin/Manager con acceso a todos)';


-- 2. DATOS DE PRUEBA (OPCIONAL)
-- ========================================
-- Migrar usuarios existentes: Asignar usuarios no-admin al primer almacén por defecto
-- COMENTADO: Descomentar si quieres asignar automáticamente almacenes

-- UPDATE profiles
-- SET warehouse_id = '550e8400-e29b-41d4-a716-446655440001'
-- WHERE role NOT IN ('Admin', 'Manager')
--   AND warehouse_id IS NULL;


-- 3. ACTUALIZAR POLÍTICAS RLS
-- ========================================

-- 3.1: Política para STOCK_LEVELS
-- Usuarios solo ven stock de su almacén, Admin/Manager ven todo
-- ========================================

DROP POLICY IF EXISTS "Users can view stock by warehouse" ON stock_levels;

CREATE POLICY "Users can view stock by warehouse" ON stock_levels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (
          role IN ('Admin', 'Manager')  -- Admin/Manager ven todo
          OR warehouse_id = stock_levels.warehouse_id  -- Otros solo su almacén
        )
    )
  );


-- 3.2: Política para SALES
-- Usuarios solo crean ventas desde su almacén, Admin/Manager desde cualquiera
-- ========================================

DROP POLICY IF EXISTS "Users can create sales from their warehouse" ON sales;

CREATE POLICY "Users can create sales from their warehouse" ON sales
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (
          role IN ('Admin', 'Manager')  -- Admin/Manager pueden vender desde cualquier almacén
          OR warehouse_id = sales.warehouse_id  -- Otros solo desde su almacén
        )
    )
  );

-- Mantener la política de SELECT existente
DROP POLICY IF EXISTS "Users can view sales from their warehouse" ON sales;

CREATE POLICY "Users can view sales from their warehouse" ON sales
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (
          role IN ('Admin', 'Manager')  -- Admin/Manager ven todas las ventas
          OR warehouse_id = sales.warehouse_id  -- Otros solo ventas de su almacén
        )
    )
  );


-- 3.3: Política para TRANSFERS
-- Usuarios solo transfieren desde/hacia su almacén, Admin/Manager entre cualquiera
-- ========================================

DROP POLICY IF EXISTS "Users can create transfers for their warehouse" ON transfers;

CREATE POLICY "Users can create transfers for their warehouse" ON transfers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (
          role IN ('Admin', 'Manager')  -- Admin/Manager pueden transferir entre cualquier almacén
          OR warehouse_id = transfers.from_warehouse_id  -- Otros solo desde su almacén
          OR warehouse_id = transfers.to_warehouse_id    -- O hacia su almacén
        )
    )
  );

DROP POLICY IF EXISTS "Users can view transfers for their warehouse" ON transfers;

CREATE POLICY "Users can view transfers for their warehouse" ON transfers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (
          role IN ('Admin', 'Manager')  -- Admin/Manager ven todas las transferencias
          OR warehouse_id = transfers.from_warehouse_id  -- Otros solo transferencias desde su almacén
          OR warehouse_id = transfers.to_warehouse_id    -- O hacia su almacén
        )
    )
  );


-- 4. VERIFICACIÓN
-- ========================================
-- Consulta para verificar la migración

SELECT
  '✓ Verificación de Migración' AS info,
  COUNT(*) AS total_usuarios,
  COUNT(warehouse_id) AS usuarios_con_almacen,
  COUNT(*) - COUNT(warehouse_id) AS usuarios_sin_almacen
FROM profiles;

-- Ver usuarios con sus almacenes asignados
SELECT
  p.name AS usuario,
  p.role AS rol,
  p.email,
  w.name AS almacen_asignado,
  CASE
    WHEN p.warehouse_id IS NULL THEN 'Acceso a todos los almacenes'
    ELSE 'Acceso limitado a su almacén'
  END AS tipo_acceso
FROM profiles p
LEFT JOIN warehouses w ON p.warehouse_id = w.id
ORDER BY p.role, p.name;


-- ========================================
-- FIN DE LA MIGRACIÓN
-- ========================================
--
-- INSTRUCCIONES PARA EJECUTAR:
-- 1. Abre Supabase Dashboard → SQL Editor
-- 2. Copia y pega este script completo
-- 3. Ejecuta (Run)
-- 4. Verifica los resultados de las consultas de verificación
-- 5. Asigna almacenes a usuarios existentes si es necesario
--
-- ROLLBACK (si es necesario):
-- ALTER TABLE profiles DROP COLUMN IF EXISTS warehouse_id;
-- DROP INDEX IF EXISTS idx_profiles_warehouse;
-- (Y restaurar políticas RLS originales)
