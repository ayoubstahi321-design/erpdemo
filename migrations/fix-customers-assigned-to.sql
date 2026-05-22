-- Step 1: Add assigned_to column (sales rep who owns this customer)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Step 2: Drop existing RLS policies (names may vary)
DROP POLICY IF EXISTS "Enable read access for all users" ON customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON customers;
DROP POLICY IF EXISTS "Enable update for users based on email" ON customers;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON customers;
DROP POLICY IF EXISTS "customers_select_policy" ON customers;
DROP POLICY IF EXISTS "customers_insert_policy" ON customers;
DROP POLICY IF EXISTS "customers_update_policy" ON customers;
DROP POLICY IF EXISTS "customers_delete_policy" ON customers;
DROP POLICY IF EXISTS "customers_select" ON customers;
DROP POLICY IF EXISTS "customers_insert" ON customers;
DROP POLICY IF EXISTS "customers_update" ON customers;
DROP POLICY IF EXISTS "customers_delete" ON customers;

-- Step 3: New RLS policies

-- SELECT: Admin/Manager/Accountant/Warehouse see all; Sales sees only their own
CREATE POLICY "customers_select" ON customers FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('Admin', 'Manager', 'Accountant', 'Warehouse')
  )
  OR (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Sales')
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
  )
);

-- INSERT: Any authenticated user (assigned_to set by client)
CREATE POLICY "customers_insert" ON customers FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Admin/Manager/Accountant can update any; Sales only their own
CREATE POLICY "customers_update" ON customers FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('Admin', 'Manager', 'Accountant')
  )
  OR (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Sales')
    AND assigned_to = auth.uid()
  )
);

-- DELETE: Only Admin/Manager
CREATE POLICY "customers_delete" ON customers FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('Admin', 'Manager')
  )
);
