import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './auth-store';
import { supabase } from '@/lib/supabase';
import { getBackendBaseUrl } from '@/lib/trpc';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import {
  initializePurchases,
  getAccessInfo,
  getOfferings,
  purchasePackage,
  restorePurchases,
  addSubscriptionListener,
  isRevenueCatEnabled,
} from '@/lib/revenuecat';
import type { PurchasesPackage } from 'react-native-purchases';

// Dev simulation: set EXPO_PUBLIC_SIMULATE_SUBSCRIPTION in .env to one of:
//   'expired'  → no subscription (shows paywall)
//   'active'   → paid subscriber (full access)
const SIM_MODE = process.env.EXPO_PUBLIC_SIMULATE_SUBSCRIPTION as
  | 'expired'
  | 'active'
  | undefined;

const result = createContextHook(() => {
  const { user, isAuthenticated } = useAuth();
  const [isProUser, setIsProUser] = useState(false);
  const [canStartTrial, setCanStartTrial] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesPackage[]>([]);

  // Track the userId that triggered the current init to prevent double-init
  // when the auth store updates the user object reference without changing the id.
  const lastInitUserId = useRef<string | null>(null);

  const refreshSubscriptionStatus = useCallback(async (): Promise<boolean> => {
    const access = await getAccessInfo();
    setIsProUser(access.isPro);
    setCanStartTrial(access.canStartTrial);
    return access.isPro;
  }, []);

  const refetchOfferings = useCallback(async (): Promise<void> => {
    const pkgs = await getOfferings();
    setOfferings(pkgs);
  }, []);

  // ── Initialise RevenueCat once per unique user.id ──
  useEffect(() => {
    const userId = user?.id ?? null;

    if (!isAuthenticated || !userId) {
      setIsLoading(false);
      return;
    }

    // Skip re-init if we already initialized for this exact user id.
    if (lastInitUserId.current === userId) {
      return;
    }

    let cancelled = false;

    async function initialize(): Promise<void> {
      setIsLoading(true);
      try {
        if (SIM_MODE) {
          console.log('[Subscription] Simulation mode active:', SIM_MODE);
          setIsProUser(SIM_MODE === 'active');
          if (!cancelled) setIsLoading(false);
          return;
        }

        // Initialize RevenueCat and check subscription
        if (isRevenueCatEnabled()) {
          await initializePurchases(userId!);
          const [access, pkgs] = await Promise.all([
            getAccessInfo(),
            getOfferings(),
          ]);
          if (!cancelled) {
            setIsProUser(access.isPro);
            setCanStartTrial(access.canStartTrial);
            setOfferings(pkgs);
            lastInitUserId.current = userId;
          }
          // App Review's sandbox is flaky: if plans came back empty, quietly retry in the background
          // so the paywall fills in on its own instead of waiting for a manual tap.
          if (pkgs.length === 0) {
            void (async () => {
              for (const delayMs of [2000, 4000, 8000]) {
                await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
                if (cancelled) return;
                const retried = await getOfferings();
                if (retried.length > 0) {
                  setOfferings(retried);
                  return;
                }
              }
            })();
          }
        }
      } catch (error) {
        console.error('[Subscription] Initialization error:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void initialize();
    return () => { cancelled = true; };
    // Depend on the primitive user.id, not the user object reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  // ── Real-time subscription listener ──
  // Listens for subscription changes (renewal, expiry, billing issues, etc.)
  // so the UI updates without requiring an app restart.
  useEffect(() => {
    if (!isAuthenticated || !isRevenueCatEnabled()) return;

    const removeListener = addSubscriptionListener((access) => {
      console.log('[Subscription] Real-time update:', access);
      setIsProUser(access.isPro);
      setCanStartTrial(access.canStartTrial);
    });

    return removeListener;
  }, [isAuthenticated]);

  const purchase = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    // purchasePackage now throws on real errors (not cancellation)
    const success = await purchasePackage(pkg);
    if (success) {
      setIsProUser(true);
      setCanStartTrial(false);
    }
    return success;
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    const success = await restorePurchases();
    if (success) {
      setIsProUser(true);
      setCanStartTrial(false);
    }
    return success;
  }, []);

  // The one free week is granted by our server (RevenueCat promotional access) so it can't be
  // faked from the phone, isn't tied to Apple/Google billing, and ends on its own after 7 days.
  const startFreeTrial = useCallback(async (): Promise<void> => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    const apiBase = getBackendBaseUrl();
    if (!accessToken || !apiBase) {
      throw new Error('Please sign in again and retry.');
    }

    const response = await fetchWithTimeout(`${apiBase}/api/trial/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }, 20000);

    if (response.status === 409) {
      setCanStartTrial(false);
      throw new Error('Your free week has already been used. Please choose a plan below.');
    }
    if (!response.ok) {
      throw new Error('We could not start your free week. Please try again.');
    }

    const access = await getAccessInfo({ forceRefresh: true });
    setIsProUser(access.isPro);
    setCanStartTrial(access.canStartTrial);
    if (!access.isPro) {
      throw new Error('Your free week is being set up. Please try again in a moment.');
    }
  }, []);

  // Whether the user can access app features
  const hasAccess = isProUser;

  return useMemo(() => ({
    isProUser,
    isLoading,
    offerings,
    hasAccess,
    canStartTrial,
    startFreeTrial,
    purchase,
    restore,
    refreshSubscriptionStatus,
    refetchOfferings,
  }), [
    isProUser,
    isLoading,
    offerings,
    hasAccess,
    canStartTrial,
    startFreeTrial,
    purchase,
    restore,
    refreshSubscriptionStatus,
    refetchOfferings,
  ]);
});

const SubscriptionContext = result[0];
const useSubscription = result[1];

export { SubscriptionContext, useSubscription };
