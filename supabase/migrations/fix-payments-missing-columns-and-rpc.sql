-- ============================================================================
-- FIX: payments table missing columns + create_sale_atomic + log_admin_backup
-- ============================================================================
-- Root cause: create_sale_atomic references reference, recorded_by, bank_name
-- columns that were never added to the payments table → 400 on every POS sale.
-- Run this ONCE in Supabase SQL Editor.
-- ============================================================================

-- STEP 1: Add missing columns to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES auth.users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_name   TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference   TEXT;

-- STEP 2: Recreate create_sale_atomic with correct recorded_by cast
DROP FUNCTION IF EXISTS create_sale_atomic(JSONB, JSONB, JSONB);

CREATE OR REPLACE FUNCTION create_sale_atomic(
  p_sale JSONB,
  p_items JSONB,
  p_stock_updates JSONB
) RETURNS void AS $$
DECLARE
  v_sale_id   UUID;
  v_item      JSONB;
  v_payment   JSONB;
  v_stock     JSONB;
  v_company_id TEXT;
BEGIN
  v_sale_id    := (p_sale->>'id')::UUID;
  v_company_id := NULLIF(p_sale->>'companyId', '');

  -- Insert sale header
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
        id, sale_id, date, amount, method,
        check_number, due_date, payment_status,
        recorded_by, bank_name, reference,
        company_id
      ) VALUES (
        (v_payment->>'id')::UUID,
        v_sale_id,
        (v_payment->>'date')::TIMESTAMPTZ,
        (v_payment->>'amount')::NUMERIC,
        v_payment->>'method',
        NULLIF(v_payment->>'checkNumber', ''),
        NULLIF(v_payment->>'dueDate', '')::DATE,
        v_payment->>'paymentStatus',
        NULLIF(v_payment->>'recordedBy', '')::UUID,
        NULLIF(v_payment->>'bankName', ''),
        NULLIF(v_payment->>'reference', ''),
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


-- STEP 3: Create log_admin_backup function (called from App.tsx on every backup)
CREATE OR REPLACE FUNCTION log_admin_backup()
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
  VALUES (
    auth.uid(),
    'BACKUP',
    'System',
    auth.uid()::TEXT,
    format('Admin backup created at %s', NOW())
  );
EXCEPTION WHEN OTHERS THEN
  -- Don't let audit log failure block the backup
  NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- STEP 4: Verify
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'payments'
    AND column_name IN ('recorded_by', 'bank_name', 'reference');

  RAISE NOTICE '============================================';
  RAISE NOTICE 'payments missing columns added: %/3', col_count;
  RAISE NOTICE 'create_sale_atomic: recreated with UUID cast';
  RAISE NOTICE 'log_admin_backup: created';
  RAISE NOTICE '============================================';
END $$;
