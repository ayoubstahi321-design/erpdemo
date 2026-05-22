-- Migration: Add bank_name to payments and credit_limit/notes to customers
-- Run this in the Supabase SQL Editor

-- ============================================
-- PART 1: payments table - Add bank_name
-- ============================================

-- Add bank_name column for tracking which bank a check/transfer is from
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- ============================================
-- PART 2: customers table - Add credit_limit and notes
-- ============================================

-- Add credit_limit column (0 = no limit)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0;

-- Add check constraint for credit_limit (must be >= 0)
DO $$ BEGIN
  ALTER TABLE customers ADD CONSTRAINT customers_credit_limit_check CHECK (credit_limit >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add notes column for internal notes about the customer
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================
-- Verify the changes
-- ============================================
SELECT 'payments' as table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'payments' AND column_name = 'bank_name'
UNION ALL
SELECT 'customers' as table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'customers' AND column_name IN ('credit_limit', 'notes');
