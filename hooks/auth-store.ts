import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { User } from '@/types';
import { router } from 'expo-router';

const USER_STORAGE_KEY = 'meal-planner-user';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
      console.log('Loading user from storage:', storedUser);
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        console.log('Parsed user:', parsedUser);
        setUser(parsedUser);
      } else {
        console.log('No user found in storage');
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);



  const login = useCallback(async (email: string, password: string) => {
    try {
      // In a real app, you would validate credentials against a backend
      // For now, we'll simulate a successful login
      // Use email as consistent ID to maintain data across logins
      const newUser: User = {
        id: email.toLowerCase().replace(/[^a-z0-9]/g, ''),
        email,
        name: email.split('@')[0],
      };
      
      console.log('Logging in user:', newUser);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
      setUser(newUser);
      router.replace('/(tabs)');
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string, locationPermission?: boolean) => {
    try {
      // In a real app, you would create a user in your backend
      // For now, we'll simulate a successful signup
      // Use email as consistent ID to maintain data across logins
      const newUser: User = {
        id: email.toLowerCase().replace(/[^a-z0-9]/g, ''),
        email,
        name,
        locationPermission,
      };
      
      console.log('Signing up user:', newUser);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
      setUser(newUser);
      router.replace('/(tabs)');
      return true;
    } catch (error) {
      console.error('Signup failed:', error);
      return false;
    }
  }, []);

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
    isAuthenticated: !!user,
  }), [user, isLoading, login, signup, logout]);
});