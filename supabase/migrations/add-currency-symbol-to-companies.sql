-- ============================================================================
-- ADD currency_symbol COLUMN TO companies TABLE
-- ============================================================================
-- Allows each company profile to store its own currency symbol
-- (e.g. "DH", "MAD", "€", "$", "TND", "DZD")
-- Default: 'DH' (Moroccan Dirham) to preserve backward compatibility
-- ============================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS currency_symbol TEXT DEFAULT 'DH';

-- Back-fill existing rows with default
UPDATE companies SET currency_symbol = 'DH' WHERE currency_symbol IS NULL;

-- Verification
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Migration applied:';
  RAISE NOTICE '  companies.currency_symbol column added (default: DH)';
  RAISE NOTICE '  Existing rows back-filled with DH';
  RAISE NOTICE '============================================';
END $$;
