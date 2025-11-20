// server/services/supabaseService.js
const { createClient } = require('@supabase/supabase-js');

// Initialize the Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL, // Your Project URL
  process.env.SUPABASE_ANON_KEY // Your public 'anon' key
);

module.exports = { supabase };