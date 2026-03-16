import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import { MailCheck, CheckCircle } from 'lucide-react-native';

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
  const [isChecking, setIsChecking] = useState<boolean>(false);

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
      const emailRedirectTo = 'myapp://auth-callback';

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

  const handleCheckVerification = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed || !isSupabaseEnabled) {
      Alert.alert('Info', 'Please return to the login screen and log in with your credentials.', [{ text: 'OK', onPress: () => router.replace('/login') }]);
      return;
    }

    setIsChecking(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      console.log('🔍 Check verification result:', { data: data?.user?.email_confirmed_at, error: error?.message });

      if (data?.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        Alert.alert('Verified!', 'Your email has been verified. Please log in.', [
          { text: 'OK', onPress: () => router.replace('/login') },
        ]);
      } else {
        Alert.alert(
          'Not verified yet',
          'Your email is not verified yet. Check your inbox and click the verification link, then try again. You can also go back to the login screen and log in directly.',
          [
            { text: 'Go to Login', onPress: () => router.replace('/login') },
            { text: 'Stay Here' },
          ]
        );
      }
    } catch (e) {
      console.error('🔍 Check verification error:', e);
      Alert.alert('Info', 'Could not check verification status. Please go to the login screen and try logging in.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ]);
    } finally {
      setIsChecking(false);
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
              We sent a verification link to: {email || 'your email'}.
              {'\n\n'}Open your email and tap the link to verify.
            </Text>

            <View style={styles.tipBox}>
              <CheckCircle size={18} color={Colors.primary} />
              <Text style={styles.tipText}>
                If the link opens Safari and shows an error page, your email may still be verified. Return to the app and tap "I clicked the link" below, or go back to the login screen.
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
                title={isChecking ? 'Checking…' : 'I clicked the link'}
                onPress={handleCheckVerification}
                isLoading={isChecking}
                disabled={isChecking}
                variant="primary"
                testID="alreadyVerifiedButton"
              />

              <Button
                title="Back to Login"
                onPress={() => router.replace('/login')}
                variant="primary"
                testID="backToLoginButton"
              />
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
    fontWeight: '800',
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
});
