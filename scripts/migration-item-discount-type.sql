-- Migration: Add discount_type column to sale_items table
-- This allows item-level discounts to be either percentage (%) or fixed amount (MAD)
-- Run this in the Supabase SQL Editor

-- Add the discount_type column with default 'percentage' for backwards compatibility
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage';

-- Add check constraint to ensure only valid values
ALTER TABLE sale_items
ADD CONSTRAINT sale_items_discount_type_check
CHECK (discount_type IN ('percentage', 'fixed'));

-- Update any NULL values to 'percentage' (shouldn't happen but just in case)
UPDATE sale_items SET discount_type = 'percentage' WHERE discount_type IS NULL;

-- Verify the change
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sale_items' AND column_name = 'discount_type';
