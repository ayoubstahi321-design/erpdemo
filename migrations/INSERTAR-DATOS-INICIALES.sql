-- ========================================
-- SCRIPT DE DATOS INICIALES
-- ========================================
-- Ejecutar SOLO SI test-diagnostico-simple.sql indica que no hay datos

-- PASO 1: Insertar almacenes Tánger y Oujda
INSERT INTO warehouses (id, name, location, type, created_at, updated_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Tánger', 'Tánger, Morocco', 'Central', NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'Oujda', 'Oujda, Morocco', 'Branch', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  type = EXCLUDED.type,
  updated_at = NOW();

-- PASO 2: Insertar productos de ejemplo
INSERT INTO products (id, sku, name, category, cost, price, pack_size, unit, min_stock, created_at, updated_at) VALUES
  ('33333333-3333-3333-3333-333333333333', 'PROD001', 'Producto Ejemplo 1', 'General', 100.00, 150.00, 1, 'pcs', 10, NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', 'PROD002', 'Producto Ejemplo 2', 'General', 200.00, 300.00, 1, 'pcs', 5, NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555', 'PROD003', 'Producto Ejemplo 3', 'General', 50.00, 75.00, 1, 'pcs', 20, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  cost = EXCLUDED.cost,
  price = EXCLUDED.price,
  updated_at = NOW();

-- PASO 3: Insertar stock inicial en ambos almacenes
INSERT INTO stock_levels (product_id, warehouse_id, quantity, created_at, updated_at) VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 100, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 50, NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 75, NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 25, NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 200, NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 150, NOW(), NOW())
ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
  quantity = EXCLUDED.quantity,
  updated_at = NOW();

-- PASO 4: Verificar inserción
SELECT 
  '✅ Datos Iniciales Insertados' as resultado,
  (SELECT COUNT(*) FROM warehouses) as total_almacenes,
  (SELECT COUNT(*) FROM products) as total_productos,
  (SELECT COUNT(*) FROM stock_levels) as total_stock_entries;

-- PASO 5: Listar almacenes insertados
SELECT 'Almacenes:' as info, id, name, location, type FROM warehouses;

-- PASO 6: Listar productos insertados
SELECT 'Productos:' as info, id, sku, name, cost, price FROM products;

-- PASO 7: Listar stock por almacén
SELECT 
  'Stock por Almacén:' as info,
  w.name as almacen,
  p.name as producto,
  sl.quantity as cantidad
FROM stock_levels sl
JOIN warehouses w ON w.id = sl.warehouse_id
JOIN products p ON p.id = sl.product_id
ORDER BY w.name, p.name;
