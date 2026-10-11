import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

if (isSupabaseConfigured) {
  console.log('⚡ Supabase database connection enabled:', supabaseUrl);
} else {
  console.log('ℹ️ Supabase environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) not set yet.');
}
