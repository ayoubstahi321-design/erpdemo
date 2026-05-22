-- Migration: Add company assignment to users
-- Description: Allow assigning users to specific companies for multi-tenant support
-- Date: 2026-01-30

-- Add company_id field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.company_id IS 'Company/tenant ID - User belongs to this company. NULL means Admin with access to all companies.';

-- Create index for querying by company
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id) WHERE company_id IS NOT NULL;

COMMENT ON TABLE profiles IS 'User profiles with role-based access control, warehouse assignment, and company (tenant) assignment';
