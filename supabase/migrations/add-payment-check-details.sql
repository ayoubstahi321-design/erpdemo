-- Migration: Add check and traite tracking fields to payments
-- Description: Professional accounting for deferred payment instruments
-- Date: 2026-01-29

-- Add fields to payments table for check/traite tracking
ALTER TABLE payments ADD COLUMN IF NOT EXISTS check_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Cashed', 'Bounced'));

-- Add comments for documentation
COMMENT ON COLUMN payments.check_number IS 'Check or Traite number for tracking deferred payments';
COMMENT ON COLUMN payments.due_date IS 'Maturity date when check/traite can be cashed';
COMMENT ON COLUMN payments.payment_status IS 'Status: Pending (waiting to cash), Cashed (collected), Bounced (rejected)';

-- Create index for querying by due date (for alerts and reports)
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);

-- Add constraint: check_number and due_date required for Check and Traite methods
-- Note: This is a soft constraint - we'll enforce it in the application layer
-- to allow flexibility for other payment methods

COMMENT ON TABLE payments IS 'Payment records with support for deferred payment instruments (checks, traites) including tracking numbers and maturity dates';
