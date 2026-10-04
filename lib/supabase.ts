import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

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

const resolvedUrl = SUPABASE_URL || 'https://placeholder.supabase.co';

// Same value supabase-js uses by default, so existing saved sessions stay valid. Spelled out
// so signOutSafely() can clear exactly this key.
const SESSION_STORAGE_KEY = `sb-${new URL(resolvedUrl).hostname.split('.')[0]}-auth-token`;

const REQUEST_TIMEOUT_MS = 15000;

export const supabase = createClient(
  resolvedUrl,
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      storage: AsyncStorage,
      storageKey: SESSION_STORAGE_KEY,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
    global: {
      fetch: (input, init) => fetchWithTimeout(input, init, REQUEST_TIMEOUT_MS),
    },
  }
);

// supabase.auth.signOut() keeps the saved session when the server can't be reached, which logs
// the user straight back in on the next launch. Signing out must always end it on this device.
export async function signOutSafely(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.warn('⚠️ Server sign-out failed, ending the session on this device only:', error.message);
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export const isSupabaseEnabled = isSupabaseConfigured;

console.log('🗄️ Supabase status:', isSupabaseConfigured ? '✅ ENABLED' : '❌ OFFLINE MODE');
if (isSupabaseConfigured) {
  console.log('🗄️ Supabase URL:', SUPABASE_URL);
}
