-- ================================================
-- DEBUG SCRIPT - Verificar si los datos existen
-- ================================================

-- 1. Contar cuántos almacenes existen
SELECT 'Warehouses' as table_name, COUNT(*) as total FROM warehouses;

-- 2. Contar cuántos productos existen
SELECT 'Products' as table_name, COUNT(*) as total FROM products;

-- 3. Ver los almacenes
SELECT id, name, location, created_at FROM warehouses ORDER BY created_at DESC;

-- 4. Ver los primeros 10 productos
SELECT id, sku, name, category, price, cost FROM products LIMIT 10;

-- 5. Ver stock levels
SELECT 
    p.id, 
    p.name, 
    sl.warehouse_id, 
    sl.quantity
FROM products p
LEFT JOIN stock_levels sl ON p.id = sl.product_id
LIMIT 20;

-- 6. Ver perfiles de usuario y sus roles
SELECT id, email, name, role, warehouse_id FROM profiles;

-- 7. Verificar políticas RLS en cada tabla
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('warehouses', 'products', 'stock_levels', 'profiles')
ORDER BY tablename, policyname;

-- 8. Contar ventas
SELECT 'Sales' as table_name, COUNT(*) as total FROM sales;

-- 9. Contar clientes
SELECT 'Customers' as table_name, COUNT(*) as total FROM customers;

-- 10. Contar transferencias
SELECT 'Transfers' as table_name, COUNT(*) as total FROM transfers;
