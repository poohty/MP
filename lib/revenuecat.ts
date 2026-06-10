import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
  type CustomerInfo,
} from 'react-native-purchases';

const APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ?? '';
const GOOGLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY ?? '';

export const ENTITLEMENT_ID = 'Meal Planner Roulette Pro';

/** Tracks whether Purchases.configure() has already been called. */
let configured = false;

export function isRevenueCatEnabled(): boolean {
  const key = Platform.OS === 'ios' ? APPLE_KEY : GOOGLE_KEY;
  return key.length > 0;
}

/**
 * Initialise the RevenueCat SDK once and log in the user.
 * Subsequent calls with the same userId are no-ops; a different userId
 * triggers a logIn() without re-configuring.
 */
let currentUserId: string | null = null;

export async function initializePurchases(userId: string): Promise<void> {
  if (!isRevenueCatEnabled()) {
    console.log('[RevenueCat] SDK keys not set — skipping initialization');
    return;
  }

  if (!configured) {
    const apiKey = Platform.OS === 'ios' ? APPLE_KEY : GOOGLE_KEY;

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({ apiKey });
    configured = true;
    console.log('[RevenueCat] SDK configured');
  }

  if (currentUserId !== userId) {
    try {
      await Purchases.logIn(userId);
      currentUserId = userId;
      console.log('[RevenueCat] Logged in user:', userId);
    } catch (error) {
      console.error('[RevenueCat] Failed to log in user:', error);
    }
  } else {
    console.log('[RevenueCat] Already logged in as:', userId);
  }
}

export async function checkSubscriptionStatus(): Promise<boolean> {
  if (!isRevenueCatEnabled()) return false;

  try {
    const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
    const isActive = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;

    if (__DEV__ && !isActive) {
      const activeKeys = Object.keys(customerInfo.entitlements.active);
      if (activeKeys.length > 0) {
        console.warn(
          `[RevenueCat] Entitlement "${ENTITLEMENT_ID}" not found but active entitlements exist:`,
          activeKeys,
          '— check that the entitlement ID matches the RevenueCat dashboard.',
        );
      }
    }

    console.log('[RevenueCat] Pro entitlement active:', isActive);
    return isActive;
  } catch (error) {
    console.error('[RevenueCat] Failed to check subscription status:', error);
    return false;
  }
}

export async function getOfferings(): Promise<PurchasesPackage[]> {
  if (!isRevenueCatEnabled()) return [];

  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    console.log('[RevenueCat] Fetched', packages.length, 'packages');
    return packages;
  } catch (error) {
    console.error('[RevenueCat] Failed to fetch offerings:', error);
    return [];
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isActive = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    console.log('[RevenueCat] Purchase complete, pro active:', isActive);
    return isActive;
  } catch (error: unknown) {
    if (error instanceof Error && 'userCancelled' in error) {
      const purchaseError = error as { userCancelled: boolean; code?: string };
      if (purchaseError.userCancelled) {
        console.log('[RevenueCat] User cancelled purchase');
        return false;
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error('[RevenueCat] Purchase failed:', message);
    throw new Error(message);
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!isRevenueCatEnabled()) return false;

  try {
    const customerInfo = await Purchases.restorePurchases();
    const isActive = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    console.log('[RevenueCat] Restore complete, pro active:', isActive);
    return isActive;
  } catch (error) {
    console.error('[RevenueCat] Restore failed:', error);
    return false;
  }
}

/**
 * Listen for real-time subscription changes (renewal, expiry, billing issues,
 * family sharing, promotional offers applied externally, etc.).
 * Returns a cleanup function to remove the listener.
 */
export function addSubscriptionListener(
  onUpdate: (isPro: boolean) => void,
): () => void {
  if (!isRevenueCatEnabled()) {
    return () => {};
  }

  const listener = (info: CustomerInfo): void => {
    const isActive = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
    console.log('[RevenueCat] CustomerInfo updated, pro active:', isActive);
    onUpdate(isActive);
  };

  Purchases.addCustomerInfoUpdateListener(listener);

  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}
