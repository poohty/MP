import React, { useCallback, useEffect, useState } from 'react';
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
import { Crown, Check, RotateCcw, Star } from 'lucide-react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSubscription } from '@/hooks/subscription-store';
import { useAuth } from '@/hooks/auth-store';
import Colors from '@/constants/colors';

const TERMS_URL = 'https://pbandjcreationsllc.com/terms';
const PRIVACY_URL = 'https://pbandjcreationsllc.com/privacy';

type PlanId = 'monthly' | 'yearly';

export default function PaywallScreen() {
  const { offerings, purchase, restore, trialDaysRemaining, isTrialActive } = useSubscription();
  const { logout } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

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

  const handleSubscribe = useCallback(async () => {
    if (!selectedPackage) {
      Alert.alert('Not Available', 'Subscription packages are not loaded yet. Please try again shortly.');
      return;
    }

    setIsPurchasing(true);
    try {
      const success = await purchase(selectedPackage);
      if (!success) {
        // User cancelled or error — already logged inside purchase()
      }
    } finally {
      setIsPurchasing(false);
    }
  }, [selectedPackage, purchase]);

  const handleRestore = useCallback(async () => {
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
            {isTrialActive
              ? `Your free trial ends in ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'}`
              : 'Your free trial has ended'}
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

        {/* Plan Cards */}
        <View style={styles.plansRow}>

          {/* Monthly */}
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
            onPress={() => setSelectedPlan('monthly')}
            activeOpacity={0.8}
          >
            <Text style={[styles.planName, selectedPlan === 'monthly' && styles.planNameSelected]}>
              Monthly
            </Text>
            <Text style={[styles.planPrice, selectedPlan === 'monthly' && styles.planPriceSelected]}>
              {monthlyPrice}
            </Text>
            <Text style={[styles.planPer, selectedPlan === 'monthly' && styles.planPerSelected]}>
              per month
            </Text>
            <Text style={[styles.planCancel, selectedPlan === 'monthly' && styles.planCancelSelected]}>
              Cancel anytime
            </Text>
          </TouchableOpacity>

          {/* Yearly */}
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardSelected]}
            onPress={() => setSelectedPlan('yearly')}
            activeOpacity={0.8}
          >
            <View style={styles.badgeWrap}>
              <View style={styles.badge}>
                <Star size={10} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.badgeText}>Best Value</Text>
              </View>
            </View>
            <Text style={[styles.planName, selectedPlan === 'yearly' && styles.planNameSelected]}>
              Annual
            </Text>
            <Text style={[styles.planPrice, selectedPlan === 'yearly' && styles.planPriceSelected]}>
              {yearlyPrice}
            </Text>
            <Text style={[styles.planPer, selectedPlan === 'yearly' && styles.planPerSelected]}>
              per year
            </Text>
            <Text style={[styles.planSave, selectedPlan === 'yearly' && styles.planSaveSelected]}>
              Save 17%
            </Text>
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
            <Text style={styles.ctaText}>Start Subscription</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.trialNote}>7-day free trial included · Cancel anytime</Text>

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
            <Text style={styles.legalLink}>Terms of Service</Text>
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

  // Plans
  plansRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F0EDFF',
  },
  badgeWrap: {
    height: 22,
    justifyContent: 'center',
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  planName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  planNameSelected: {
    color: Colors.primary,
  },
  planPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  planPriceSelected: {
    color: Colors.primary,
  },
  planPer: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  planPerSelected: {
    color: Colors.primary,
  },
  planCancel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  planCancelSelected: {
    color: Colors.primary,
  },
  planSave: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
    marginTop: 6,
  },
  planSaveSelected: {
    color: Colors.primary,
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
});
