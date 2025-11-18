// server/services/supabaseService.js
const { createClient } = require('@supabase/supabase-js');

// Initialize the Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL, // postgresql://postgres:3vjK7miTui8w68Z@db.dvtxfftauzoedgpdgbfe.supabase.co:5432/postgres
  process.env.SUPABASE_ANON_KEY // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dHhmZnRhdXpvZWRncGRnYmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NzQwMTIsImV4cCI6MjA3OTA1MDAxMn0.5MTjvNOq4-zr_CIu-IwDziGYRGPcw9b-t4D8TjFeQWc
);

module.exports = { supabase };
