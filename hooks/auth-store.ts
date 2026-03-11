import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import { User } from '@/types';
import { router } from 'expo-router';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import type { VoicePreference } from '@/constants/voice';
import * as Linking from 'expo-linking';

const USER_STORAGE_KEY = 'meal-planner-user';

type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'BAD_CREDENTIALS' | 'EMAIL_NOT_VERIFIED' | 'LOGIN_FAILED' };

type SignupResult =
  | { ok: true; reason?: 'VERIFY_EMAIL_REQUIRED' }
  | { ok: false; reason: 'SIGNUP_FAILED' };

function getEmailRedirectTo(): string {
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!SUPABASE_URL || !SUPABASE_URL.includes('supabase.co')) {
    console.warn('⚠️ Supabase URL not configured properly');
    return 'mealplannerroulette://auth-callback';
  }

  const redirectUrl = `${SUPABASE_URL}/auth/v1/verify`;
  console.log('🔗 Email redirect URL:', redirectUrl);
  return redirectUrl;
}

const result = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const upsertUserProfileToSupabase = useCallback(async (userToStore: User) => {
    if (!isSupabaseEnabled) {
      return;
    }

    if (!userToStore?.id || !userToStore?.email) {
      console.warn('⚠️ Cannot upsert user without id or email');
      return;
    }

    try {
      const username = (userToStore.username || userToStore.email.split('@')[0] || '').toLowerCase();
      const displayName = userToStore.name || userToStore.username || userToStore.email;

      console.log('📤 Upserting user to Supabase:', {
        id: userToStore.id,
        email: userToStore.email,
        username,
        displayName,
        shareCookbookWithFriends: !!userToStore.shareCookbookWithFriends,
      });

      const upsertData: Record<string, any> = {
        id: userToStore.id,
        email: userToStore.email,
        username,
        display_name: displayName,
        share_cookbook_with_friends: !!userToStore.shareCookbookWithFriends,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_profiles')
        .upsert(upsertData, { onConflict: 'id' });

      if (error) {
        console.error('❌ Supabase upsertUserProfile error:', error.message || error.code);
      } else {
        console.log('✅ Supabase user_profiles upserted:', { id: userToStore.id, username });
      }

      const voiceId = userToStore.ttsVoiceId || 'Cz0K1kOv9tD8l0b5Qu53';
      const voicePref = userToStore.voicePreference || 'female';
      const { error: voiceError } = await supabase
        .from('user_profiles')
        .update({ tts_voice_id: voiceId, voice_preference: voicePref })
        .eq('id', userToStore.id);

      if (voiceError) {
        if (voiceError.code === 'PGRST204' || voiceError.message?.includes('tts_voice_id') || voiceError.message?.includes('voice_preference')) {
          console.warn('⚠️ voice columns not found in user_profiles. Ensure migrations are applied.');
        } else {
          console.error('❌ Failed to update voice settings:', voiceError.message || voiceError.code);
        }
      }
    } catch (error) {
      console.error('❌ Failed to upsert user to Supabase:', error);
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
      console.log('Loading user from storage:', storedUser);
      if (storedUser) {
        let parsedUser: User;
        try {
          parsedUser = JSON.parse(storedUser) as User;
        } catch (parseError) {
          console.error('❌ Failed to parse user data, clearing corrupted data:', parseError);
          console.error('❌ Corrupted value:', storedUser.substring(0, 200));
          await AsyncStorage.removeItem(USER_STORAGE_KEY);
          return;
        }
        console.log('Parsed user:', parsedUser);
        setUser(parsedUser);

        await upsertUserProfileToSupabase(parsedUser);
      } else {
        console.log('No user found in storage');
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  }, [upsertUserProfileToSupabase]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      if (!isSupabaseEnabled) {
        try {
          const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '');

          const username = email.split('@')[0].toLowerCase();
          const newUser: User = {
            id: userId,
            email,
            name: email.split('@')[0],
            username,
            shareCookbookWithFriends: false,
          };

          console.log('Logging in user (offline mode):', newUser);
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
          setUser(newUser);

          router.replace('/(tabs)');
          return { ok: true };
        } catch (error) {
          console.error('Login failed (offline mode):', error);
          return { ok: false, reason: 'LOGIN_FAILED' };
        }
      }

      try {
        console.log('🔐 Supabase login attempt:', { email });
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error || !data.user) {
          console.warn('🔐 Supabase login failed:', error?.message || 'Unknown error');
          return { ok: false, reason: 'BAD_CREDENTIALS' };
        }

        const confirmedAt = (data.user.email_confirmed_at ?? null) as string | null;
        console.log('🔐 Supabase login user:', {
          id: data.user.id,
          email: data.user.email,
          email_confirmed_at: confirmedAt,
        });

        if (!confirmedAt) {
          console.warn('🔐 Email not verified. Signing out.');
          await supabase.auth.signOut();
          return { ok: false, reason: 'EMAIL_NOT_VERIFIED' };
        }

        const safeEmail = data.user.email ?? email;
        const username = safeEmail.split('@')[0].toLowerCase();

        let savedShareCookbook = false;
        let savedTtsVoiceId: string | null = null;
        let savedVoicePreference: VoicePreference = 'female';
        try {
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();
          if (profileData?.share_cookbook_with_friends != null) {
            savedShareCookbook = !!profileData.share_cookbook_with_friends;
          }
          if (profileData?.tts_voice_id) {
            savedTtsVoiceId = profileData.tts_voice_id;
          }
          if (profileData?.voice_preference === 'male' || profileData?.voice_preference === 'female') {
            savedVoicePreference = profileData.voice_preference;
          }
          console.log('🔐 Fetched profile from Supabase:', { savedShareCookbook, savedVoicePreference });
        } catch {
          console.warn('⚠️ Could not fetch profile during login, using defaults');
        }

        const newUser: User = {
          id: data.user.id,
          email: safeEmail,
          name: safeEmail.split('@')[0],
          username,
          shareCookbookWithFriends: savedShareCookbook,
          ttsVoiceId: savedTtsVoiceId,
          voicePreference: savedVoicePreference,
        };

        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
        setUser(newUser);

        await upsertUserProfileToSupabase(newUser);

        router.replace('/(tabs)');
        return { ok: true };
      } catch (error) {
        console.error('Login failed:', error);
        return { ok: false, reason: 'LOGIN_FAILED' };
      }
    },
    [upsertUserProfileToSupabase]
  );

  const signup = useCallback(
    async (name: string, email: string, password: string, locationPermission?: boolean): Promise<SignupResult> => {
      if (!isSupabaseEnabled) {
        try {
          const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '');
          const username = email.split('@')[0].toLowerCase();
          const newUser: User = {
            id: userId,
            email,
            name,
            username,
            locationPermission,
            shareCookbookWithFriends: false,
          };

          console.log('Signing up user (offline mode):', newUser);
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
          setUser(newUser);

          router.replace('/(tabs)');
          return { ok: true };
        } catch (error) {
          console.error('Signup failed (offline mode):', error);
          return { ok: false, reason: 'SIGNUP_FAILED' };
        }
      }

      try {
        const emailRedirectTo = getEmailRedirectTo();
        console.log('🧾 Supabase signUp attempt:', { email, emailRedirectTo });
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,
          },
        });

        if (error) {
          console.error('🧾 Supabase signUp error:', error);
          return { ok: false, reason: 'SIGNUP_FAILED' };
        }

        const supaUser = data.user;
        const session = data.session;

        console.log('🧾 Supabase signUp result:', {
          userId: supaUser?.id,
          hasSession: !!session,
          email_confirmed_at: supaUser?.email_confirmed_at,
        });

        if (supaUser && !session) {
          return { ok: true, reason: 'VERIFY_EMAIL_REQUIRED' };
        }

        if (!supaUser || !session) {
          return { ok: false, reason: 'SIGNUP_FAILED' };
        }

        const safeEmail = supaUser.email ?? email;
        const username = safeEmail.split('@')[0].toLowerCase();
        const newUser: User = {
          id: supaUser.id,
          email: safeEmail,
          name,
          username,
          locationPermission,
          shareCookbookWithFriends: false,
        };

        console.log('Signing up user (session present):', newUser);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
        setUser(newUser);

        await upsertUserProfileToSupabase(newUser);

        router.replace('/(tabs)');
        return { ok: true };
      } catch (error) {
        console.error('Signup failed:', error);
        return { ok: false, reason: 'SIGNUP_FAILED' };
      }
    },
    [upsertUserProfileToSupabase]
  );

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    try {
      if (!user) return;

      const updatedUser: User = {
        ...user,
        ...updates,
      };

      console.log('Updating user profile:', updatedUser);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      await upsertUserProfileToSupabase(updatedUser);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  }, [user, upsertUserProfileToSupabase]);

  const logout = useCallback(async () => {
    try {
      if (isSupabaseEnabled) {
        await supabase.auth.signOut();
      }
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
      router.replace('../login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  return {
    user,
    isLoading,
    login,
    signup,
    logout,
    updateProfile,
    isAuthenticated: !!user,
  };
});

const AuthContext = result[0];
const useAuth = result[1];

export { AuthContext, useAuth };