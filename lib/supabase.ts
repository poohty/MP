import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY && 
  SUPABASE_URL !== 'https://placeholder.supabase.co' &&
  SUPABASE_ANON_KEY !== 'placeholder-key' &&
  SUPABASE_URL.includes('supabase.co'));

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
      storage: {
        getItem: async (key: string) => {
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          return await AsyncStorage.getItem(key);
        },
        setItem: async (key: string, value: string) => {
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          await AsyncStorage.setItem(key, value);
        },
        removeItem: async (key: string) => {
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          await AsyncStorage.removeItem(key);
        },
      },
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export const isSupabaseEnabled = isSupabaseConfigured;

console.log('🗄️ Supabase status:', isSupabaseConfigured ? '✅ ENABLED' : '❌ OFFLINE MODE');
if (isSupabaseConfigured) {
  console.log('🗄️ Supabase URL:', SUPABASE_URL);
}
