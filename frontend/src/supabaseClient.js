// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// These MUST start with VITE_ for Vite to find them
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in frontend .env file');
  // In a browser, we can't throw an error that stops the app,
  // but we can log it.
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
