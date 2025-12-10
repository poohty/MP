import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = '@theme_mode';

const [ThemeContext, useTheme] = createContextHook(() => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        setThemeMode(stored);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = useCallback(async () => {
    const newMode: ThemeMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
      console.log('✅ Theme changed to:', newMode);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  }, [themeMode]);

  const setTheme = useCallback(async (mode: ThemeMode) => {
    setThemeMode(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      console.log('✅ Theme set to:', mode);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  }, []);

  return {
    themeMode,
    isLoading,
    toggleTheme,
    setTheme,
    isDark: themeMode === 'dark',
  };
});

export { ThemeContext, useTheme };
