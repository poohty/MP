import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { BadgeCheck, AlertCircle } from 'lucide-react-native';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';

const USER_STORAGE_KEY = 'meal-planner-user';
const CALLBACK_TIMEOUT_MS = 20000;

type AuthCallbackParams = {
  verified?: string | string[];
  type?: string | string[];
  token_hash?: string | string[];
  access_token?: string | string[];
  refresh_token?: string | string[];
  error?: string | string[];
  error_description?: string | string[];
  code?: string | string[];
};

function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] ?? '').trim();
  return (v ?? '').trim();
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<AuthCallbackParams>();
  const [status, setStatus] = useState<'checking' | 'verified' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const parsed = useMemo(() => {
    const error = firstParam(params.error);
    const errorDescription = firstParam(params.error_description);
    const verified = firstParam(params.verified);
    const type = firstParam(params.type);
    const tokenHash = firstParam(params.token_hash);
    const accessToken = firstParam(params.access_token);
    const refreshToken = firstParam(params.refresh_token);
    const code = firstParam(params.code);

    return {
      error,
      errorDescription,
      verified,
      type,
      tokenHash,
      accessToken,
      refreshToken,
      code,
    };
  }, [params.error, params.error_description, params.verified, params.type, params.token_hash, params.access_token, params.refresh_token, params.code]);

  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    console.log('✅ Auth callback opened with params:', JSON.stringify(parsed));

    if (parsed.error) {
      console.error('❌ Auth callback error from params:', parsed.error, parsed.errorDescription);
      setErrorMessage(parsed.errorDescription || parsed.error || 'Verification failed');
      setStatus('error');
      return;
    }

    const timeoutId = setTimeout(() => {
      setStatus((current) => {
        if (current === 'checking') {
          console.warn('⏰ Auth callback timed out after', CALLBACK_TIMEOUT_MS, 'ms');
          setErrorMessage('Verification is taking too long. Please try logging in — your email may already be verified.');
          return 'error';
        }
        return current;
      });
    }, CALLBACK_TIMEOUT_MS);

    async function cleanupAndMarkVerified() {
      try {
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
        console.log('🧹 Cleared stale local user after verification');
      } catch (e) {
        console.warn('⚠️ Could not clear local user storage:', e);
      }
      try {
        await supabase.auth.signOut();
        console.log('🧹 Signed out Supabase session after verification');
      } catch (e) {
        console.warn('⚠️ Could not sign out after verification:', e);
      }
      setStatus('verified');
    }

    async function handleCallback() {
      if (!isSupabaseEnabled) {
        console.log('✅ Supabase not enabled, treating as verified');
        setStatus('verified');
        return;
      }

      try {
        if (parsed.tokenHash && parsed.type) {
          console.log('🔑 Verifying OTP with token_hash...', { token_hash: parsed.tokenHash.substring(0, 8) + '...', type: parsed.type });
          const otpType = parsed.type as 'signup' | 'email' | 'recovery';
          const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
            token_hash: parsed.tokenHash,
            type: otpType,
          });
          if (otpError) {
            console.error('❌ verifyOtp failed:', otpError.message);
            if (otpError.message?.toLowerCase().includes('expired') || otpError.message?.toLowerCase().includes('otp_expired')) {
              setErrorMessage('This verification link has expired. Please request a new one from the login screen.');
              setStatus('error');
              return;
            }
            if (otpError.message?.toLowerCase().includes('already') || otpError.message?.toLowerCase().includes('confirmed')) {
              console.log('✅ Email was already verified');
              await cleanupAndMarkVerified();
              return;
            }
            setErrorMessage(otpError.message || 'Verification failed. Please try again.');
            setStatus('error');
            return;
          }

          console.log('✅ OTP verified successfully, user:', otpData?.user?.id);
          console.log('✅ email_confirmed_at:', otpData?.user?.email_confirmed_at);
          await cleanupAndMarkVerified();
          return;
        }

        if (parsed.accessToken && parsed.refreshToken) {
          console.log('🔑 Setting session from access_token + refresh_token...');
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          });
          if (sessionError) {
            console.error('❌ setSession failed:', sessionError.message);
            setErrorMessage(sessionError.message || 'Could not complete verification.');
            setStatus('error');
            return;
          }

          console.log('✅ Session set, email_confirmed_at:', sessionData?.user?.email_confirmed_at);
          await cleanupAndMarkVerified();
          return;
        }

        if (parsed.code) {
          console.log('🔗 Found code param, exchanging for session...');
          const { data: codeData, error: codeError } = await supabase.auth.exchangeCodeForSession(parsed.code);
          if (codeError) {
            console.error('❌ Code exchange failed:', codeError.message);
            setErrorMessage(codeError.message || 'Could not complete verification.');
            setStatus('error');
            return;
          }

          console.log('✅ Code exchanged, email_confirmed_at:', codeData?.user?.email_confirmed_at);
          await cleanupAndMarkVerified();
          return;
        }

        const { data: existingSession } = await supabase.auth.getSession();
        if (existingSession?.session?.user?.email_confirmed_at) {
          console.log('✅ Existing verified session found, treating as verified');
          await cleanupAndMarkVerified();
          return;
        }

        console.warn('⚠️ Auth callback opened without token_hash, access_token, or code params');
        setErrorMessage('No verification data found. Please use the link from your email.');
        setStatus('error');
      } catch (error) {
        console.error('❌ Auth callback processing error:', error);
        setErrorMessage('Something went wrong during verification. Please try logging in — your email may already be verified.');
        setStatus('error');
      }
    }

    void handleCallback();

    return () => clearTimeout(timeoutId);
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
            {status === 'checking' ? (
              <>
                <View style={styles.iconWrap}>
                  <BadgeCheck size={28} color={Colors.primary} />
                </View>
                <Text style={styles.title}>Finishing verification...</Text>
                <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
                <Text style={styles.subtitle} testID="authCallbackBody">
                  Please wait while we verify your email.
                </Text>
              </>
            ) : status === 'verified' ? (
              <>
                <View style={[styles.iconWrap, styles.iconWrapSuccess]}>
                  <BadgeCheck size={28} color="#16A34A" />
                </View>
                <Text style={styles.title}>Email verified!</Text>
                <Text style={styles.subtitle} testID="authCallbackBody">
                  Your email has been verified successfully. You can now sign in to your account.
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
            ) : (
              <>
                <View style={[styles.iconWrap, styles.iconWrapError]}>
                  <AlertCircle size={28} color="#DC2626" />
                </View>
                <Text style={styles.title}>Verification issue</Text>
                <Text style={styles.subtitle} testID="authCallbackBody">
                  {errorMessage || 'Something went wrong during verification.'}
                </Text>
                <Text style={styles.tipText}>
                  Try logging in — if your email was already verified, it will work. Otherwise, use "Resend verification email" on the login screen.
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
  iconWrapSuccess: {
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
  },
  iconWrapError: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  tipText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
  },
  loader: {
    marginVertical: 16,
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
});
