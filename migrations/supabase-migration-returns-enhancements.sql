-- ========================================
-- MIGRATION: Enhance returns table with validation and soft deletes
-- ========================================
-- Purpose:
-- 1. Add deleted_at column for soft-delete capability
-- 2. Add CHECK constraint to validate return qty <= sold qty
-- 3. Add RLS policy to restrict deletion to admins/managers
-- 4. Add indexes for better performance
-- ========================================

-- Step 1: Add deleted_at column for soft deletes
ALTER TABLE returns ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Add deleted_at column to return_items for audit trail
ALTER TABLE return_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Step 3: Create function to validate return quantity
-- This function ensures that the total quantity returned for an item
-- does not exceed the original sold quantity
CREATE OR REPLACE FUNCTION validate_return_quantity()
RETURNS TRIGGER AS $$
DECLARE
  v_original_qty NUMERIC;
  v_total_returned NUMERIC;
  v_sale_item_id UUID;
BEGIN
  -- Get the original quantity from sale_items
  SELECT si.quantity, si.id INTO v_original_qty, v_sale_item_id
  FROM sale_items si
  JOIN returns r ON r.original_sale_id = si.sale_id
  WHERE r.id = NEW.return_id
    AND si.product_id = NEW.product_id
  LIMIT 1;

  IF v_original_qty IS NULL THEN
    RAISE EXCEPTION 'Product not found in original sale';
  END IF;

  -- Calculate total quantity already returned (excluding this record if update)
  SELECT COALESCE(SUM(quantity), 0) INTO v_total_returned
  FROM return_items
  WHERE return_id = NEW.return_id
    AND product_id = NEW.product_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
    AND deleted_at IS NULL;

  -- Check if new return exceeds original quantity
  IF v_total_returned + NEW.quantity > v_original_qty THEN
    RAISE EXCEPTION 'Return quantity % exceeds sold quantity %. Total returned would be: %',
      NEW.quantity, v_original_qty, (v_total_returned + NEW.quantity);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS validate_return_quantity_trigger ON return_items;

-- Create trigger to validate return quantities on insert/update
CREATE TRIGGER validate_return_quantity_trigger
  BEFORE INSERT OR UPDATE ON return_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_return_quantity();

-- Step 4: Update RLS policies to filter soft-deleted records

-- Drop ALL existing policies on returns table
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'returns'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON returns';
  END LOOP;
END $$;

-- SELECT policy (excludes soft-deleted)
CREATE POLICY "returns_select_policy" ON returns
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND deleted_at IS NULL
  );

-- INSERT policy (Sales/Manager/Admin can create)
CREATE POLICY "returns_insert_policy" ON returns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales')
    )
  );

-- UPDATE policy (any authenticated user can update)
CREATE POLICY "returns_update_policy" ON returns
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE policy (only admins/managers can soft-delete)
CREATE POLICY "returns_delete_policy" ON returns
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  );

-- Step 5: Update return_items RLS policies

-- Drop ALL existing policies on return_items table
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'return_items'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON return_items';
  END LOOP;
END $$;

-- SELECT policy (excludes soft-deleted)
CREATE POLICY "return_items_select_policy" ON return_items
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND deleted_at IS NULL
  );

-- INSERT policy (Sales/Manager/Admin can create)
CREATE POLICY "return_items_insert_policy" ON return_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager', 'Sales')
    )
  );

-- UPDATE policy (any authenticated user can update)
CREATE POLICY "return_items_update_policy" ON return_items
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Step 6: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_returns_deleted_at ON returns(deleted_at);
CREATE INDEX IF NOT EXISTS idx_returns_original_sale_id ON returns(original_sale_id);
CREATE INDEX IF NOT EXISTS idx_return_items_deleted_at ON return_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_return_items_product_id ON return_items(product_id);

-- Step 7: Create view for audit trail of deleted returns
CREATE OR REPLACE VIEW deleted_returns_audit AS
SELECT 
  r.id,
  r.date,
  r.original_sale_id,
  r.customer_id,
  r.customer_name,
  r.warehouse_id,
  r.reason,
  r.deleted_at,
  r.created_by,
  ARRAY_AGG(
    json_build_object(
      'product_id', ri.product_id,
      'product_name', ri.product_name,
      'quantity', ri.quantity
    )
  ) as items
FROM returns r
LEFT JOIN return_items ri ON ri.return_id = r.id
WHERE r.deleted_at IS NOT NULL
GROUP BY r.id, r.date, r.original_sale_id, r.customer_id, 
         r.customer_name, r.warehouse_id, r.reason, r.deleted_at, r.created_by;

-- Step 8: Create audit function for tracking deletions
CREATE OR REPLACE FUNCTION audit_return_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert audit log when return is soft-deleted
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    INSERT INTO audit_logs (action, user_id, entity_type, entity_id, before_data, after_data)
    VALUES (
      'DELETE',
      auth.uid(),
      'return',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS audit_return_deletion_trigger ON returns;

-- Create trigger for audit logging
CREATE TRIGGER audit_return_deletion_trigger
  AFTER UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION audit_return_deletion();

-- ========================================
-- Verification Queries
-- ========================================
-- Check the migration was successful:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'returns';
-- SELECT * FROM pg_indexes WHERE tablename = 'returns';
-- SELECT * FROM pg_policies WHERE tablename = 'returns';
