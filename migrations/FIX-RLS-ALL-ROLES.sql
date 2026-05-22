-- ========================================
-- FIX: Políticas RLS para TODOS los roles
-- ========================================
-- Este script asegura que TODOS los usuarios autenticados puedan VER datos
-- pero solo ciertos roles puedan MODIFICAR según sus permisos

-- ==========================================
-- 1. WAREHOUSES - Todos pueden ver, solo Admin/Manager modifican
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated access" ON warehouses;
DROP POLICY IF EXISTS "warehouses_select_all_authenticated" ON warehouses;
DROP POLICY IF EXISTS "warehouses_modify_admin_manager" ON warehouses;
DROP POLICY IF EXISTS "warehouses_select_policy" ON warehouses;
DROP POLICY IF EXISTS "warehouses_modify_policy" ON warehouses;

-- Todos los autenticados pueden VER almacenes
CREATE POLICY "warehouses_select_policy" ON warehouses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo Admin/Manager pueden INSERTAR/ACTUALIZAR/ELIMINAR
CREATE POLICY "warehouses_modify_policy" ON warehouses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  );

-- ==========================================
-- 2. PRODUCTS - Todos pueden ver, Admin/Manager modifican
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
DROP POLICY IF EXISTS "Authorized users can manage products" ON products;
DROP POLICY IF EXISTS "products_select_policy" ON products;
DROP POLICY IF EXISTS "products_modify_policy" ON products;

-- Todos los autenticados pueden VER productos
CREATE POLICY "products_select_policy" ON products
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo Admin/Manager pueden INSERTAR/ACTUALIZAR/ELIMINAR
CREATE POLICY "products_modify_policy" ON products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  );

-- ==========================================
-- 3. STOCK_LEVELS - Todos pueden ver, varios roles modifican
-- ==========================================
DROP POLICY IF EXISTS "Authorized users can manage stock" ON stock_levels;
DROP POLICY IF EXISTS "stock_levels_select_policy" ON stock_levels;
DROP POLICY IF EXISTS "stock_levels_modify_policy" ON stock_levels;

-- Todos los autenticados pueden VER niveles de stock
CREATE POLICY "stock_levels_select_policy" ON stock_levels
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admin/Manager/Sales/Cashier/Delivery pueden modificar
CREATE POLICY "stock_levels_modify_policy" ON stock_levels
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier', 'Delivery')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier', 'Delivery')
    )
  );

-- ==========================================
-- 4. CUSTOMERS - Todos pueden ver, varios roles modifican
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated access" ON customers;
DROP POLICY IF EXISTS "customers_select_policy" ON customers;
DROP POLICY IF EXISTS "customers_modify_policy" ON customers;

-- Todos los autenticados pueden VER clientes
CREATE POLICY "customers_select_policy" ON customers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admin/Manager/Sales/Cashier pueden modificar
CREATE POLICY "customers_modify_policy" ON customers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier')
    )
  );

-- ==========================================
-- 5. SALES - Todos pueden ver, varios roles modifican
-- ==========================================
DROP POLICY IF EXISTS "Authorized users can manage sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can view sales" ON sales;
DROP POLICY IF EXISTS "Authorized users can create sales" ON sales;
DROP POLICY IF EXISTS "Authorized users can update sales" ON sales;
DROP POLICY IF EXISTS "sales_select_policy" ON sales;
DROP POLICY IF EXISTS "sales_modify_policy" ON sales;

-- Todos los autenticados pueden VER ventas
CREATE POLICY "sales_select_policy" ON sales
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admin/Manager/Sales/Cashier pueden INSERTAR/ACTUALIZAR
CREATE POLICY "sales_modify_policy" ON sales
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier')
    )
  );

-- ==========================================
-- 6. SALE_ITEMS - Todos pueden ver y modificar (vinculado a sales)
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated access" ON sale_items;
DROP POLICY IF EXISTS "sale_items_select_policy" ON sale_items;
DROP POLICY IF EXISTS "sale_items_modify_policy" ON sale_items;

