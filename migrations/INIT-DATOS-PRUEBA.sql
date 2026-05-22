-- ========================================
-- SCRIPT DE INICIALIZACIÓN RÁPIDA
-- Datos de prueba para Azmol StockERP
-- ========================================
-- Ejecutar SOLO si las tablas están vacías

-- 1. CREAR ALMACENES
INSERT INTO warehouses (id, name, location, type, created_at, updated_at)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'Almacén Central - Casablanca', 'Casablanca', 'Central', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'Almacén Rabat', 'Rabat', 'Branch', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440003', 'Almacén Tánger', 'Tánger', 'Branch', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. CREAR PRODUCTOS DE PRUEBA
INSERT INTO products (id, sku, name, cost, price, category, pack_size, unit, min_stock, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'PROD-001', 'Aceite Lubricante 5W30', 80.00, 150.00, 'Lubricantes', 1, 'L', 50, NOW(), NOW()),
  (gen_random_uuid(), 'PROD-002', 'Filtro de Aceite Universal', 25.00, 50.00, 'Repuestos', 1, 'pcs', 100, NOW(), NOW()),
  (gen_random_uuid(), 'PROD-003', 'Aditivo Motor Diesel', 120.00, 220.00, 'Aditivos', 1, 'L', 30, NOW(), NOW()),
  (gen_random_uuid(), 'PROD-004', 'Refrigerante Anticongelante', 45.00, 85.00, 'Refrigerantes', 1, 'L', 60, NOW(), NOW()),
  (gen_random_uuid(), 'PROD-005', 'Grasa Multiusos', 35.00, 65.00, 'Lubricantes', 1, 'kg', 40, NOW(), NOW())
ON CONFLICT (sku) DO NOTHING;

-- 3. ASIGNAR STOCK INICIAL A ALMACÉN PRINCIPAL
INSERT INTO stock_levels (product_id, warehouse_id, quantity, created_at, updated_at)
SELECT 
  p.id as product_id,
  '550e8400-e29b-41d4-a716-446655440001'::uuid as warehouse_id,
  100 as quantity,
  NOW() as created_at,
  NOW() as updated_at
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM stock_levels sl 
  WHERE sl.product_id = p.id 
  AND sl.warehouse_id = '550e8400-e29b-41d4-a716-446655440001'
);

-- 4. CREAR CLIENTE GENÉRICO "MOSTRADOR"
INSERT INTO customers (id, name, type, phone, address, city, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'Cliente Mostrador', 'Individual', '+212-000-000000', 'Sin dirección', 'Casablanca', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 5. ASIGNAR ALMACÉN AL USUARIO ACTUAL (para que pueda ver datos)
UPDATE profiles 
SET warehouse_id = '550e8400-e29b-41d4-a716-446655440001'
WHERE id = auth.uid()
AND warehouse_id IS NULL;

-- VERIFICACIÓN: Comprobar que los datos se crearon correctamente
SELECT 
  (SELECT COUNT(*) FROM warehouses) as total_warehouses,
  (SELECT COUNT(*) FROM products) as total_products,
  (SELECT COUNT(*) FROM stock_levels) as total_stock_entries,
  (SELECT COUNT(*) FROM customers) as total_customers;

-- Ver almacén asignado al usuario actual
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.warehouse_id,
  w.name as warehouse_name
FROM profiles p
LEFT JOIN warehouses w ON w.id = p.warehouse_id
WHERE p.id = auth.uid();
