import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type PurchasesPackage, type CustomerInfo } from 'react-native-purchases';

const APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ?? '';
const GOOGLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY ?? '';

export const ENTITLEMENT_ID = 'Meal Planner Roulette Pro';

export function isRevenueCatEnabled(): boolean {
  const key = Platform.OS === 'ios' ? APPLE_KEY : GOOGLE_KEY;
  return key.length > 0;
}

export async function initializePurchases(userId: string): Promise<void> {
  if (!isRevenueCatEnabled()) {
    console.log('[RevenueCat] SDK keys not set — skipping initialization');
    return;
  }

  const apiKey = Platform.OS === 'ios' ? APPLE_KEY : GOOGLE_KEY;

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({ apiKey });

  try {
    await Purchases.logIn(userId);
    console.log('[RevenueCat] Initialized and logged in:', userId);
  } catch (error) {
    console.error('[RevenueCat] Failed to log in user:', error);
  }
}

export async function checkSubscriptionStatus(): Promise<boolean> {
  if (!isRevenueCatEnabled()) return false;

  try {
    const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
    const isActive = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
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
    const err = error as { userCancelled?: boolean; message?: string };
    if (err?.userCancelled) {
      console.log('[RevenueCat] User cancelled purchase');
      return false;
    }
    console.error('[RevenueCat] Purchase failed:', err?.message ?? error);
    return false;
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
