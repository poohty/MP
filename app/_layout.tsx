import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useSegments, router, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AuthContext, useAuth } from "@/hooks/auth-store";
import { RecipeContext } from "@/hooks/recipe-store";
import { MealPlanContext } from "@/hooks/meal-plan-store";
import { UserContext } from "@/hooks/user-store";
import { ThemeContext, useTheme } from "@/hooks/theme-store";
import { SubscriptionContext, useSubscription } from "@/hooks/subscription-store";
import Colors from "@/constants/colors";
import { trpc, trpcClient } from "@/lib/trpc";

const AUTH_ROUTES = ['login', 'signup', 'verify-email', 'auth-callback', 'reset-password'];

/**
 * Single unified navigation gate that atomically decides the correct route.
 * Eliminates the race between separate AuthGate and SubscriptionGate components
 * where the tabs screen would flash before the paywall redirect on re-login.
 */
function NavigationGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { hasAccess, isLoading: isSubLoading } = useSubscription();
  const segments = useSegments();

  useEffect(() => {
    // Wait until both stores have finished loading before making any decision.
    if (isAuthLoading || isSubLoading) return;

    const currentSegment = (segments[0] as string) ?? '';
    const isOnAuthRoute = AUTH_ROUTES.includes(currentSegment);
    const isOnPaywall = currentSegment === 'paywall';

    console.log('[NavigationGate]', {
      isAuthenticated,
      hasAccess,
      segment: currentSegment,
      isOnAuthRoute,
      isOnPaywall,
    });

    // ── Not authenticated ──
    if (!isAuthenticated) {
      if (!isOnAuthRoute) {
        console.log('[NavigationGate] Not authenticated → /login');
        router.replace('/login');
      }
      return;
    }

    // ── Authenticated but on auth route ──
    if (isOnAuthRoute) {
      // Decide atomically: go to tabs (subscribed) or paywall (not subscribed)
      const target = hasAccess ? '/(tabs)' : '/paywall';
      console.log('[NavigationGate] Authenticated on auth route →', target);
      router.replace(target as Href);
      return;
    }

    // ── Authenticated, not on auth route ──
    if (!hasAccess && !isOnPaywall) {
      console.log('[NavigationGate] No access → /paywall');
      router.replace('/paywall' as Href);
    } else if (hasAccess && isOnPaywall) {
      console.log('[NavigationGate] Access granted → /(tabs)');
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isAuthLoading, isSubLoading, hasAccess, segments]);

  return <>{children}</>;
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { themeMode } = useTheme();
  const theme = themeMode === 'dark' ? Colors.dark : Colors.light;
  const { isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const { isLoading: isSubLoading } = useSubscription();
  const splashHiddenRef = useRef(false);

  // Reset the splash gate when the user logs out so it can re-show on next login.
  useEffect(() => {
    if (!isAuthenticated) {
      splashHiddenRef.current = false;
    }
  }, [isAuthenticated]);

  // Keep splash screen visible until both auth and subscription finish loading.
  // This prevents the paywall from flashing on reopen for subscribed users.
  useEffect(() => {
    if (!isAuthLoading && !isSubLoading && !splashHiddenRef.current) {
      splashHiddenRef.current = true;
      console.log('[RootLayoutNav] Auth & Subscription loaded, hiding splash screen');
      void SplashScreen.hideAsync();
    }
  }, [isAuthLoading, isSubLoading]);

  return (
    <NavigationGate>
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: {
            backgroundColor: theme.background,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: theme.background,
          },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="verify-email" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="paywall" options={{ headerShown: false, gestureEnabled: false }} />
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
        <Stack.Screen name="image-diagnostics" options={{ title: "Image Diagnostics" }} />
        <Stack.Screen name="help-support" options={{ title: "Help & Support" }} />
      </Stack>
    </NavigationGate>
  );
}

export default function RootLayout() {
  // Splash screen is hidden inside RootLayoutNav after auth + subscription resolve.

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeContext>
            <AuthContext>
              <SubscriptionContext>
                <UserContext>
                  <RecipeContext>
                    <MealPlanContext>
                      <StatusBar style="auto" />
                      <RootLayoutNav />
                    </MealPlanContext>
                  </RecipeContext>
                </UserContext>
              </SubscriptionContext>
            </AuthContext>
          </ThemeContext>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}