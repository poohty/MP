import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RecipeProvider } from "@/hooks/recipe-store";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const hide = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        // ignore
      }
    };
    hide();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RecipeProvider>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }}>
            {children}
          </Stack>
        </SafeAreaProvider>
      </RecipeProvider>
    </QueryClientProvider>
  );
}
