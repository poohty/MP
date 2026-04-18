import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import { MailCheck, Info } from 'lucide-react-native';

type VerifyEmailParams = {
  email?: string | string[];
};

function normalizeEmailParam(emailParam: string | string[] | undefined): string {
  if (Array.isArray(emailParam)) {
    return (emailParam[0] ?? '').trim();
  }
  return (emailParam ?? '').trim();
}

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<VerifyEmailParams>();
  const email = useMemo(() => normalizeEmailParam(params.email), [params.email]);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [isTestingEmail, setIsTestingEmail] = useState<boolean>(false);
  const isDevMode = process.env.EXPO_PUBLIC_ENV_MODE === 'dev';

  const handleResend = useCallback(async () => {
    const trimmed = email.trim();

    if (!trimmed) {
      Alert.alert('Missing email', 'Please go back and enter your email address first.', [{ text: 'OK' }]);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.', [{ text: 'OK' }]);
      return;
    }

    if (!isSupabaseEnabled) {
      Alert.alert('Unavailable', 'Email verification is unavailable in offline mode.', [{ text: 'OK' }]);
      return;
    }

    try {
      setIsResending(true);
      const emailRedirectTo = 'mealplannerroulette://auth-callback';

      console.log('📨 VerifyEmail: resend verification email:', { email: trimmed, emailRedirectTo });
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmed,
        options: { emailRedirectTo },
      });
      if (error) {
        console.error('📨 VerifyEmail: resend error:', error);
        Alert.alert('Could not resend', error.message || 'Please try again.', [{ text: 'OK' }]);
        return;
      }

      Alert.alert('Sent', 'Check your email for a new verification link.', [{ text: 'OK' }]);
    } catch (e) {
      console.error('📨 VerifyEmail: resend unexpected error:', e);
      Alert.alert('Could not resend', 'Please try again.', [{ text: 'OK' }]);
    } finally {
      setIsResending(false);
    }
  }, [email]);

  const handleTestEmail = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Missing email', 'Cannot test email delivery without an email address.');
      return;
    }

    try {
      setIsTestingEmail(true);
      console.log('🧪 DEV MODE: Sending test Magic Link to:', trimmed);
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: 'mealplannerroulette://auth-callback' },
      });
      if (error) {
        console.error('🧪 TEST EMAIL ERROR:', error);
        Alert.alert('Test Failed', `Error sending test email:\n\n${error.message}`);
      } else {
        Alert.alert('Test Sent!', 'Magic link test sent! If you do not receive it in 2-3 minutes, your Supabase SMTP is failing or rate-limited.');
      }
    } catch (e) {
      console.error('🧪 TEST EMAIL UNEXPECTED ERROR:', e);
      Alert.alert('Test Failed', 'Unexpected error occurred.');
    } finally {
      setIsTestingEmail(false);
    }
  }, [email]);

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
        testID="verifyEmailScreen"
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <MailCheck size={28} color={Colors.primary} />
            </View>

            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.subtitle} testID="verifyEmailBody">
              You have not verified your email yet. If you got the verification email, please click the link in it. Be sure to check your spam folder. If you did not get an email verification, click the button to resend email verification.
            </Text>

            <View style={styles.tipBox}>
              <Info size={18} color={Colors.primary} />
              <Text style={styles.tipText}>
                After tapping the verification link, return here and go to the login screen to sign in. You must verify your email before you can log in.
              </Text>
            </View>

            <View style={styles.actions}>
              <Button
                title={isResending ? 'Sending…' : 'Resend verification email'}
                onPress={handleResend}
                isLoading={isResending}
                disabled={isResending}
                variant="secondary"
                testID="resendVerificationEmailButton"
              />

              <Button
                title="Go to Login"
                onPress={() => router.replace('/login')}
                variant="primary"
                testID="backToLoginButton"
              />

              {isDevMode && (
                <View style={styles.devBox}>
                  <Text style={styles.devTitle}>DEV MODE: Testing</Text>
                  <Button
                    title={isTestingEmail ? 'Testing...' : 'Test Email Delivery (Magic Link)'}
                    onPress={handleTestEmail}
                    isLoading={isTestingEmail}
                    disabled={isTestingEmail || isResending}
                    variant="secondary"
                    style={styles.devButton}
                  />
                  <Text style={styles.devSubtitle}>
                    Use this to verify if your Supabase free-tier SMTP is working or blocking emails.
                  </Text>
                </View>
              )}
            </View>
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
    backgroundColor: 'rgba(255, 126, 92, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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
  tipBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 126, 92, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
  devBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  devTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  devButton: {
    backgroundColor: '#333',
  },
  devSubtitle: {
    fontSize: 11,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
});
