-- Migration: Add source and document_type fields to sales table
-- Description: Adds fields to differentiate between POS and B2B sales, and document types
-- Also adds missing fields for global discounts and return tracking
-- Date: 2026-01-29

-- Add new columns to sales table
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS invoice_number TEXT,
ADD COLUMN IF NOT EXISTS delivery_note_number TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'B2B' CHECK (source IN ('POS', 'B2B')),
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'INVOICE' CHECK (document_type IN ('TICKET', 'INVOICE', 'DELIVERY_NOTE')),
ADD COLUMN IF NOT EXISTS is_fast_sale BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS global_discount_type TEXT CHECK (global_discount_type IN ('percentage', 'fixed')),
ADD COLUMN IF NOT EXISTS global_discount_value NUMERIC DEFAULT 0 CHECK (global_discount_value >= 0),
ADD COLUMN IF NOT EXISTS global_discount_amount NUMERIC DEFAULT 0 CHECK (global_discount_amount >= 0),
ADD COLUMN IF NOT EXISTS items_subtotal NUMERIC DEFAULT 0 CHECK (items_subtotal >= 0),
ADD COLUMN IF NOT EXISTS return_status TEXT CHECK (return_status IN ('partial', 'full'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_source ON sales(source);
CREATE INDEX IF NOT EXISTS idx_sales_document_type ON sales(document_type);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_note_number ON sales(delivery_note_number);

-- Add comments for documentation
COMMENT ON COLUMN sales.source IS 'Origin of sale: POS (fast counter sales) or B2B (detailed business sales)';
COMMENT ON COLUMN sales.document_type IS 'Type of document: TICKET (receipt), INVOICE (formal invoice), or DELIVERY_NOTE (delivery slip)';
COMMENT ON COLUMN sales.is_fast_sale IS 'True for quick POS sales, false for detailed B2B orders';
COMMENT ON COLUMN sales.invoice_number IS 'Sequential invoice number (e.g., F-2026-00001)';
COMMENT ON COLUMN sales.delivery_note_number IS 'Sequential delivery note number (e.g., BL-2026-00001)';
COMMENT ON COLUMN sales.global_discount_type IS 'Type of global discount: percentage or fixed amount';
COMMENT ON COLUMN sales.global_discount_value IS 'Value of global discount (5 for 5% or 100 for 100 DH)';
COMMENT ON COLUMN sales.global_discount_amount IS 'Calculated global discount amount in currency';
COMMENT ON COLUMN sales.items_subtotal IS 'Subtotal of all items before global discount';
COMMENT ON COLUMN sales.return_status IS 'Return status: partial (some items returned) or full (all items returned)';

-- Update existing sales to have default values
UPDATE sales
SET
  source = 'B2B',
  document_type = 'INVOICE',
  is_fast_sale = FALSE
WHERE source IS NULL;

-- Make source and document_type NOT NULL after setting defaults
ALTER TABLE sales
ALTER COLUMN source SET NOT NULL,
ALTER COLUMN document_type SET NOT NULL;
