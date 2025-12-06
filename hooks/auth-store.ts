import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import { User } from '@/types';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

const USER_STORAGE_KEY = 'meal-planner-user';

const result = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const upsertUserProfileToSupabase = useCallback(async (userToStore: User) => {
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

  const loadUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
      console.log('Loading user from storage:', storedUser);
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
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



  const login = useCallback(async (email: string, password: string) => {
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
      
      console.log('Logging in user:', newUser);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
      setUser(newUser);
      
      await upsertUserProfileToSupabase(newUser);
      
      router.replace('/(tabs)');
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }, [upsertUserProfileToSupabase]);

  const signup = useCallback(async (name: string, email: string, password: string, locationPermission?: boolean) => {
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
      
      console.log('Signing up user:', newUser);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
      setUser(newUser);
      
      await upsertUserProfileToSupabase(newUser);
      
      router.replace('/(tabs)');
      return true;
    } catch (error) {
      console.error('Signup failed:', error);
      return false;
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