import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RecipeProvider } from "@/hooks/recipe-store";
import { AuthProvider } from "@/hooks/auth-store";
import { MealPlanProvider } from "@/hooks/meal-plan-store";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

export default function RootLayout() {
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
      <AuthProvider>
        <RecipeProvider>
          <MealPlanProvider>
            <SafeAreaProvider>
              <RootLayoutNav />
            </SafeAreaProvider>
          </MealPlanProvider>
        </RecipeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="add-recipe-photo" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="add-recipe-url" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="recipe-details" options={{ headerShown: false }} />
      <Stack.Screen name="create-meal-plan" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="meal-plan-details" options={{ headerShown: false }} />
      <Stack.Screen name="upload-bookmarks" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="grocery-list" options={{ headerShown: false }} />
      <Stack.Screen name="image-diagnostics" options={{ headerShown: false }} />
      <Stack.Screen name="image-failure-logs" options={{ headerShown: false }} />
    </Stack>
  );
}
