// Simple test without .single()
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mkehxermgmdqsogmlaqq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZWh4ZXJtZ21kcXNvZ21sYXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2OTU5NzIsImV4cCI6MjA4MTI3MTk3Mn0.pys0cEJ5KZgZetwaYctAZg3-dTXrqNtqBzL0QXQxeB4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('Test 1: Without .single()');
try {
  const start = Date.now();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', 'dffc9681-38fb-4ab7-bc18-6abc7aedfeff');

  console.log(`Time: ${Date.now() - start}ms`);
  console.log('Data:', data);
  console.log('Error:', error);
} catch (err) {
  console.error('Exception:', err);
}

console.log('\nTest 2: With .single()');
try {
  const start = Date.now();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', 'dffc9681-38fb-4ab7-bc18-6abc7aedfeff')
    .single();

  console.log(`Time: ${Date.now() - start}ms`);
  console.log('Data:', data);
  console.log('Error:', error);
} catch (err) {
  console.error('Exception:', err);
}

console.log('\nTest 3: With .maybeSingle()');
try {
  const start = Date.now();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', 'dffc9681-38fb-4ab7-bc18-6abc7aedfeff')
    .maybeSingle();

  console.log(`Time: ${Date.now() - start}ms`);
  console.log('Data:', data);
  console.log('Error:', error);
} catch (err) {
  console.error('Exception:', err);
}
