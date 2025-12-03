import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase env vars are missing. Social features will not work until they are set.');
  console.warn('⚠️ Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: false,
    },
  }
);

console.log('🗄️ Supabase client initialized');
console.log('🗄️ Supabase URL:', SUPABASE_URL ? `✅ ${SUPABASE_URL}` : '❌ NOT SET');
console.log('🗄️ Supabase Key:', SUPABASE_ANON_KEY ? '✅ SET' : '❌ NOT SET');
