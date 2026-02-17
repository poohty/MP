import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { BadgeCheck } from 'lucide-react-native';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';

type AuthCallbackParams = {
  verified?: string | string[];
  type?: string | string[];
  token_hash?: string | string[];
  error?: string | string[];
  error_description?: string | string[];
};

function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] ?? '').trim();
  return (v ?? '').trim();
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<AuthCallbackParams>();
  const [showVerifiedHint, setShowVerifiedHint] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [verificationStatus, setVerificationStatus] = useState<'checking' | 'verified' | 'not_verified'>('checking');

  const parsed = useMemo(() => {
    const error = firstParam(params.error);
    const errorDescription = firstParam(params.error_description);
    const verified = firstParam(params.verified);
    const type = firstParam(params.type);
    const tokenHash = firstParam(params.token_hash);

    return {
      error,
      errorDescription,
      verified,
      type,
      tokenHash,
      hasAnyParams: !!(error || errorDescription || verified || type || tokenHash),
    };
  }, [params.error, params.error_description, params.verified, params.type, params.token_hash]);

  useEffect(() => {
    console.log('✅ Auth callback opened with params:', parsed);

    if (parsed.error) {
      Alert.alert('Verification issue', parsed.errorDescription || parsed.error, [{ text: 'OK' }]);
      setIsChecking(false);
      setVerificationStatus('not_verified');
      return;
    }

    if (parsed.hasAnyParams) {
      setShowVerifiedHint(true);
    }

    async function checkVerification() {
      if (!isSupabaseEnabled) {
        console.log('✅ Supabase not enabled, skipping verification check');
        setIsChecking(false);
        setVerificationStatus('verified');
        return;
      }

      try {
        console.log('🔍 Checking user verification status...');

        if (Platform.OS === 'web') {
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');
          if (code) {
            console.log('🔗 Found code param on web, exchanging for session...');
            const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
            if (error) {
              console.error('❌ Code exchange failed:', error);
            }
          }
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const { data: userData } = await supabase.auth.getUser();

        console.log('🔍 Session data:', { hasSession: !!sessionData?.session });
        console.log('🔍 User data:', {
          userId: userData?.user?.id,
          email: userData?.user?.email,
          email_confirmed_at: userData?.user?.email_confirmed_at,
        });

        const user = userData?.user;
        if (user && user.email_confirmed_at) {
          console.log('✅ Email verified successfully!');
          setVerificationStatus('verified');
          setIsChecking(false);
          setTimeout(() => {
            console.log('🔄 Navigating to login...');
            router.replace('/login');
          }, 1000);
        } else {
          console.log('⏳ Email not yet verified');
          setVerificationStatus('not_verified');
          setIsChecking(false);
        }
      } catch (error) {
        console.error('❌ Verification check failed:', error);
        setVerificationStatus('not_verified');
        setIsChecking(false);
      }
    }

    checkVerification();
  }, [parsed]);

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
        testID="authCallbackScreen"
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <BadgeCheck size={28} color={Colors.primary} />
            </View>

            {isChecking ? (
              <>
                <Text style={styles.title}>Finishing verification...</Text>
                <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
                <Text style={styles.subtitle} testID="authCallbackBody">
                  Please wait while we verify your email.
                </Text>
              </>
            ) : verificationStatus === 'verified' ? (
              <>
                <Text style={styles.title}>Email verified!</Text>
                <Text style={styles.subtitle} testID="authCallbackBody">
                  Your email has been verified. You can sign in now.
                </Text>
                {showVerifiedHint && (
                  <Text style={styles.hint} testID="authCallbackVerifiedHint">
                    Verified ✅
                  </Text>
                )}
                <View style={styles.actions}>
                  <Button
                    title="Go to Login"
                    onPress={() => router.replace('/login')}
                    variant="primary"
                    testID="authCallbackGoToLoginButton"
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>Email verified</Text>
                <Text style={styles.subtitle} testID="authCallbackBody">
                  Your email has been verified. You can return to the app and log in.
                </Text>
                <View style={styles.actions}>
                  <Button
                    title="Go to Login"
                    onPress={() => router.replace('/login')}
                    variant="primary"
                    testID="authCallbackGoToLoginButton"
                  />
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    ...Colors.shadowMd,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  hint: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  loader: {
    marginVertical: 16,
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
});
