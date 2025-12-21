import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import { User } from '@/types';
import { router } from 'expo-router';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';

const USER_STORAGE_KEY = 'meal-planner-user';

type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'NO_ACCOUNT' | 'BAD_CREDENTIALS' | 'SUPABASE_NOT_ENABLED' | 'UNKNOWN' };

type SignupResult =
  | { ok: true }
  | { ok: false; reason: 'SIGNUP_FAILED' | 'SUPABASE_NOT_ENABLED' | 'UNKNOWN' };

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

      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userToStore.id,
          email: userToStore.email,
          username,
          display_name: displayName,
          share_cookbook_with_friends: !!userToStore.shareCookbookWithFriends,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

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

  const doesProfileExist = useCallback(async (email: string): Promise<boolean> => {
    try {
      if (!isSupabaseEnabled) {
        return false;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('❌ doesProfileExist Supabase error:', error);
        return false;
      }

      return !!data?.id;
    } catch (e) {
      console.error('❌ doesProfileExist unexpected error:', e);
      return false;
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
      console.log('Loading user from storage:', storedUser);
      if (storedUser) {
        let parsedUser;
        try {
          parsedUser = JSON.parse(storedUser);
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



  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      if (!isSupabaseEnabled) {
        console.log('Supabase not enabled');
        return { ok: false, reason: 'SUPABASE_NOT_ENABLED' };
      }

      const profileExists = await doesProfileExist(email);
      if (!profileExists) {
        return { ok: false, reason: 'NO_ACCOUNT' };
      }

      const authRes = await supabase.auth.signInWithPassword({ email, password });
      if (authRes.error) {
        console.error('❌ Supabase signInWithPassword error:', authRes.error);
        return { ok: false, reason: 'BAD_CREDENTIALS' };
      }

      const { data: profileRow, error: profileError } = await supabase
        .from('user_profiles')
        .select('id,email,username,display_name,share_cookbook_with_friends')
        .eq('email', email)
        .maybeSingle();

      if (profileError) {
        console.error('❌ Supabase load profile after login error:', profileError);
      }

      const userId = (profileRow?.id ?? email.toLowerCase().replace(/[^a-z0-9]/g, '')).toString();
      const username = (profileRow?.username ?? email.split('@')[0] ?? '').toLowerCase();
      const name = (profileRow?.display_name ?? email.split('@')[0] ?? '').toString();

      const newUser: User = {
        id: userId,
        email: profileRow?.email ?? email,
        name,
        username,
        shareCookbookWithFriends: !!profileRow?.share_cookbook_with_friends,
      };

      console.log('✅ Logging in existing user profile:', newUser);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
      setUser(newUser);

      router.replace('/(tabs)');
      return { ok: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { ok: false, reason: 'UNKNOWN' };
    }
  }, [doesProfileExist]);

  const signup = useCallback(async (name: string, email: string, password: string, locationPermission?: boolean): Promise<SignupResult> => {
    try {
      if (!isSupabaseEnabled) {
        return { ok: false, reason: 'SUPABASE_NOT_ENABLED' };
      }

      const signUpRes = await supabase.auth.signUp({ email, password });
      if (signUpRes.error) {
        console.error('❌ Supabase signUp error:', signUpRes.error);
        return { ok: false, reason: 'SIGNUP_FAILED' };
      }

      const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '');
      const username = (email.split('@')[0] ?? '').toLowerCase();

      const newUser: User = {
        id: userId,
        email,
        name,
        username,
        locationPermission,
        shareCookbookWithFriends: false,
      };

      console.log('✅ Signing up user:', newUser);

      await upsertUserProfileToSupabase(newUser);

      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
      await AsyncStorage.setItem('mealplanner_tutorial_pending', '1');
      setUser(newUser);

      router.replace('/(tabs)');
      return { ok: true };
    } catch (error) {
      console.error('Signup failed:', error);
      return { ok: false, reason: 'UNKNOWN' };
    }
  }, [upsertUserProfileToSupabase]);

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