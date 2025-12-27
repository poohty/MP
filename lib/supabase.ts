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

console.log('🗄️ Supabase status:', isSupabaseConfigured ? '✅ ENABLED' : '❌ OFFLINE MODE');
if (isSupabaseConfigured) {
  console.log('🗄️ Supabase URL:', SUPABASE_URL);
}
