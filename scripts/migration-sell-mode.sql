-- Migration: Add sell_mode and units_per_box columns for flexible unit/box sales
-- Run this in the Supabase SQL Editor

-- ============================================
-- PART 1: sale_items table
-- ============================================

-- Add the sell_mode column with default 'unit' for backwards compatibility
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS sell_mode TEXT DEFAULT 'unit';

-- Add check constraint to ensure only valid sell_mode values
DO $$ BEGIN
  ALTER TABLE sale_items ADD CONSTRAINT sale_items_sell_mode_check CHECK (sell_mode IN ('unit', 'box'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rename pack_size to units_per_box if it exists (for existing installations)
DO $$ BEGIN
  ALTER TABLE sale_items RENAME COLUMN pack_size TO units_per_box;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- Add units_per_box column if it doesn't exist (for new installations)
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS units_per_box INTEGER DEFAULT 1;

-- Add check constraint for units_per_box
DO $$ BEGIN
  ALTER TABLE sale_items ADD CONSTRAINT sale_items_units_per_box_check CHECK (units_per_box >= 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Update any NULL values (shouldn't happen but just in case)
UPDATE sale_items SET sell_mode = 'unit' WHERE sell_mode IS NULL;
UPDATE sale_items SET units_per_box = 1 WHERE units_per_box IS NULL;

-- ============================================
-- PART 2: products table
-- ============================================

-- Add units_per_box column to products (how many units per box/carton)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS units_per_box INTEGER DEFAULT 1;

-- Add check constraint for units_per_box in products
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_units_per_box_check CHECK (units_per_box >= 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Update any NULL values in products
UPDATE products SET units_per_box = 1 WHERE units_per_box IS NULL;

-- ============================================
-- Verify the changes
-- ============================================
SELECT 'sale_items' as table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sale_items' AND column_name IN ('sell_mode', 'units_per_box')
UNION ALL
SELECT 'products' as table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'units_per_box';
