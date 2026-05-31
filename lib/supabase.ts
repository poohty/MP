import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY && 
  SUPABASE_URL !== 'https://placeholder.supabase.co' &&
  SUPABASE_ANON_KEY !== 'placeholder-key' &&
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_ANON_KEY.length > 100);

if (!isSupabaseConfigured) {
  console.warn('⚠️ Supabase is not configured properly. App will work in offline mode.');
  console.warn('⚠️ To enable social features, set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      storage: AsyncStorage,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
    global: {
      fetch: (input, init) => fetch(input as any, init as any),
    },
  }
);

export const isSupabaseEnabled = isSupabaseConfigured;

console.log('🗄️ Supabase status:', isSupabaseConfigured ? '✅ ENABLED' : '❌ OFFLINE MODE');
if (isSupabaseConfigured) {
  console.log('🗄️ Supabase URL:', SUPABASE_URL);
}
