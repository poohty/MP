import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AuthContext } from "@/hooks/auth-store";
import { RecipeContext } from "@/hooks/recipe-store";
import { MealPlanContext } from "@/hooks/meal-plan-store";
import { UserContext } from "@/hooks/user-store";
import { ThemeContext } from "@/hooks/theme-store";
import Colors from "@/constants/colors";
import { trpc, trpcClient } from "@/lib/trpc";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack 
      screenOptions={{ 
        headerBackTitle: "Back",
        headerStyle: {
          backgroundColor: Colors.light.background,
        },
        headerTintColor: Colors.light.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: Colors.light.background,
        },
      }}
    >

      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ title: "Edit Profile" }} />
      <Stack.Screen name="upload-bookmarks" options={{ title: "Upload Bookmarks" }} />
      <Stack.Screen name="add-recipe-photo" options={{ title: "Add Recipe" }} />
      <Stack.Screen name="add-recipe-url" options={{ title: "Add Recipe from URL" }} />
      <Stack.Screen name="recipe-details" options={{ title: "Recipe Details" }} />
      <Stack.Screen name="create-meal-plan" options={{ title: "Create Meal Plan" }} />
      <Stack.Screen name="meal-plan-details" options={{ title: "Meal Plan Details" }} />
      <Stack.Screen name="grocery-list" options={{ title: "Grocery List" }} />
      <Stack.Screen name="friend-cookbook" options={{ title: "Friend's Cookbook" }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeContext>
            <AuthContext>
              <UserContext>
                <RecipeContext>
                  <MealPlanContext>
                    <StatusBar style="light" />
                    <RootLayoutNav />
                  </MealPlanContext>
                </RecipeContext>
              </UserContext>
            </AuthContext>
          </ThemeContext>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}