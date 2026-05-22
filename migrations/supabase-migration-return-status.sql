-- ========================================
-- MIGRATION: Professional Return Status Tracking (Shopify/Odoo Style)
-- ========================================
-- Purpose:
-- 1. Add return_status column to sales table
-- 2. Implement automatic status tracking: null → 'partial' → 'full'
-- 3. Keep original sale visible with return indicator
-- 4. Maintain complete audit trail
-- ========================================

-- Step 1: Add return_status column to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS return_status TEXT DEFAULT NULL 
  CHECK (return_status IS NULL OR return_status IN ('partial', 'full'));

-- Step 2: Create function to calculate return amounts for a sale
CREATE OR REPLACE FUNCTION calculate_return_amount(
  p_sale_id UUID
)
RETURNS TABLE (
  total_returned NUMERIC,
  return_count INT,
  original_total NUMERIC,
  return_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(ri.quantity * si.unit_price), 0) as total_returned,
    COUNT(DISTINCT r.id)::INT as return_count,
    s.total_amount as original_total,
    ROUND(
      COALESCE(SUM(ri.quantity * si.unit_price), 0) / NULLIF(s.total_amount, 0) * 100, 2
    ) as return_percentage
  FROM sales s
  LEFT JOIN returns r ON r.original_sale_id = s.id AND r.deleted_at IS NULL
  LEFT JOIN return_items ri ON ri.return_id = r.id AND ri.deleted_at IS NULL
  LEFT JOIN sale_items si ON si.id = (
    SELECT id FROM sale_items 
    WHERE sale_id = s.id AND product_id = ri.product_id 
    LIMIT 1
  )
  WHERE s.id = p_sale_id
  GROUP BY s.id, s.total_amount;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create function to update sale return_status automatically
CREATE OR REPLACE FUNCTION update_sale_return_status()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_id UUID;
  v_total_returned NUMERIC;
  v_original_total NUMERIC;
  v_new_status TEXT;
BEGIN
  -- Get the sale ID
  v_sale_id := COALESCE(NEW.original_sale_id, OLD.original_sale_id);
  
  -- Get return amounts
  SELECT cr.total_returned, cr.original_total INTO v_total_returned, v_original_total
  FROM calculate_return_amount(v_sale_id) cr;
  
  -- Determine return status
  IF v_total_returned = 0 THEN
    v_new_status := NULL; -- No returns
  ELSIF v_total_returned >= v_original_total THEN
    v_new_status := 'full'; -- Full return
  ELSE
    v_new_status := 'partial'; -- Partial return
  END IF;
  
  -- Update the sale's return_status
  UPDATE sales 
  SET return_status = v_new_status, updated_at = NOW()
  WHERE id = v_sale_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 4: Drop old triggers if they exist
DROP TRIGGER IF EXISTS update_sale_return_status_on_return_insert ON returns;
DROP TRIGGER IF EXISTS update_sale_return_status_on_return_update ON returns;
DROP TRIGGER IF EXISTS update_sale_return_status_on_return_delete ON returns;
DROP TRIGGER IF EXISTS update_sale_return_status_on_return_item_insert ON return_items;
DROP TRIGGER IF EXISTS update_sale_return_status_on_return_item_update ON return_items;
DROP TRIGGER IF EXISTS update_sale_return_status_on_return_item_delete ON return_items;

-- Step 5: Create triggers to auto-update return_status
CREATE TRIGGER update_sale_return_status_on_return_insert
  AFTER INSERT ON returns
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_return_status();

CREATE TRIGGER update_sale_return_status_on_return_update
  AFTER UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_return_status();

CREATE TRIGGER update_sale_return_status_on_return_delete
  AFTER DELETE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_return_status();

CREATE TRIGGER update_sale_return_status_on_return_item_insert
  AFTER INSERT ON return_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_return_status();

CREATE TRIGGER update_sale_return_status_on_return_item_update
  AFTER UPDATE ON return_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_return_status();

CREATE TRIGGER update_sale_return_status_on_return_item_delete
  AFTER DELETE ON return_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_return_status();

-- Step 6: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_return_status ON sales(return_status);

-- Step 7: Create view for sales with return summary
CREATE OR REPLACE VIEW sales_with_returns AS
SELECT 
  s.*,
  r.return_count,
  r.total_returned,
  r.return_percentage,
  CASE 
    WHEN s.return_status = 'full' THEN '❌ Totalmente Devuelto'
    WHEN s.return_status = 'partial' THEN '⚠️ Parcialmente Devuelto'
    ELSE '✅ Sin Devoluciones'
  END AS return_status_label
FROM sales s
LEFT JOIN (
  SELECT 
    r.original_sale_id,
    COUNT(DISTINCT r.id) as return_count,
    COALESCE(SUM(ri.quantity * si.unit_price), 0) as total_returned,
    ROUND(
      COALESCE(SUM(ri.quantity * si.unit_price), 0) / NULLIF(s2.total_amount, 0) * 100, 2
    ) as return_percentage
  FROM returns r
  LEFT JOIN return_items ri ON ri.return_id = r.id AND ri.deleted_at IS NULL
  LEFT JOIN sale_items si ON si.id = (
    SELECT id FROM sale_items 
    WHERE sale_id = r.original_sale_id AND product_id = ri.product_id 
    LIMIT 1
  )
  LEFT JOIN sales s2 ON s2.id = r.original_sale_id
  WHERE r.deleted_at IS NULL
  GROUP BY r.original_sale_id, s2.total_amount
) r ON r.original_sale_id = s.id;

-- Step 8: Verify migration success
-- Run this to check:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns 
-- WHERE table_name = 'sales' AND column_name = 'return_status';
-- SELECT * FROM sales_with_returns LIMIT 5;
