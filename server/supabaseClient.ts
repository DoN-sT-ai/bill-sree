import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

function cleanEnv(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

// Fallback to the project's verified live Supabase instance and anon key
const DEFAULT_SUPABASE_URL = 'https://vdahwoxkbefndukqvacx.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_l3JsaJxiN8G_iVDzvp1RpQ__bcNSBRI';

const supabaseUrl = cleanEnv(process.env.SUPABASE_URL) || DEFAULT_SUPABASE_URL;
const supabaseKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || cleanEnv(process.env.SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_KEY;

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
  console.log('ℹ️ Supabase environment variables not set yet.');
}

