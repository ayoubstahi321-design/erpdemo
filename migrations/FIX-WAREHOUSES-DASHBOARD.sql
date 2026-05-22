-- FIX: Verificar y corregir tabla warehouses en Supabase

-- 1. VERIFICAR ESTRUCTURA
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'warehouses'
ORDER BY ordinal_position;

-- 2. VERIFICAR DATOS
SELECT * FROM warehouses ORDER BY name;

-- 3. VERIFICAR POLÍTICAS RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'warehouses'
ORDER BY policyname;

-- 4. VERIFICAR SI RLS ESTÁ HABILITADO
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'warehouses';

-- 5. SI NO HAY DATOS, CREAR ALMACENES DE PRUEBA
-- Descomenta si necesitas crear almacenes

/*
INSERT INTO warehouses (name, location, capacity, description)
VALUES 
  ('Almacén Principal', 'Central', 5000, 'Almacén central de distribución'),
  ('Almacén Secundario', 'Zona 2', 3000, 'Almacén secundario'),
  ('Almacén Express', 'Zona 3', 1000, 'Almacén pequeño para entregas rápidas')
ON CONFLICT (id) DO NOTHING;
*/

-- 6. SI RLS ESTÁ HABILITADO Y HAY PROBLEMAS, VERIFICAR PERMISOS DEL USUARIO
-- Ejecutar como usuario autenticado para ver si puede acceder

SELECT auth.uid() as current_user_id;

-- 7. PRUEBA: Ejecutar query como haría la app
SELECT * FROM warehouses LIMIT 10;
