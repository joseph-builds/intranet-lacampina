import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://api.ie1267bicentenario.edu.pe', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3NzI2NTgyMCwiZXhwIjo0OTMyOTM5NDIwLCJyb2xlIjoiYW5vbiJ9.rmHxJvI1ct5i04OWjo028bcjWDOfyqIBSwEEBpJcI5o');

async function test() {
  const { data, error } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('schemaname', 'storage');
  console.log(error || data);
}
test();
