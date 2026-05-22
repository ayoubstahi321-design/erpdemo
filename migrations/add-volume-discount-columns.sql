-- Add volume discount columns to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS volume_tiers JSONB;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS volume_discount_enabled BOOLEAN DEFAULT false;
