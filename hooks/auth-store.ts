import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { User } from '@/types';
import { router } from 'expo-router';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import * as Linking from 'expo-linking';

const USER_STORAGE_KEY = 'meal-planner-user';

type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'BAD_CREDENTIALS' | 'LOGIN_FAILED' };

type SignupResult =
  | { ok: true; reason?: 'VERIFY_EMAIL_REQUIRED' }
  | { ok: false; reason: 'SIGNUP_FAILED' };

type SimpleResult = { ok: boolean; error?: string };

function getEmailRedirectTo(): string {
  try {
    const url = Linking.createURL('/auth-callback');
    console.log('🔗 Email redirect URL:', url);
    return url;
  } catch (e) {
    console.warn('⚠️ Failed to create email redirect URL. Falling back to scheme.', e);
    return 'mealplannerroulette://auth-callback';
  }
}

function getResetPasswordRedirectTo(): string {
  try {
    const url = Linking.createURL('/reset-password');
    console.log('🔗 Reset password redirect URL:', url);
    return url;
  } catch (e) {
    console.warn('⚠️ Failed to create reset password redirect URL. Falling back to scheme.', e);
    return 'mealplannerroulette://reset-password';
  }
}

const result = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(true);

  const getAuthEmailVerified = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseEnabled) {
      return true;
    }

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.warn('⚠️ getAuthEmailVerified error:', error.message);
        return false;
      }
      const confirmedAt = data.user?.email_confirmed_at ?? null;
      return !!confirmedAt;
    } catch (e) {
      console.warn('⚠️ getAuthEmailVerified unexpected error:', e);
      return false;
    }
  }, []);

  const refreshEmailVerified = useCallback(async (): Promise<boolean> => {
    const verified = await getAuthEmailVerified();
    console.log('📬 Email verified state refreshed:', { verified });
    setIsEmailVerified(verified);
    return verified;
  }, [getAuthEmailVerified]);

  const resendVerification = useCallback(async (email: string): Promise<SimpleResult> => {
    const trimmed = email.trim();
    if (!trimmed) return { ok: false, error: 'Missing email' };

    if (!isSupabaseEnabled) {
      return { ok: false, error: 'Email verification is unavailable in offline mode.' };
    }

    try {
      console.log('📨 Resend verification email:', { email: trimmed });
      const { error } = await supabase.auth.resend({ type: 'signup', email: trimmed });
      if (error) {
        return { ok: false, error: error.message || 'Could not resend' };
      }
      return { ok: true };
    } catch (e) {
      console.error('📨 Resend verification unexpected error:', e);
      return { ok: false, error: 'Could not resend. Please try again.' };
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<SimpleResult> => {
    const trimmed = email.trim();
    if (!trimmed) return { ok: false, error: 'Missing email' };

    if (!isSupabaseEnabled) {
      return { ok: false, error: 'Password reset is unavailable in offline mode.' };
    }

    try {
      const redirectTo = getResetPasswordRedirectTo();
      console.log('🔐 Request password reset:', { email: trimmed, redirectTo, platform: Platform.OS });
      // NOTE: In Supabase Auth settings, add redirect URLs:
      // - mealplannerroulette://auth-callback
      // - mealplannerroulette://reset-password
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
      if (error) {
        return { ok: false, error: error.message || 'Could not send reset email' };
      }
      return { ok: true };
    } catch (e) {
      console.error('🔐 requestPasswordReset unexpected error:', e);
      return { ok: false, error: 'Could not send reset email. Please try again.' };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<SimpleResult> => {
    if (!isSupabaseEnabled) {
      return { ok: false, error: 'Password reset is unavailable in offline mode.' };
    }

    try {
      console.log('🔐 Updating password');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { ok: false, error: error.message || 'Could not update password' };
      }
      return { ok: true };
    } catch (e) {
      console.error('🔐 updatePassword unexpected error:', e);
      return { ok: false, error: 'Could not update password. Please try again.' };
    }
  }, []);

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

      const { error } = await supabase
        .from('user_profiles')
        .upsert(
          {
            id: userToStore.id,
            email: userToStore.email,
            username,
            display_name: displayName,
            share_cookbook_with_friends: !!userToStore.shareCookbookWithFriends,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.error('❌ Supabase upsertUserProfile error:', error);
        console.error('❌ Full error details:', JSON.stringify(error, null, 2));
      } else {
        console.log('✅ Supabase user_profiles upserted:', { id: userToStore.id, username });
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
        await refreshEmailVerified();
      } else {
        console.log('No user found in storage');
        setIsEmailVerified(true);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshEmailVerified, upsertUserProfileToSupabase]);

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
          setIsEmailVerified(true);

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

        const safeEmail = data.user.email ?? email;
        const username = safeEmail.split('@')[0].toLowerCase();
        const newUser: User = {
          id: data.user.id,
          email: safeEmail,
          name: safeEmail.split('@')[0],
          username,
          shareCookbookWithFriends: false,
        };

        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
        setUser(newUser);

        await upsertUserProfileToSupabase(newUser);
        await refreshEmailVerified();

        router.replace('/(tabs)');
        return { ok: true };
      } catch (error) {
        console.error('Login failed:', error);
        return { ok: false, reason: 'LOGIN_FAILED' };
      }
    },
    [refreshEmailVerified, upsertUserProfileToSupabase]
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
          setIsEmailVerified(true);

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
        await refreshEmailVerified();

        router.replace('/(tabs)');
        return { ok: true };
      } catch (error) {
        console.error('Signup failed:', error);
        return { ok: false, reason: 'SIGNUP_FAILED' };
      }
    },
    [refreshEmailVerified, upsertUserProfileToSupabase]
  );

  const updateProfile = useCallback(
    async (updates: Partial<User>) => {
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
    },
    [user, upsertUserProfileToSupabase]
  );

  const logout = useCallback(async () => {
    try {
      if (isSupabaseEnabled) {
        await supabase.auth.signOut();
      }
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
      setIsEmailVerified(true);
      router.replace('../login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  return {
    user,
    isLoading,
    isEmailVerified,
    refreshEmailVerified,
    resendVerification,
    requestPasswordReset,
    updatePassword,
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
