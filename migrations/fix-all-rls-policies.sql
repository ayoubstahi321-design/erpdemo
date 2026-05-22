-- ========================================
-- FIX: Corregir todas las políticas RLS para permitir INSERT/UPDATE
-- ========================================
-- Este script agrega WITH CHECK a todas las políticas FOR ALL
-- que necesitan permitir INSERT y UPDATE de datos

-- 1. PROFILES
DROP POLICY IF EXISTS "Allow authenticated write" ON profiles;
CREATE POLICY "Allow authenticated write" ON profiles
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. WAREHOUSES
DROP POLICY IF EXISTS "Allow authenticated access" ON warehouses;
CREATE POLICY "Allow authenticated access" ON warehouses
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. CUSTOMERS
DROP POLICY IF EXISTS "Allow authenticated access" ON customers;
CREATE POLICY "Allow authenticated access" ON customers
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. PRODUCTS (ya corregido, incluido por completitud)
DROP POLICY IF EXISTS "Authorized users can manage products" ON products;
CREATE POLICY "Authorized users can manage products" ON products
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

-- 5. STOCK_LEVELS (LA CAUSA DEL ERROR ACTUAL)
DROP POLICY IF EXISTS "Authorized users can manage stock" ON stock_levels;
CREATE POLICY "Authorized users can manage stock" ON stock_levels
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

-- 6. SALES
DROP POLICY IF EXISTS "Authorized users can manage sales" ON sales;
CREATE POLICY "Authorized users can manage sales" ON sales
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

-- 7. SALE_ITEMS
DROP POLICY IF EXISTS "Allow authenticated access" ON sale_items;
CREATE POLICY "Allow authenticated access" ON sale_items
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 8. PAYMENTS
DROP POLICY IF EXISTS "Allow authenticated access" ON payments;
CREATE POLICY "Allow authenticated access" ON payments
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 9. TRANSFERS
DROP POLICY IF EXISTS "Authorized users can manage transfers" ON transfers;
CREATE POLICY "Authorized users can manage transfers" ON transfers
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

-- 10. TRANSFER_ITEMS
DROP POLICY IF EXISTS "Allow authenticated access" ON transfer_items;
CREATE POLICY "Allow authenticated access" ON transfer_items
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 11. RETURNS
DROP POLICY IF EXISTS "Allow authenticated access" ON returns;
CREATE POLICY "Allow authenticated access" ON returns
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 12. RETURN_ITEMS
DROP POLICY IF EXISTS "Allow authenticated access" ON return_items;
CREATE POLICY "Allow authenticated access" ON return_items
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 13. AUDIT_LOGS
DROP POLICY IF EXISTS "Allow authenticated access" ON audit_logs;
CREATE POLICY "Allow authenticated access" ON audit_logs
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 14. COMPANY_SETTINGS
DROP POLICY IF EXISTS "Allow authenticated access" ON company_settings;
CREATE POLICY "Allow authenticated access" ON company_settings
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
