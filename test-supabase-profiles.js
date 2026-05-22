// Test script to diagnose Supabase profiles table connection
// Run with: node test-supabase-profiles.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mkehxermgmdqsogmlaqq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZWh4ZXJtZ21kcXNvZ21sYXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2OTU5NzIsImV4cCI6MjA4MTI3MTk3Mn0.pys0cEJ5KZgZetwaYctAZg3-dTXrqNtqBzL0QXQxeB4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Testing Supabase connection...\n');

// Test 1: Basic connectivity
console.log('Test 1: Basic Auth Check');
try {
  const { data: { session }, error } = await supabase.auth.getSession();
  console.log('✓ Auth service responding');
  console.log('  Session:', session ? 'Active' : 'None');
} catch (error) {
  console.error('✗ Auth service error:', error.message);
}

// Test 2: List tables (if we have permission)
console.log('\nTest 2: Database Connection');
try {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (error) {
    console.error('✗ Query error:', error);
  } else {
    console.log('✓ Profiles table accessible');
    console.log('  Sample data:', data);
  }
} catch (error) {
  console.error('✗ Exception:', error.message);
}

// Test 3: Test with specific user ID
console.log('\nTest 3: Query specific user');
const testUserId = 'dffc9681-38fb-4ab7-bc18-6abc7aedfeff';
try {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', testUserId)
    .single();

  if (error) {
    console.error('✗ Query error:', error);
  } else {
    console.log('✓ User profile found');
    console.log('  Profile:', data);
  }
} catch (error) {
  console.error('✗ Exception:', error.message);
}

// Test 4: Check RLS status
console.log('\nTest 4: Check if RLS is enabled');
try {
  const { data, error } = await supabase.rpc('has_rls_enabled', {
    table_name: 'profiles'
  });

  if (error && error.code !== 'PGRST202') {
    console.log('  (RPC not available, using direct query)');
  } else {
    console.log('  RLS enabled:', data);
  }
} catch (error) {
  console.log('  (Could not check RLS status)');
}

console.log('\n✅ Diagnostic complete');
