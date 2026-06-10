import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './auth-store';
import {
  initializePurchases,
  checkSubscriptionStatus,
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
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesPackage[]>([]);

  // Track the userId that triggered the current init to prevent double-init
  // when the auth store updates the user object reference without changing the id.
  const lastInitUserId = useRef<string | null>(null);

  const refreshSubscriptionStatus = useCallback(async (): Promise<boolean> => {
    const isPro = await checkSubscriptionStatus();
    setIsProUser(isPro);
    return isPro;
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
          const [isPro, pkgs] = await Promise.all([
            checkSubscriptionStatus(),
            getOfferings(),
          ]);
          if (!cancelled) {
            setIsProUser(isPro);
            setOfferings(pkgs);
            lastInitUserId.current = userId;
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

    const removeListener = addSubscriptionListener((isPro) => {
      console.log('[Subscription] Real-time update — isPro:', isPro);
      setIsProUser(isPro);
    });

    return removeListener;
  }, [isAuthenticated]);

  const purchase = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    // purchasePackage now throws on real errors (not cancellation)
    const success = await purchasePackage(pkg);
    if (success) {
      setIsProUser(true);
    }
    return success;
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    const success = await restorePurchases();
    if (success) {
      setIsProUser(true);
    }
    return success;
  }, []);

  // Whether the user can access app features
  const hasAccess = isProUser;

  return useMemo(() => ({
    isProUser,
    isLoading,
    offerings,
    hasAccess,
    purchase,
    restore,
    refreshSubscriptionStatus,
    refetchOfferings,
  }), [
    isProUser,
    isLoading,
    offerings,
    hasAccess,
    purchase,
    restore,
    refreshSubscriptionStatus,
    refetchOfferings,
  ]);
});

const SubscriptionContext = result[0];
const useSubscription = result[1];

export { SubscriptionContext, useSubscription };
