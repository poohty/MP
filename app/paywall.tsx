import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Crown, Check, RotateCcw } from 'lucide-react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSubscription } from '@/hooks/subscription-store';
import { useAuth } from '@/hooks/auth-store';
import Colors from '@/constants/colors';

const TERMS_URL = 'https://pbandjcreationsllc.com/terms';
const PRIVACY_URL = 'https://pbandjcreationsllc.com/privacy';

/** Only show a loading fallback if offerings take longer than this (slow internet). */
const SLOW_LOAD_THRESHOLD_MS = 2000;

type PlanId = 'trial' | 'monthly' | 'yearly';

export default function PaywallScreen() {
  const { offerings, purchase, restore, isLoading, refetchOfferings } = useSubscription();
  const { logout } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('trial');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  // Only flip to true after a delay — avoids flashing a spinner on fast connections.
  const [showSlowLoader, setShowSlowLoader] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading) {
      timerRef.current = setTimeout(() => setShowSlowLoader(true), SLOW_LOAD_THRESHOLD_MS);
    } else {
      setShowSlowLoader(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isLoading]);

  const monthlyPkg = offerings.find(
    (p) => p.packageType === 'MONTHLY' || p.identifier.toLowerCase().includes('monthly')
  );
  const yearlyPkg = offerings.find(
    (p) => p.packageType === 'ANNUAL' || p.identifier.toLowerCase().includes('yearly') || p.identifier.toLowerCase().includes('annual')
  );

  const selectedPackage: PurchasesPackage | undefined =
    selectedPlan === 'monthly' ? monthlyPkg : yearlyPkg;

  const monthlyPrice = monthlyPkg?.product.priceString ?? '$9.00';
  const yearlyPrice = yearlyPkg?.product.priceString ?? '$90.00';

  const executeSubscribe = useCallback(async (pkg: PurchasesPackage): Promise<void> => {
    setIsPurchasing(true);
    try {
      const success = await purchase(pkg);
      if (success) {
        console.log('[PaywallScreen] Purchase succeeded, navigating to tabs');
        router.replace('/(tabs)');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred during purchase.';
      Alert.alert('Subscription Failed', message);
    } finally {
      setIsPurchasing(false);
    }
  }, [purchase]);

  const handleRetryOfferings = useCallback(async (): Promise<void> => {
    setIsRetrying(true);
    try {
      await refetchOfferings();
    } catch (err) {
      Alert.alert('Error', 'Failed to reload subscription plans. Please try again.');
    } finally {
      setIsRetrying(false);
    }
  }, [refetchOfferings]);

  const handleSubscribe = useCallback(async (): Promise<void> => {
    if (!selectedPackage) {
      Alert.alert('Not Available', 'Subscription packages are not loaded yet. Please try again shortly.');
      return;
    }

    if (selectedPlan === 'trial') {
      Alert.alert(
        'Start 7-Day Free Trial',
        `After your 7-day free trial, you will automatically be charged ${yearlyPrice} for an annual subscription. Cancel anytime in your App Store Account Settings before the trial ends to avoid being charged.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            style: 'default',
            onPress: () => {
              void executeSubscribe(selectedPackage);
            },
          },
        ]
      );
    } else {
      await executeSubscribe(selectedPackage);
    }
  }, [selectedPlan, selectedPackage, executeSubscribe]);

  const handleRestore = useCallback(async (): Promise<void> => {
    setIsRestoring(true);
    try {
      const success = await restore();
      if (success) {
        Alert.alert('Restored', 'Your subscription has been restored successfully.');
      } else {
        Alert.alert('Not Found', 'No active subscription found for this account.');
      }
    } finally {
      setIsRestoring(false);
    }
  }, [restore]);

  // Early returns must stay BELOW every hook — bailing out above them changes the
  // hook count between renders and crashes the app ("rendered more hooks than
  // during the previous render") when isLoading flips false on first sign-in.
  // Splash screen already covers the initial load. Only show a spinner as a
  // fallback for slow internet (>2 s).
  if (isLoading && showSlowLoader) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading subscription options…</Text>
      </View>
    );
  }

  // If still loading but under the threshold, render nothing — splash screen covers it.
  if (isLoading) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Crown size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Meal Planner Roulette</Text>
          <Text style={styles.subtitle}>
            Choose a plan to get started. Cancel anytime.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>Everything included</Text>
          {[
            'Unlimited meal plans & recipes',
            'Smart grocery lists',
            'Recipe discovery & roulette',
            'Friends & shared cookbooks',
            'Full cook-along experience',
          ].map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <View style={styles.checkCircle}>
                <Check size={12} color="#FFFFFF" strokeWidth={3} />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Plan Cards Stack */}
        {offerings.length === 0 ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorCardTitle}>Plans Not Loaded</Text>
            <Text style={styles.errorCardText}>
              We couldn't retrieve the subscription options. Please verify your connection or check app settings.
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, isRetrying && styles.retryButtonDisabled]}
              onPress={handleRetryOfferings}
              disabled={isRetrying}
              activeOpacity={0.8}
            >
              {isRetrying ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.retryButtonText}>Retry Loading Plans</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Plan Cards Stack */}
            <View style={styles.plansColumn}>
              {/* Trial */}
              <TouchableOpacity
                style={[styles.planListItem, selectedPlan === 'trial' && styles.planListItemSelected]}
                onPress={() => setSelectedPlan('trial')}
                activeOpacity={0.8}
              >
                <View style={styles.planListLeft}>
                  <View style={[styles.radio, selectedPlan === 'trial' && styles.radioSelected]}>
                    {selectedPlan === 'trial' && <View style={styles.radioInner} />}
                  </View>
                  <View>
                    <Text style={styles.planListLabel}>Premium: 1 Week Free Trial</Text>
                    <Text style={styles.planListSub}>7 Days Free, then auto-renews at {yearlyPrice}/year</Text>
                  </View>
                </View>
                <View style={styles.trialBadge}>
                  <Text style={styles.trialBadgeText}>Try Free</Text>
                </View>
              </TouchableOpacity>

              {/* Monthly */}
              <TouchableOpacity
                style={[styles.planListItem, selectedPlan === 'monthly' && styles.planListItemSelected]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.8}
              >
                <View style={styles.planListLeft}>
                  <View style={[styles.radio, selectedPlan === 'monthly' && styles.radioSelected]}>
                    {selectedPlan === 'monthly' && <View style={styles.radioInner} />}
                  </View>
                  <View>
                    <Text style={styles.planListLabel}>Premium Monthly Plan</Text>
                    <Text style={styles.planListSub}>{monthlyPrice}/month, auto-renews until canceled</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Yearly (Pay Upfront) */}
              <TouchableOpacity
                style={[styles.planListItem, selectedPlan === 'yearly' && styles.planListItemSelected]}
                onPress={() => setSelectedPlan('yearly')}
                activeOpacity={0.8}
              >
                <View style={styles.planListLeft}>
                  <View style={[styles.radio, selectedPlan === 'yearly' && styles.radioSelected]}>
                    {selectedPlan === 'yearly' && <View style={styles.radioInner} />}
                  </View>
                  <View>
                    <Text style={styles.planListLabel}>Premium Annual Plan</Text>
                    <Text style={styles.planListSub}>{yearlyPrice}/year, auto-renews until canceled</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={[styles.ctaButton, isPurchasing && styles.ctaButtonDisabled]}
              onPress={handleSubscribe}
              activeOpacity={0.85}
              disabled={isPurchasing || isRestoring}
            >
              {isPurchasing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaText}>
                  {selectedPlan === 'trial' ? 'Start Free Trial' : 'Subscribe Now'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Auto-renewing subscription trial disclosure for Apple Guideline 3.1.2(c) */}
            <Text style={styles.trialNote}>
              {selectedPlan === 'trial'
                ? `A 7-day free trial is included. After the trial ends, a payment of ${yearlyPrice} will be automatically initiated for an annual subscription. Your subscription automatically renews unless canceled at least 24 hours before the end of the current period. Manage or cancel anytime in your Apple ID Account Settings.`
                : selectedPlan === 'monthly'
                ? `A payment of ${monthlyPrice} will be automatically initiated for a monthly subscription. Your subscription automatically renews unless canceled at least 24 hours before the end of the current period. Manage or cancel anytime in your Apple ID Account Settings.`
                : `A payment of ${yearlyPrice} will be automatically initiated for an annual subscription. Your subscription automatically renews unless canceled at least 24 hours before the end of the current period. Manage or cancel anytime in your Apple ID Account Settings.`}
            </Text>

            {/* Legal Links (Terms & Privacy) immediately below the disclosure */}
            <View style={[styles.legal, { marginTop: 10, marginBottom: 0 }]}>
              <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
                <Text style={styles.legalLink}>Terms of Use (EULA)</Text>
              </TouchableOpacity>
              <Text style={styles.legalSep}>·</Text>
              <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Restore */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={isRestoring || isPurchasing}
          activeOpacity={0.7}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <View style={styles.restoreInner}>
              <RotateCcw size={14} color={Colors.primary} />
              <Text style={styles.restoreText}>Restore Purchases</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Legal */}
        <View style={styles.legal}>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.legalLink}>Terms of Use (EULA)</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutButton} onPress={logout}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F5FF',
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: '#F7F5FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...Colors.shadowMd,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },

  // Features
  featuresCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    ...Colors.shadowMd,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },

  // Plans Column & List Items
  plansColumn: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  planListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  planListItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F7F5FF',
  },
  planListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  planListLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  planListSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  trialBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trialBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // CTA
  ctaButton: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Colors.shadowMd,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  trialNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 10,
    textAlign: 'center',
  },

  // Restore
  restoreButton: {
    marginTop: 18,
    padding: 8,
  },
  restoreInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restoreText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },

  // Legal
  legal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  legalLink: {
    fontSize: 12,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  legalSep: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // Sign out
  signOutButton: {
    marginTop: 24,
    padding: 8,
  },
  signOutText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFEBEA',
    ...Colors.shadowMd,
  },
  errorCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D32F2F',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorCardText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  retryButtonDisabled: {
    opacity: 0.6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
