import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { User } from '@/types';
import { router } from 'expo-router';

const USER_STORAGE_KEY = 'meal-planner-user';
export const ALL_USERS_STORAGE_KEY = 'meal-planner-global-users';

const result = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const upsertUserIntoGlobalDirectory = useCallback(async (userToStore: User) => {
    try {
      const globalUsersJson = await AsyncStorage.getItem(ALL_USERS_STORAGE_KEY);
      const globalUsers: User[] = globalUsersJson ? JSON.parse(globalUsersJson) : [];
      
      const index = globalUsers.findIndex(u => u.id === userToStore.id);
      if (index >= 0) {
        globalUsers[index] = userToStore;
      } else {
        globalUsers.push(userToStore);
      }
      
      await AsyncStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(globalUsers));
      console.log('✅ GLOBAL USER UPSERT:', {
        id: userToStore.id,
        email: userToStore.email,
        username: userToStore.username,
        name: userToStore.name,
        shareCookbookWithFriends: userToStore.shareCookbookWithFriends,
        totalUsersInGlobalStore: globalUsers.length,
      });
    } catch (error) {
      console.error('Failed to upsert user into global directory:', error);
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
        
        await upsertUserIntoGlobalDirectory(parsedUser);
      } else {
        console.log('No user found in storage');
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  }, [upsertUserIntoGlobalDirectory]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);



  const login = useCallback(async (email: string, password: string) => {
    try {
      const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const globalUsersJson = await AsyncStorage.getItem(ALL_USERS_STORAGE_KEY);
      const globalUsers: User[] = globalUsersJson ? JSON.parse(globalUsersJson) : [];
      const existingUser = globalUsers.find(u => u.id === userId);
      
      const username = email.split('@')[0].toLowerCase();
      const newUser: User = existingUser || {
        id: userId,
        email,
        name: email.split('@')[0],
        username,
        shareCookbookWithFriends: false,
      };
      
      console.log('Logging in user:', newUser);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
      setUser(newUser);
      
      await upsertUserIntoGlobalDirectory(newUser);
      
      router.replace('/(tabs)');
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }, [upsertUserIntoGlobalDirectory]);

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
      
      await upsertUserIntoGlobalDirectory(newUser);
      
      router.replace('/(tabs)');
      return true;
    } catch (error) {
      console.error('Signup failed:', error);
      return false;
    }
  }, [upsertUserIntoGlobalDirectory]);

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
      
      await upsertUserIntoGlobalDirectory(updatedUser);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  }, [user, upsertUserIntoGlobalDirectory]);

  const logout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
      router.replace('../login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  return useMemo(() => ({
    user,
    isLoading,
    login,
    signup,
    logout,
    updateProfile,
    isAuthenticated: !!user,
  }), [user, isLoading, login, signup, logout, updateProfile]);
});

const AuthContext = result[0];
const useAuth = result[1];

export { AuthContext, useAuth };