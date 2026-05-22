-- ========================================
-- COMPLETE FIX: update_stock_level + create_sale_atomic + update_sale_optimistic
-- ========================================
-- Run this ONCE in Supabase SQL Editor.
-- It drops and recreates all 3 functions to ensure consistency.
-- ========================================

-- STEP 0: Ensure missing columns exist
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS is_gift BOOLEAN DEFAULT false;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage';
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS sell_mode TEXT DEFAULT 'unit';
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS units_per_box INTEGER DEFAULT 1;

-- Remove strict CHECK on audit_logs.action if it exists (it blocks 'UPDATE' from stock function)
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
-- Make user_name nullable (update_stock_level doesn't have username context)
ALTER TABLE audit_logs ALTER COLUMN user_name DROP NOT NULL;

-- ========================================
-- 1. update_stock_level (FIXED)
-- ========================================
DROP FUNCTION IF EXISTS update_stock_level(UUID, UUID, NUMERIC, TEXT, UUID);

CREATE OR REPLACE FUNCTION update_stock_level(
  p_product_id UUID,
  p_warehouse_id UUID,
  p_delta NUMERIC,
  p_reason TEXT,
  p_user_id UUID
) RETURNS stock_levels AS $$
DECLARE
  v_stock stock_levels;
  v_new_quantity NUMERIC;
BEGIN
  -- Lock row to prevent race conditions
  SELECT * INTO v_stock
  FROM stock_levels
  WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
  FOR UPDATE;

  -- Calculate new quantity
  IF v_stock.id IS NULL THEN
    v_new_quantity := GREATEST(0, p_delta);
  ELSE
    v_new_quantity := COALESCE(v_stock.quantity, 0) + p_delta;
  END IF;

  -- Prevent negative stock
  IF v_new_quantity < 0 THEN
    v_new_quantity := 0;
  END IF;

  -- Upsert stock level
  INSERT INTO stock_levels (product_id, warehouse_id, quantity)
  VALUES (p_product_id, p_warehouse_id, v_new_quantity)
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET
    quantity = v_new_quantity,
    updated_at = TIMEZONE('utc'::text, NOW())
  RETURNING * INTO v_stock;

  -- Audit log (best-effort, don't block on failure)
  BEGIN
    INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
    VALUES (
      p_user_id,
      'UPDATE',
      'StockLevel',
      p_product_id::TEXT,
      format('Stock delta %s (%s)', p_delta, COALESCE(p_reason, 'N/A'))
    );
  EXCEPTION WHEN OTHERS THEN
    -- Don't let audit log failure block stock updates
    NULL;
  END;

  RETURN v_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ========================================
-- 2. create_sale_atomic
-- ========================================
DROP FUNCTION IF EXISTS create_sale_atomic(JSONB, JSONB, JSONB);

CREATE OR REPLACE FUNCTION create_sale_atomic(
  p_sale JSONB,
  p_items JSONB,
  p_stock_updates JSONB
) RETURNS void AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_payment JSONB;
  v_stock JSONB;
  v_company_id TEXT;
BEGIN
  v_sale_id := (p_sale->>'id')::UUID;
  v_company_id := NULLIF(p_sale->>'companyId', '');

  -- Insert the sale header
  INSERT INTO sales (
    id, date, warehouse_id, customer_id, customer_name, customer_type,
    source, document_type, is_fast_sale, company_id,
    invoice_number, delivery_note_number,
    global_discount_type, global_discount_value, global_discount_amount,
    items_subtotal, subtotal_amount, tax_rate, tax_amount, total_amount,
    amount_paid, payment_status, credited_amount, status, created_by
  ) VALUES (
    v_sale_id,
    (p_sale->>'date')::TIMESTAMPTZ,
    (p_sale->>'warehouseId')::UUID,
    NULLIF(p_sale->>'customerId', '')::UUID,
    p_sale->>'customerName',
    p_sale->>'customerType',
    COALESCE(p_sale->>'source', 'B2B'),
    COALESCE(p_sale->>'documentType', 'INVOICE'),
    COALESCE((p_sale->>'isFastSale')::BOOLEAN, false),
    v_company_id,
    p_sale->>'invoiceNumber',
    p_sale->>'deliveryNoteNumber',
    p_sale->>'globalDiscountType',
    (p_sale->>'globalDiscountValue')::NUMERIC,
    (p_sale->>'globalDiscountAmount')::NUMERIC,
    (p_sale->>'itemsSubtotal')::NUMERIC,
    (p_sale->>'subtotalAmount')::NUMERIC,
    (p_sale->>'taxRate')::NUMERIC,
    (p_sale->>'taxAmount')::NUMERIC,
    (p_sale->>'totalAmount')::NUMERIC,
    (p_sale->>'amountPaid')::NUMERIC,
    p_sale->>'paymentStatus',
    COALESCE((p_sale->>'creditedAmount')::NUMERIC, 0),
    p_sale->>'status',
    auth.uid()
  );

  -- Insert sale items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sale_items (
      id, sale_id, product_id, product_name,
      quantity, unit_price, discount, discount_type, total,
      is_gift, sell_mode, units_per_box
    ) VALUES (
      (v_item->>'id')::UUID,
      v_sale_id,
      (v_item->>'productId')::UUID,
      v_item->>'productName',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unitPrice')::NUMERIC,
      COALESCE((v_item->>'discount')::NUMERIC, 0),
      COALESCE(v_item->>'discountType', 'percentage'),
      (v_item->>'total')::NUMERIC,
      COALESCE((v_item->>'isGift')::BOOLEAN, false),
      COALESCE(v_item->>'sellMode', 'unit'),
      COALESCE((v_item->>'unitsPerBox')::INTEGER, 1)
    );
  END LOOP;

  -- Insert payments (if any)
  IF p_sale ? 'payments' AND jsonb_array_length(p_sale->'payments') > 0 THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_sale->'payments')
    LOOP
      INSERT INTO payments (
        id, sale_id, date, amount, method, reference,
        check_number, due_date, payment_status, recorded_by, bank_name,
        company_id
      ) VALUES (
        (v_payment->>'id')::UUID,
        v_sale_id,
        (v_payment->>'date')::TIMESTAMPTZ,
        (v_payment->>'amount')::NUMERIC,
        v_payment->>'method',
        v_payment->>'reference',
        v_payment->>'checkNumber',
        NULLIF(v_payment->>'dueDate', '')::DATE,
        v_payment->>'paymentStatus',
        v_payment->>'recordedBy',
        v_payment->>'bankName',
        v_company_id
      );
    END LOOP;
  END IF;

  -- Apply stock deductions
  FOR v_stock IN SELECT * FROM jsonb_array_elements(p_stock_updates)
  LOOP
    PERFORM update_stock_level(
      (v_stock->>'product_id')::UUID,
      (v_stock->>'warehouse_id')::UUID,
      (v_stock->>'delta')::NUMERIC,
      format('Sale #%s', v_sale_id),
      auth.uid()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ========================================
-- 3. update_sale_optimistic
-- ========================================
DROP FUNCTION IF EXISTS update_sale_optimistic(UUID, TEXT, JSONB, JSONB, JSONB, JSONB);

CREATE OR REPLACE FUNCTION update_sale_optimistic(
  p_sale_id UUID,
  p_expected_updated_at TEXT,
  p_new_items JSONB,
  p_old_stock_reversals JSONB,
  p_new_stock_deductions JSONB,
  p_sale_updates JSONB
) RETURNS void AS $$
DECLARE
  v_current_updated_at TIMESTAMPTZ;
  v_item JSONB;
  v_stock JSONB;
BEGIN
  -- Optimistic lock
  SELECT updated_at INTO v_current_updated_at
  FROM sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF v_current_updated_at IS NULL THEN
    RAISE EXCEPTION 'Sale not found: %', p_sale_id;
  END IF;

  IF v_current_updated_at > (p_expected_updated_at::TIMESTAMPTZ + INTERVAL '1 second') THEN
    RAISE EXCEPTION 'CONFLICT: Sale was modified by another user. Expected: %, Current: %',
      p_expected_updated_at, v_current_updated_at;
  END IF;

  -- Reverse old stock
  FOR v_stock IN SELECT * FROM jsonb_array_elements(p_old_stock_reversals)
  LOOP
    PERFORM update_stock_level(
      (v_stock->>'product_id')::UUID,
      (v_stock->>'warehouse_id')::UUID,
      (v_stock->>'delta')::NUMERIC,
      format('Sale edit reversal #%s', p_sale_id),
      auth.uid()
    );
  END LOOP;

  -- Delete old items
  DELETE FROM sale_items WHERE sale_id = p_sale_id;

  -- Insert new items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_new_items)
  LOOP
    INSERT INTO sale_items (
      id, sale_id, product_id, product_name,
      quantity, unit_price, discount, discount_type, total,
      is_gift, sell_mode, units_per_box
    ) VALUES (
      (v_item->>'id')::UUID,
      p_sale_id,
      (v_item->>'productId')::UUID,
      v_item->>'productName',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unitPrice')::NUMERIC,
      COALESCE((v_item->>'discount')::NUMERIC, 0),
      COALESCE(v_item->>'discountType', 'percentage'),
      (v_item->>'total')::NUMERIC,
      COALESCE((v_item->>'isGift')::BOOLEAN, false),
      COALESCE(v_item->>'sellMode', 'unit'),
      COALESCE((v_item->>'unitsPerBox')::INTEGER, 1)
    );
  END LOOP;

  -- Deduct new stock
  FOR v_stock IN SELECT * FROM jsonb_array_elements(p_new_stock_deductions)
  LOOP
    PERFORM update_stock_level(
      (v_stock->>'product_id')::UUID,
      (v_stock->>'warehouse_id')::UUID,
      (v_stock->>'delta')::NUMERIC,
      format('Sale edit deduction #%s', p_sale_id),
      auth.uid()
    );
  END LOOP;

  -- Update sale totals
  UPDATE sales SET
    items_subtotal = (p_sale_updates->>'itemsSubtotal')::NUMERIC,
    global_discount_amount = (p_sale_updates->>'globalDiscountAmount')::NUMERIC,
    subtotal_amount = (p_sale_updates->>'subtotalAmount')::NUMERIC,
    tax_amount = (p_sale_updates->>'taxAmount')::NUMERIC,
    total_amount = (p_sale_updates->>'totalAmount')::NUMERIC,
    amount_paid = (p_sale_updates->>'amountPaid')::NUMERIC,
    payment_status = p_sale_updates->>'paymentStatus',
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ========================================
-- 4. Drop sale_items trigger (prevents double stock update)
-- ========================================
DROP TRIGGER IF EXISTS trigger_update_stock_on_sale_item ON sale_items;
DROP TRIGGER IF EXISTS trigger_update_stock_on_return_item ON return_items;
