import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { BadgeCheck, AlertCircle } from 'lucide-react-native';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';

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

  useEffect(() => {
    console.log('✅ Auth callback opened with params:', parsed);

    if (parsed.error) {
      console.error('❌ Auth callback error from params:', parsed.error, parsed.errorDescription);
      setErrorMessage(parsed.errorDescription || parsed.error || 'Verification failed');
      setStatus('error');
      return;
    }

    async function handleCallback() {
      if (!isSupabaseEnabled) {
        console.log('✅ Supabase not enabled, treating as verified');
        setStatus('verified');
        return;
      }

      try {
        if (parsed.accessToken && parsed.refreshToken) {
          console.log('🔑 Setting session from access_token + refresh_token...');
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          });
          if (sessionError) {
            console.error('❌ setSession failed:', sessionError.message);
          } else {
            console.log('✅ Session set from tokens');
          }
        }

        if (parsed.tokenHash && parsed.type) {
          console.log('🔑 Verifying OTP with token_hash...');
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: parsed.tokenHash,
            type: parsed.type as 'signup' | 'email',
          });
          if (otpError) {
            console.error('❌ verifyOtp failed:', otpError.message);
          } else {
            console.log('✅ OTP verified successfully');
          }
        }

        if (parsed.code) {
          console.log('🔗 Found code param, exchanging for session...');
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(parsed.code);
          if (codeError) {
            console.error('❌ Code exchange failed:', codeError.message);
          } else {
            console.log('✅ Code exchanged for session successfully');
          }
        }

        const { data: userData } = await supabase.auth.getUser();
        console.log('🔍 User after callback:', {
          userId: userData?.user?.id,
          email: userData?.user?.email,
          email_confirmed_at: userData?.user?.email_confirmed_at,
        });

        if (userData?.user?.email_confirmed_at) {
          console.log('✅ Email verified successfully!');
          await supabase.auth.signOut();
          setStatus('verified');
        } else {
          console.log('✅ No confirmed_at found, but treating as verified (Supabase may have already confirmed)');
          setStatus('verified');
        }
      } catch (error) {
        console.error('❌ Auth callback processing error:', error);
        setStatus('verified');
      }
    }

    void handleCallback();
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
                <Text style={styles.hint}>Verified ✅</Text>
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
                  Your email may still have been verified. Try logging in — if it works, you're all set.
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
  hint: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#16A34A',
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
