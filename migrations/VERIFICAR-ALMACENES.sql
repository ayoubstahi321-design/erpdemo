-- PASO 1: Verificar que la tabla existe y tiene datos
SELECT COUNT(*) as total_warehouses FROM warehouses;

-- PASO 2: Ver todos los almacenes
SELECT id, name, location, capacity FROM warehouses ORDER BY name;

-- PASO 3: Si está vacío, crear almacenes de ejemplo
-- SOLO DESCOMENTA Y EJECUTA SI NO HAY DATOS

/*
INSERT INTO warehouses (name, location, capacity, description, created_at, updated_at)
SELECT 
  'Almacén Principal' as name,
  'Bogotá Centro' as location,
  10000 as capacity,
  'Almacén central de distribución' as description,
  NOW() as created_at,
  NOW() as updated_at
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE name = 'Almacén Principal')

UNION ALL

SELECT 
  'Almacén Secundario' as name,
  'Bogotá Sur' as location,
  5000 as capacity,
  'Almacén secundario' as description,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE name = 'Almacén Secundario')

UNION ALL

SELECT 
  'Almacén Express' as name,
  'Bogotá Norte' as location,
  2000 as capacity,
  'Almacén para entregas express' as description,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE name = 'Almacén Express');
*/
