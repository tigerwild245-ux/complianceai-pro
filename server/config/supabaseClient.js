// server/config/supabaseClient.js
// CRITICAL: Load environment variables FIRST
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 DEBUG - Checking Supabase environment variables:');
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL || '✗ Missing');
console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Found' : '✗ Missing');
console.log('  SUPABASE_KEY:', process.env.SUPABASE_KEY ? '✓ Found' : '✗ Missing');

const supabaseUrl = process.env.SUPABASE_URL;
// Try SERVICE_ROLE_KEY first, fall back to SUPABASE_KEY
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  throw new Error('Supabase URL and Key are required');
}

console.log('✅ Supabase client initialized successfully\n');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  }
});

module.exports = supabase;
