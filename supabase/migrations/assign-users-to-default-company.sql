-- ============================================================================
-- Migration: Assign users to default company
-- Date: 2026-02-15
-- Problem: Users without company assignments get sentinel UUID and cannot
--          create sales/invoices due to RLS policies
-- Solution: Create default company and assign all unassigned users to it
-- ============================================================================

-- Step 1: Create default company if it doesn't exist
INSERT INTO public.companies (id, name, full_name, default_tax_rate)
VALUES (
  'azmol-default',
  'Azmol Capo',
  'Azmol Petrochemicals',
  0.20
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    full_name = EXCLUDED.full_name;

-- Step 2: Assign all users without company assignments to default company
INSERT INTO public.user_companies (user_id, company_id)
SELECT p.id, 'azmol-default'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_companies uc
  WHERE uc.user_id = p.id
)
ON CONFLICT (user_id, company_id) DO NOTHING;

-- Step 3: Also update profiles.company_id for legacy compatibility
UPDATE public.profiles
SET company_id = 'azmol-default'
WHERE company_id IS NULL
  AND role != 'Admin';  -- Admins can have NULL company_id

-- Verification
DO $$
DECLARE
  users_assigned INTEGER;
  total_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO users_assigned
  FROM public.user_companies;

  SELECT COUNT(*) INTO total_users
  FROM public.profiles
  WHERE role != 'Admin';

  RAISE NOTICE '============================================';
  RAISE NOTICE 'Company Assignment Migration Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Default company created: azmol-default';
  RAISE NOTICE 'Users assigned to companies: %', users_assigned;
  RAISE NOTICE 'Total non-admin users: %', total_users;
  RAISE NOTICE '============================================';
END $$;
