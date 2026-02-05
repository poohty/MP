import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
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

const result = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const upsertUserProfileToSupabase = useCallback(async (userToStore: User, authId: string) => {
    if (!isSupabaseEnabled) {
      return;
    }

    if (!authId || !userToStore?.email) {
      console.warn('⚠️ Cannot upsert user without authId or email');
      return;
    }

    try {
      const username = (userToStore.username || userToStore.email.split('@')[0] || '').toLowerCase();
      const displayName = userToStore.name || userToStore.username || userToStore.email;

      console.log('📤 Upserting user to Supabase:', {
        auth_id: authId,
        email: userToStore.email,
        username,
        displayName,
        shareCookbookWithFriends: !!userToStore.shareCookbookWithFriends,
      });

      const { error } = await supabase
        .from('user_profiles')
        .upsert(
          {
            auth_id: authId,
            email: userToStore.email,
            username,
            display_name: displayName,
            share_cookbook_with_friends: !!userToStore.shareCookbookWithFriends,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'auth_id' }
        );

      if (error) {
        if (error.code === '23505' && error.message?.includes('username')) {
          console.error('❌ Username already taken');
          throw new Error('Username already taken. Please choose a different one.');
        }
        console.error('❌ Supabase upsertUserProfile error:', error);
        console.error('❌ Full error details:', JSON.stringify(error, null, 2));
        throw error;
      } else {
        console.log('✅ Supabase user_profiles upserted:', { auth_id: authId, username });
      }
    } catch (error) {
      console.error('❌ Failed to upsert user to Supabase:', error);
      throw error;
    }
  }, []);

  const migrateUserLegacyData = useCallback(async (authId: string, email: string) => {
    if (!isSupabaseEnabled) {
      return;
    }

    try {
      console.log('🔄 Migrating legacy data for auth user:', authId);
      
      const legacyUserId = email.toLowerCase().replace(/[^a-z0-9]/g, '');
      console.log('🔄 Legacy user ID:', legacyUserId);

      const { error: recipeError } = await supabase
        .from('recipes')
        .update({ owner_auth_id: authId })
        .eq('owner_user_id', legacyUserId)
        .is('owner_auth_id', null);

      if (recipeError) {
        console.warn('⚠️ Failed to migrate legacy recipes:', recipeError.message);
      } else {
        console.log('✅ Migrated legacy recipes');
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ auth_id: authId })
        .ilike('email', email)
        .is('auth_id', null);

      if (profileError) {
        console.warn('⚠️ Failed to migrate legacy profile:', profileError.message);
      } else {
        console.log('✅ Migrated legacy profile');
      }
    } catch (error) {
      console.warn('⚠️ Legacy migration error (non-fatal):', error);
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

        if (isSupabaseEnabled) {
          try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser?.id) {
              await migrateUserLegacyData(authUser.id, parsedUser.email);
              await upsertUserProfileToSupabase(parsedUser, authUser.id);
            }
          } catch (error) {
            console.warn('⚠️ Failed to sync user profile on load:', error);
          }
        }
      } else {
        console.log('No user found in storage');
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  }, [upsertUserProfileToSupabase, migrateUserLegacyData]);

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

        console.log('🔐 Supabase login user:', {
          id: data.user.id,
          email: data.user.email,
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

        try {
          await migrateUserLegacyData(data.user.id, safeEmail);
          await upsertUserProfileToSupabase(newUser, data.user.id);
        } catch (error) {
          console.error('❌ Failed to sync profile on login:', error);
          await AsyncStorage.removeItem(USER_STORAGE_KEY);
          setUser(null);
          return { ok: false, reason: 'LOGIN_FAILED' };
        }

        router.replace('/(tabs)');
        return { ok: true };
      } catch (error) {
        console.error('Login failed:', error);
        return { ok: false, reason: 'LOGIN_FAILED' };
      }
    },
    [upsertUserProfileToSupabase, migrateUserLegacyData]
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

        try {
          await upsertUserProfileToSupabase(newUser, supaUser.id);
        } catch (error) {
          console.error('❌ Failed to create profile on signup:', error);
          await supabase.auth.signOut();
          await AsyncStorage.removeItem(USER_STORAGE_KEY);
          setUser(null);
          return { ok: false, reason: 'SIGNUP_FAILED' };
        }

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
      
      if (isSupabaseEnabled) {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser?.id) {
            await upsertUserProfileToSupabase(updatedUser, authUser.id);
          }
        } catch (error) {
          console.warn('⚠️ Failed to sync profile update:', error);
        }
      }
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
