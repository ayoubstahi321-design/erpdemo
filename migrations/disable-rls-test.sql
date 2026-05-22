-- TEMPORARY: Disable RLS to test if that's causing the timeout
-- This is just for testing - we'll re-enable it after

-- Disable RLS on profiles table
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Verify the table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles';

-- Check if there are any indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'profiles';

-- Try a simple select to see if it works
SELECT * FROM profiles LIMIT 5;