-- Todos los autenticados pueden VER items de venta
CREATE POLICY "sale_items_select_policy" ON sale_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Todos los autenticados pueden modificar (control está en sales)
CREATE POLICY "sale_items_modify_policy" ON sale_items
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ==========================================
-- 7. PAYMENTS - Todos pueden ver, Admin/Manager/Sales/Cashier modifican
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated access" ON payments;
DROP POLICY IF EXISTS "payments_select_policy" ON payments;
DROP POLICY IF EXISTS "payments_modify_policy" ON payments;

-- Todos los autenticados pueden VER pagos
CREATE POLICY "payments_select_policy" ON payments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admin/Manager/Sales/Cashier pueden modificar
CREATE POLICY "payments_modify_policy" ON payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier')
    )
  );

-- ==========================================
-- 8. TRANSFERS - Todos pueden ver, Admin/Manager/Delivery modifican
-- ==========================================
DROP POLICY IF EXISTS "Authorized users can manage transfers" ON transfers;
DROP POLICY IF EXISTS "transfers_select_policy" ON transfers;
DROP POLICY IF EXISTS "transfers_modify_policy" ON transfers;

-- Todos los autenticados pueden VER transferencias
CREATE POLICY "transfers_select_policy" ON transfers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admin/Manager/Delivery pueden modificar
CREATE POLICY "transfers_modify_policy" ON transfers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Delivery')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Delivery')
    )
  );

-- ==========================================
-- 9. TRANSFER_ITEMS - Todos pueden ver y modificar (vinculado a transfers)
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated access" ON transfer_items;
DROP POLICY IF EXISTS "transfer_items_select_policy" ON transfer_items;
DROP POLICY IF EXISTS "transfer_items_modify_policy" ON transfer_items;

-- Todos los autenticados pueden VER items de transferencia
CREATE POLICY "transfer_items_select_policy" ON transfer_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Todos los autenticados pueden modificar (control está en transfers)
CREATE POLICY "transfer_items_modify_policy" ON transfer_items
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ==========================================
-- 10. RETURNS - Todos pueden ver, Admin/Manager/Sales/Cashier modifican
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated access" ON returns;
DROP POLICY IF EXISTS "returns_select_policy" ON returns;
DROP POLICY IF EXISTS "returns_modify_policy" ON returns;

-- Todos los autenticados pueden VER devoluciones
CREATE POLICY "returns_select_policy" ON returns
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admin/Manager/Sales/Cashier pueden modificar
CREATE POLICY "returns_modify_policy" ON returns
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales', 'Cashier')
    )
  );

-- ==========================================
-- 11. RETURN_ITEMS - Todos pueden ver y modificar (vinculado a returns)
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated access" ON return_items;
DROP POLICY IF EXISTS "return_items_select_policy" ON return_items;
DROP POLICY IF EXISTS "return_items_modify_policy" ON return_items;

-- Todos los autenticados pueden VER items de devolución
CREATE POLICY "return_items_select_policy" ON return_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Todos los autenticados pueden modificar (control está en returns)
CREATE POLICY "return_items_modify_policy" ON return_items
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ==========================================
-- 12. AUDIT_LOGS - Todos pueden ver, solo sistema puede insertar
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated access" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;

-- Todos los autenticados pueden VER logs de auditoría
CREATE POLICY "audit_logs_select_policy" ON audit_logs
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Todos pueden insertar logs (automáticos via triggers)
CREATE POLICY "audit_logs_insert_policy" ON audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ==========================================
-- 13. PROFILES - Todos pueden ver su perfil, Admin/Manager modifican
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated write" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_self_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_modify_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_delete_policy" ON profiles;

-- Todos los autenticados pueden VER perfiles
CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Usuarios pueden actualizar su propio perfil
CREATE POLICY "profiles_self_update_policy" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin/Manager pueden INSERTAR nuevos perfiles
CREATE POLICY "profiles_admin_insert_policy" ON profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  );

-- Admin/Manager pueden ACTUALIZAR cualquier perfil
CREATE POLICY "profiles_admin_update_policy" ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  );

-- Admin/Manager pueden ELIMINAR perfiles
CREATE POLICY "profiles_admin_delete_policy" ON profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  );

-- ==========================================
-- VERIFICACIÓN
-- ==========================================
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
