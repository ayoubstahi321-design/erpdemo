-- FIX: Manager cannot delete payments + payments nested join may be empty
-- Run in Supabase SQL Editor

DROP POLICY IF EXISTS "payments_select" ON payments;
DROP POLICY IF EXISTS "payments_insert" ON payments;
DROP POLICY IF EXISTS "payments_update" ON payments;
DROP POLICY IF EXISTS "payments_delete" ON payments;
-- Drop any other conflicting payment policies
DROP POLICY IF EXISTS "Authenticated users can view payments" ON payments;
DROP POLICY IF EXISTS "Users can view company payments" ON payments;
DROP POLICY IF EXISTS "Authorized users can create payments" ON payments;

-- SELECT: any authenticated user (company isolation at sales level)
CREATE POLICY "payments_select" ON payments
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT: roles that can handle payments
CREATE POLICY "payments_insert" ON payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Accountant', 'Cashier', 'Sales', 'Salesperson')
    )
  );

-- UPDATE: Admin, Manager, Accountant
CREATE POLICY "payments_update" ON payments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Accountant')
    )
  );

-- DELETE: Admin and Manager (Manager needs to correct wrong payments)
CREATE POLICY "payments_delete" ON payments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager')
    )
  );
