import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/hooks/theme-store';
import { supabase, isSupabaseEnabled, signOutSafely } from '@/lib/supabase';
import { friendlyAuthErrorMessage, isNetworkErrorMessage, withNetworkRetry } from '@/lib/auth-error-message';
import Input from '@/components/Input';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { ArrowLeft, Lock, ShieldCheck, AlertTriangle } from 'lucide-react-native';

type ScreenState = 'ready' | 'invalid' | 'updating' | 'done';

const EXPIRED_LINK_MESSAGE = 'This reset link has expired or was already used. Please request a new one from the login screen.';
const MISSING_LINK_MESSAGE = 'This reset link appears to be invalid. Please request a new one from the login screen.';

export default function ResetPasswordScreen() {
  const { isDark } = useTheme();
  const themeColors = isDark ? Colors.dark : Colors.light;
  const params = useLocalSearchParams<{ token_hash?: string | string[] }>();
  const tokenHash = (Array.isArray(params.token_hash) ? params.token_hash[0] : params.token_hash) ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [screenState, setScreenState] = useState<ScreenState>(tokenHash ? 'ready' : 'invalid');
  const [invalidReason, setInvalidReason] = useState(tokenHash ? '' : MISSING_LINK_MESSAGE);

  // The link is verified only when the new password is submitted. Verifying it on open signs the
  // user in immediately, so leaving without setting a password left them logged in. Any recovery
  // session this screen does create is ended when the screen goes away.
  const hasRecoverySessionRef = useRef(false);

  useEffect(() => () => {
    if (hasRecoverySessionRef.current) void signOutSafely();
  }, []);

  const validate = () => {
    const newErrors: { newPassword?: string; confirmPassword?: string } = {};

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResetPassword = async () => {
    if (screenState !== 'ready' || !validate()) return;

    if (!isSupabaseEnabled) {
      Alert.alert('Unavailable', 'Password reset is unavailable in offline mode.', [{ text: 'OK' }]);
      return;
    }

    setScreenState('updating');
    try {
      // Skipped on a second attempt (e.g. the first new password was rejected): the token is
      // single-use and the recovery session from the first attempt is still active.
      if (!hasRecoverySessionRef.current) {
        const { error: verifyError } = await withNetworkRetry(() =>
          supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        );
        if (verifyError) {
          console.error('🔑 Reset link verification failed:', verifyError.message);
          if (isNetworkErrorMessage(verifyError.message)) {
            setScreenState('ready');
            Alert.alert('Connection problem', friendlyAuthErrorMessage(verifyError.message, 'Please try again.'), [{ text: 'OK' }]);
          } else {
            setInvalidReason(EXPIRED_LINK_MESSAGE);
            setScreenState('invalid');
          }
          return;
        }
        hasRecoverySessionRef.current = true;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        console.error('🔑 Password update failed:', updateError.message);
        setScreenState('ready');
        Alert.alert('Could not reset password', friendlyAuthErrorMessage(updateError.message, 'Please try again.'), [{ text: 'OK' }]);
        return;
      }

      hasRecoverySessionRef.current = false;
      await signOutSafely();
      setScreenState('done');
    } catch (e) {
      console.error('🔑 Password reset unexpected error:', e);
      setScreenState('ready');
      Alert.alert('Could not reset password', 'Something went wrong. Please try again.', [{ text: 'OK' }]);
    }
  };

  if (screenState === 'invalid') {
    return (
      <GradientBackground>
        <View style={[styles.container, styles.centeredContent]}>
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.invalidIcon}>
              <AlertTriangle size={32} color="#DC2626" />
            </View>
            <Text style={[styles.invalidTitle, { color: themeColors.text }]}>Reset Link Problem</Text>
            <Text style={[styles.invalidSubtitle, { color: themeColors.textSecondary }]}>
              {invalidReason || 'This reset link is no longer valid.'}
            </Text>
            <Button
              title="Back to Login"
              onPress={() => router.replace('/login')}
              style={styles.invalidButton}
              testID="resetPasswordBackToLogin"
            />
            <Text style={[styles.invalidHint, { color: themeColors.textSecondary }]}>
              You can request a new reset link from the login screen using "Forgot Password?"
            </Text>
          </View>
        </View>
      </GradientBackground>
    );
  }

  if (screenState === 'done') {
    return (
      <GradientBackground>
        <View style={[styles.container, styles.centeredContent]}>
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.successIcon}>
              <ShieldCheck size={32} color="#16A34A" />
            </View>
            <Text style={[styles.successTitle, { color: themeColors.text }]}>Password Updated</Text>
            <Text style={[styles.successSubtitle, { color: themeColors.textSecondary }]}>
              Your password has been reset successfully. You can now log in with your new password.
            </Text>
            <Button
              title="Go to Login"
              onPress={() => router.replace('/login')}
              style={styles.successButton}
              testID="resetPasswordGoToLogin"
            />
          </View>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.replace('/login')}
              style={styles.backButton}
              testID="resetPasswordBackButton"
            >
              <ArrowLeft size={24} color={themeColors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: themeColors.text }]}>Reset Password</Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              Enter your new password below
            </Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.lockIconWrap}>
              <Lock size={28} color={themeColors.primary} />
            </View>

            <Input
              label="New Password"
              placeholder="Enter new password"
              value={newPassword}
              onChangeText={setNewPassword}
              isPassword
              error={errors.newPassword}
              testID="resetPasswordNewInput"
            />

            <Input
              label="Confirm Password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              isPassword
              error={errors.confirmPassword}
              testID="resetPasswordConfirmInput"
            />

            <Button
              title={screenState === 'updating' ? 'Updating...' : 'Reset Password'}
              onPress={handleResetPassword}
              isLoading={screenState === 'updating'}
              style={styles.button}
              testID="resetPasswordSubmitButton"
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={[styles.footerLink, { color: themeColors.primary }]}>Back to Login</Text>
            </TouchableOpacity>
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
    paddingBottom: 40,
  },
  centeredContent: {
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
    ...Colors.shadowMd,
  },
  lockIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(88, 65, 199, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'center' as const,
  },
  button: {
    marginTop: 12,
  },
  footer: {
    alignItems: 'center' as const,
    marginTop: 16,
    paddingVertical: 14,
  },
  footerLink: {
    fontWeight: '700' as const,
    fontSize: 15,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center' as const,
    ...Colors.shadowMd,
  },
  invalidIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  invalidTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  invalidSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  invalidButton: {
    width: '100%' as const,
    marginBottom: 12,
  },
  invalidHint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center' as const,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  successSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  successButton: {
    width: '100%' as const,
  },
});
