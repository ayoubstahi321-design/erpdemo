-- ========================================
-- MIGRATION: Update credited_amount when returns are created
-- ========================================
-- Purpose: Automatically update credited_amount when items are returned
-- This creates a credit note (nota de crédito) effect

-- Modify update_sale_return_status function to also update credited_amount
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
  
  -- Update the sale's return_status AND credited_amount
  UPDATE sales 
  SET 
    return_status = v_new_status,
    credited_amount = v_total_returned,
    updated_at = NOW()
  WHERE id = v_sale_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
