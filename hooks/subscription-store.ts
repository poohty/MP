import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from './auth-store';
import {
  initializePurchases,
  checkSubscriptionStatus,
  getOfferings,
  purchasePackage,
  restorePurchases,
  isRevenueCatEnabled,
} from '@/lib/revenuecat';
import type { PurchasesPackage } from 'react-native-purchases';
import { supabase } from '@/lib/supabase';

const TRIAL_DAYS = 7;

// Dev simulation: set EXPO_PUBLIC_SIMULATE_SUBSCRIPTION in .env to one of:
//   'trial'    → user is in active trial (full access)
//   'expired'  → trial expired, no subscription (shows paywall)
//   'active'   → paid subscriber (full access)
const SIM_MODE = process.env.EXPO_PUBLIC_SIMULATE_SUBSCRIPTION as
  | 'trial'
  | 'expired'
  | 'active'
  | undefined;

function getTrialInfo(createdAt: string | null): {
  isTrialActive: boolean;
  trialDaysRemaining: number;
} {
  if (!createdAt) {
    return { isTrialActive: true, trialDaysRemaining: TRIAL_DAYS };
  }

  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const msElapsed = now - created;
  const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, Math.ceil(TRIAL_DAYS - daysElapsed));
  const isTrialActive = daysElapsed < TRIAL_DAYS;

  return { isTrialActive, trialDaysRemaining: daysRemaining };
}

const result = createContextHook(() => {
  const { user, isAuthenticated } = useAuth();
  const [isProUser, setIsProUser] = useState(false);
  const [isTrialActive, setIsTrialActive] = useState(true);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(TRIAL_DAYS);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesPackage[]>([]);

  const refreshSubscriptionStatus = useCallback(async () => {
    const isPro = await checkSubscriptionStatus();
    setIsProUser(isPro);
    return isPro;
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function initialize() {
      setIsLoading(true);
      try {
        if (SIM_MODE) {
          console.log('[Subscription] Simulation mode active:', SIM_MODE);
          if (SIM_MODE === 'active') {
            setIsProUser(true);
            setIsTrialActive(false);
            setTrialDaysRemaining(0);
          } else if (SIM_MODE === 'trial') {
            setIsProUser(false);
            setIsTrialActive(true);
            setTrialDaysRemaining(4);
          } else if (SIM_MODE === 'expired') {
            setIsProUser(false);
            setIsTrialActive(false);
            setTrialDaysRemaining(0);
          }
          if (!cancelled) setIsLoading(false);
          return;
        }

        // Fetch account creation date from Supabase to calculate trial
        let createdAt: string | null = null;
        try {
          const { data } = await supabase.auth.getUser();
          createdAt = data?.user?.created_at ?? null;
        } catch {
          console.warn('[Subscription] Could not fetch user created_at');
        }

        const { isTrialActive: trialActive, trialDaysRemaining: daysLeft } = getTrialInfo(createdAt);

        if (!cancelled) {
          setIsTrialActive(trialActive);
          setTrialDaysRemaining(daysLeft);
        }

        // Initialize RevenueCat and check subscription
        if (isRevenueCatEnabled() && user) {
          await initializePurchases(user.id);
          const [isPro, pkgs] = await Promise.all([
            checkSubscriptionStatus(),
            getOfferings(),
          ]);
          if (!cancelled) {
            setIsProUser(isPro);
            setOfferings(pkgs);
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
  }, [isAuthenticated, user]);

  const purchase = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
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
    isTrialActive,
    trialDaysRemaining,
    isLoading,
    offerings,
    hasAccess,
    purchase,
    restore,
    refreshSubscriptionStatus,
  }), [
    isProUser,
    isTrialActive,
    trialDaysRemaining,
    isLoading,
    offerings,
    hasAccess,
    purchase,
    restore,
    refreshSubscriptionStatus,
  ]);
});

const SubscriptionContext = result[0];
const useSubscription = result[1];

export { SubscriptionContext, useSubscription };
