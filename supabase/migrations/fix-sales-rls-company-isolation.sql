-- ============================================================================
-- FIX: Sales RLS company isolation + create_sale_atomic ownership validation
-- ============================================================================
-- Problem 1: fix-sales-rls-policies.sql created role-based SELECT policies
-- (Manager/Accountant see ALL sales) that override company-based isolation from
-- add-multi-tenant-rls-policies.sql. With permissive RLS policies PostgreSQL
-- uses OR logic — if ANY policy passes, the row is visible. This meant company
-- isolation was completely bypassed for Manager/Accountant roles.
--
-- Problem 2: create_sale_atomic uses SECURITY DEFINER (bypasses RLS), so any
-- authenticated user could create a sale for any company without server-side
-- ownership validation.
--
-- Run this ONCE in Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop ALL conflicting sales policies (clean slate)
-- ============================================================================
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON sales', pol.policyname);
    RAISE NOTICE 'Dropped: %', pol.policyname;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Recreate sales RLS — company-aware + role-aware
--
-- Design:
--   Admin (user_company_id() IS NULL): sees all sales across all companies
--   Manager/Accountant: sees only their company's sales
--   Salesperson/other: sees only their company's sales from their warehouse
-- ============================================================================

-- SELECT
CREATE POLICY "sales_select" ON sales
  FOR SELECT
  USING (
    public.user_company_id() IS NULL                -- Admin sees all
    OR company_id = public.user_company_id()        -- Others see own company only
    OR company_id IS NULL                           -- Legacy sales (pre-multi-tenant)
  );

-- INSERT: role check + company ownership
CREATE POLICY "sales_insert" ON sales
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('Admin', 'Manager', 'Salesperson', 'Cashier')
    )
    AND (
      public.user_company_id() IS NULL              -- Admin: any company
      OR company_id = public.user_company_id()      -- Others: own company only
    )
  );

-- UPDATE: Admin/Manager/Accountant only, own company
CREATE POLICY "sales_update" ON sales
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('Admin', 'Manager', 'Accountant')
    )
    AND (
      public.user_company_id() IS NULL
      OR company_id = public.user_company_id()
      OR company_id IS NULL
    )
  );

-- DELETE: Admin only
CREATE POLICY "sales_delete" ON sales
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'Admin'
    )
  );


-- ============================================================================
-- STEP 3: Do the same for sale_items (clean slate)
-- ============================================================================
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sale_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON sale_items', pol.policyname);
    RAISE NOTICE 'Dropped: %', pol.policyname;
  END LOOP;
END $$;

-- sale_items: always filter through parent sale's company_id
CREATE POLICY "sale_items_select" ON sale_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
        AND (
          public.user_company_id() IS NULL
          OR s.company_id = public.user_company_id()
          OR s.company_id IS NULL
        )
    )
  );

CREATE POLICY "sale_items_insert" ON sale_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
        AND (
          public.user_company_id() IS NULL
          OR s.company_id = public.user_company_id()
        )
    )
  );

CREATE POLICY "sale_items_update" ON sale_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sales s
        JOIN profiles p ON p.id = auth.uid()
      WHERE s.id = sale_items.sale_id
        AND p.role IN ('Admin', 'Manager', 'Accountant')
        AND (
          public.user_company_id() IS NULL
          OR s.company_id = public.user_company_id()
          OR s.company_id IS NULL
        )
    )
  );

CREATE POLICY "sale_items_delete" ON sale_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sales s
        JOIN profiles p ON p.id = auth.uid()
      WHERE s.id = sale_items.sale_id
        AND p.role IN ('Admin', 'Manager')
        AND (
          public.user_company_id() IS NULL
          OR s.company_id = public.user_company_id()
        )
    )
  );


-- ============================================================================
-- STEP 4: Recreate create_sale_atomic with company ownership validation
-- ============================================================================
DROP FUNCTION IF EXISTS create_sale_atomic(JSONB, JSONB, JSONB);

CREATE OR REPLACE FUNCTION create_sale_atomic(
  p_sale JSONB,
  p_items JSONB,
  p_stock_updates JSONB
) RETURNS void AS $$
DECLARE
  v_sale_id        UUID;
  v_item           JSONB;
  v_payment        JSONB;
  v_stock          JSONB;
  v_company_id     TEXT;
  v_caller_role    TEXT;
  v_caller_company TEXT;
BEGIN
  v_sale_id    := (p_sale->>'id')::UUID;
  v_company_id := NULLIF(p_sale->>'companyId', '');

  -- ── Company ownership validation ──────────────────────────────────────────
  -- SECURITY DEFINER bypasses RLS, so we enforce company ownership here.
  -- Non-Admin users can only create sales for their own assigned company.
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'Admin' THEN
    v_caller_company := public.user_company_id();

    IF v_company_id IS NULL THEN
      RAISE EXCEPTION 'Company required: non-Admin users must assign a company to every sale.';
    END IF;

    IF v_company_id != v_caller_company THEN
      RAISE EXCEPTION 'Access denied: you can only create sales for your assigned company (%). Attempted: %.',
        v_caller_company, v_company_id;
    END IF;
  END IF;
  -- ─────────────────────────────────────────────────────────────────────────

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


-- ============================================================================
-- STEP 5: Verify policy count
-- ============================================================================
DO $$
DECLARE
  sales_policies INTEGER;
  items_policies INTEGER;
BEGIN
  SELECT COUNT(*) INTO sales_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'sales';

  SELECT COUNT(*) INTO items_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'sale_items';

  RAISE NOTICE '============================================';
  RAISE NOTICE 'Sales RLS company isolation: FIXED';
  RAISE NOTICE 'sales policies: %', sales_policies;
  RAISE NOTICE 'sale_items policies: %', items_policies;
  RAISE NOTICE 'create_sale_atomic: company ownership validation added';
  RAISE NOTICE '============================================';
END $$;
