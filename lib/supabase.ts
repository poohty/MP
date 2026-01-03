import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

function sanitizeSupabaseUrl(raw?: string): string | null {
  if (!raw) return null;
  const v = raw.trim().replace(/^['"]|['"]$/g, '');
  try {
    const u = new URL(v);
    return u.origin;
  } catch {
    const m = v.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i);
    return m ? m[0] : null;
  }
}

const RAW_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const RAW_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const SUPABASE_URL = sanitizeSupabaseUrl(RAW_URL);
const SUPABASE_ANON_KEY = (RAW_KEY || '').trim().replace(/^['"]|['"]$/g, '');

const isSupabaseConfigured =
  !!SUPABASE_URL &&
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_URL.includes('.supabase.co') &&
  !!SUPABASE_ANON_KEY &&
  SUPABASE_ANON_KEY.startsWith('eyJ');

console.log('🔧 Supabase config:', {
  url: SUPABASE_URL,
  anonKeyPrefix: SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 6) : null,
  configured: isSupabaseConfigured,
});

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
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
);

export async function ensureValidSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('⚠️ Session check error:', error.message);
      return false;
    }
    
    if (!session) {
      console.log('📭 No active session');
      return false;
    }
    
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt ? expiresAt - now : 0;
    
    if (timeUntilExpiry < 300) {
      console.log('🔄 Token expiring soon, refreshing...');
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('❌ Failed to refresh session:', refreshError.message);
        return false;
      }
      
      if (newSession) {
        console.log('✅ Session refreshed successfully');
        return true;
      }
      
      return false;
    }
    
    return true;
  } catch (e) {
    console.warn('⚠️ ensureValidSession error:', e);
    return false;
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'operation'
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const errorMsg = error?.message || '';
    const errorCode = error?.code || '';
    
    const isJwtError = 
      errorMsg.includes('JWT expired') || 
      errorMsg.includes('jwt expired') || 
      errorMsg.includes('token expired') ||
      errorCode === 'PGRST301';
    
    if (isJwtError) {
      console.log(`🔄 JWT/Auth error detected in ${operationName}, refreshing session and retrying...`);
      console.log(`   Error: ${errorMsg}`);
      
      try {
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error(`❌ Session refresh failed for ${operationName}:`, refreshError.message);
          throw error;
        }
        
        console.log(`✅ Session refreshed, retrying ${operationName}...`);
        return await operation();
      } catch (refreshErr) {
        console.error(`❌ Error during refresh/retry for ${operationName}:`, refreshErr);
        throw error;
      }
    }
    
    throw error;
  }
}

export const isSupabaseEnabled = isSupabaseConfigured;

export function isSupabaseParseError(err: any): boolean {
  if (!err) return false;
  
  if (err instanceof SyntaxError) return true;
  
  const errMsg = err?.message || '';
  if (typeof errMsg === 'string') {
    if (errMsg.includes('SyntaxError')) return true;
    if (errMsg.includes('1:4')) return true;
    if (errMsg.includes("';' expected")) return true;
    if (errMsg.includes('Unexpected character')) return true;
  }
  
  try {
    const errStr = JSON.stringify(err);
    if (errStr.includes('SyntaxError') || errStr.includes('1:4')) return true;
  } catch {
    return false;
  }
  
  return false;
}

let supabaseBackoffUntil = 0;
export function shouldBackoffSupabase(): boolean {
  return Date.now() < supabaseBackoffUntil;
}

export function triggerSupabaseBackoff(ms = 60000) {
  supabaseBackoffUntil = Date.now() + ms;
  console.warn(`🚫 Supabase backoff triggered for ${ms / 1000} seconds`);
}
