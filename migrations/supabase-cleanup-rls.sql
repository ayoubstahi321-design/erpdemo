-- ========================================
-- SCRIPT DE LIMPIEZA: Eliminar todas las políticas RLS
-- ========================================
-- Ejecutar PRIMERO este script antes del schema
-- ========================================

-- Eliminar TODAS las políticas de profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated read" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated write" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated access" ON profiles;

-- Eliminar TODAS las políticas de warehouses
DROP POLICY IF EXISTS "Authenticated users can view warehouses" ON warehouses;
DROP POLICY IF EXISTS "Admins can manage warehouses" ON warehouses;
DROP POLICY IF EXISTS "Allow authenticated access" ON warehouses;

-- Eliminar TODAS las políticas de customers
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
DROP POLICY IF EXISTS "Users can manage customers" ON customers;
DROP POLICY IF EXISTS "Allow authenticated access" ON customers;

-- Eliminar TODAS las políticas de products
DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
DROP POLICY IF EXISTS "Authorized users can manage products" ON products;
DROP POLICY IF EXISTS "Allow authenticated access" ON products;

-- Eliminar TODAS las políticas de stock_levels
DROP POLICY IF EXISTS "Authenticated users can view stock" ON stock_levels;
DROP POLICY IF EXISTS "Authorized users can manage stock" ON stock_levels;
DROP POLICY IF EXISTS "Allow authenticated access" ON stock_levels;

-- Eliminar TODAS las políticas de sales
DROP POLICY IF EXISTS "Authenticated users can view sales" ON sales;
DROP POLICY IF EXISTS "Authorized users can create sales" ON sales;
DROP POLICY IF EXISTS "Authorized users can update sales" ON sales;
DROP POLICY IF EXISTS "Allow authenticated access" ON sales;

-- Eliminar TODAS las políticas de sale_items
DROP POLICY IF EXISTS "Authenticated users can view sale items" ON sale_items;
DROP POLICY IF EXISTS "Authorized users can manage sale items" ON sale_items;
DROP POLICY IF EXISTS "Allow authenticated access" ON sale_items;

-- Eliminar TODAS las políticas de payments
DROP POLICY IF EXISTS "Authenticated users can view payments" ON payments;
DROP POLICY IF EXISTS "Authorized users can manage payments" ON payments;
DROP POLICY IF EXISTS "Allow authenticated access" ON payments;

-- Eliminar TODAS las políticas de transfers
DROP POLICY IF EXISTS "Authenticated users can view transfers" ON transfers;
DROP POLICY IF EXISTS "Authorized users can manage transfers" ON transfers;
DROP POLICY IF EXISTS "Allow authenticated access" ON transfers;

-- Eliminar TODAS las políticas de transfer_items
DROP POLICY IF EXISTS "Authenticated users can view transfer items" ON transfer_items;
DROP POLICY IF EXISTS "Authorized users can manage transfer items" ON transfer_items;
DROP POLICY IF EXISTS "Allow authenticated access" ON transfer_items;

-- Eliminar TODAS las políticas de returns
DROP POLICY IF EXISTS "Authenticated users can view returns" ON returns;
DROP POLICY IF EXISTS "Authorized users can manage returns" ON returns;
DROP POLICY IF EXISTS "Allow authenticated access" ON returns;

-- Eliminar TODAS las políticas de return_items
DROP POLICY IF EXISTS "Authenticated users can view return items" ON return_items;
DROP POLICY IF EXISTS "Authorized users can manage return items" ON return_items;
DROP POLICY IF EXISTS "Allow authenticated access" ON return_items;

-- Eliminar TODAS las políticas de audit_logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow authenticated access" ON audit_logs;

-- Eliminar TODAS las políticas de company_settings
DROP POLICY IF EXISTS "Authenticated users can view settings" ON company_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON company_settings;
DROP POLICY IF EXISTS "Allow authenticated access" ON company_settings;

-- ========================================
-- DESHABILITAR RLS TEMPORALMENTE (para debugging)
-- ========================================
-- ADVERTENCIA: Esto permite acceso sin autenticación
-- Solo para testing, NO para producción
-- ========================================

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE returns DISABLE ROW LEVEL SECURITY;
ALTER TABLE return_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings DISABLE ROW LEVEL SECURITY;

-- ========================================
-- FIN
-- ========================================
