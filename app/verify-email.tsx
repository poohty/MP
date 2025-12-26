import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import { MailCheck } from 'lucide-react-native';

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
      console.log('📨 VerifyEmail: resend verification email:', { email: trimmed });
      const { error } = await supabase.auth.resend({ type: 'signup', email: trimmed });
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
              {'\n'}Open your email, tap the link, then return here and log in.
              {'\n\n'}If the link opens a browser and fails, return to the app and log in again.
            </Text>

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
                title="I already verified"
                onPress={() => router.replace('/login')}
                variant="secondary"
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
  actions: {
    marginTop: 16,
    gap: 10,
  },
});
