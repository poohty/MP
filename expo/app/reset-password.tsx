import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, Linking, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/hooks/theme-store';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import Input from '@/components/Input';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { ArrowLeft, Lock, ShieldCheck, AlertTriangle } from 'lucide-react-native';

type ScreenState = 'restoring' | 'ready' | 'invalid' | 'updating' | 'done';

export default function ResetPasswordScreen() {
  const { isDark } = useTheme();
  const themeColors = isDark ? Colors.dark : Colors.light;
  const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string; code?: string; token_hash?: string; type?: string }>();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [screenState, setScreenState] = useState<ScreenState>('restoring');
  const [invalidReason, setInvalidReason] = useState('');
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const currentParams = { ...params };

    async function restoreSession() {
      console.log('🔑 Reset password screen opened');
      console.log('🔑 Params:', JSON.stringify(params));

      if (!isSupabaseEnabled) {
        console.warn('🔑 Supabase not enabled, cannot reset password');
        setInvalidReason('Password reset is unavailable in offline mode.');
        setScreenState('invalid');
        return;
      }

      try {
        let restoreError: string | null = null;

        if (Platform.OS === 'web') {
          const hash = window.location.hash;
          if (hash) {
            console.log('🔑 Web: found hash fragment, attempting session restore');
            const hashParams = new URLSearchParams(hash.replace('#', ''));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken && refreshToken) {
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (error) {
                console.error('🔑 Web session restore error:', error);
                restoreError = error.message;
              } else {
                console.log('🔑 Web session restored successfully');
              }
            }
          }
        }

        if (currentParams.token_hash && currentParams.type) {
          console.log('🔑 Native: verifying OTP with token_hash for recovery');
          const { error } = await supabase.auth.verifyOtp({
            token_hash: currentParams.token_hash as string,
            type: (currentParams.type as string) as 'recovery',
          });
          if (error) {
            console.error('🔑 OTP verify error:', error);
            restoreError = error.message;
          } else {
            console.log('🔑 OTP verified, session should be active');
          }
        } else if (currentParams.code) {
          console.log('🔑 Native: exchanging code for session (PKCE)');
          const { error } = await supabase.auth.exchangeCodeForSession(currentParams.code as string);
          if (error) {
            console.error('🔑 Code exchange error:', error);
            restoreError = error.message;
          } else {
            console.log('🔑 Code exchanged for session successfully');
          }
        } else if (currentParams.access_token && currentParams.refresh_token) {
          console.log('🔑 Native: restoring session from deep link params');
          const { error } = await supabase.auth.setSession({
            access_token: currentParams.access_token as string,
            refresh_token: currentParams.refresh_token as string,
          });
          if (error) {
            console.error('🔑 Native session restore error:', error);
            restoreError = error.message;
          } else {
            console.log('🔑 Native session restored successfully');
          }
        } else {
          console.warn('🔑 No reset params found in URL');
          restoreError = 'no_params';
        }

        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          console.log('🔑 Valid recovery session active, ready to reset password');
          setScreenState('ready');
        } else if (restoreError) {
          console.warn('🔑 Session restore failed:', restoreError);
          if (restoreError.toLowerCase().includes('expired') || restoreError.toLowerCase().includes('otp')) {
            setInvalidReason('This reset link has expired. Please request a new one from the login screen.');
          } else if (restoreError === 'no_params') {
            setInvalidReason('This reset link appears to be invalid. Please request a new one from the login screen.');
          } else {
            setInvalidReason('Could not restore your reset session. The link may have expired or already been used. Please request a new one.');
          }
          setScreenState('invalid');
        } else {
          console.warn('🔑 No active session after restore attempt');
          setInvalidReason('This reset link is no longer valid. Please request a new password reset from the login screen.');
          setScreenState('invalid');
        }
      } catch (e) {
        console.error('🔑 Session restore unexpected error:', e);
        setInvalidReason('Something went wrong while processing your reset link. Please try requesting a new one.');
        setScreenState('invalid');
      }
    }

    void restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screenState !== 'restoring') return;

    const handleDeepLink = async (event: { url: string }) => {
      console.log('🔑 Deep link received while on reset screen:', event.url);
      try {
        const url = new URL(event.url);
        const hash = url.hash;
        if (hash) {
          const hashParams = new URLSearchParams(hash.replace('#', ''));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) {
              console.error('🔑 Deep link session restore error:', error);
            } else {
              console.log('🔑 Deep link session restored');
              setScreenState('ready');
            }
          }
        }
      } catch (e) {
        console.error('🔑 Deep link parse error:', e);
      }
    };

    const sub = Linking.addEventListener('url', handleDeepLink);
    return () => sub.remove();
  }, [screenState]);

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
    if (screenState !== 'ready') {
      console.warn('🔑 Attempted password reset without valid session');
      return;
    }
    if (!validate()) return;

    if (!isSupabaseEnabled) {
      Alert.alert('Unavailable', 'Password reset is unavailable in offline mode.', [{ text: 'OK' }]);
      return;
    }

    const { data: sessionCheck } = await supabase.auth.getSession();
    if (!sessionCheck?.session) {
      console.warn('🔑 Session expired before password submit');
      setInvalidReason('Your reset session has expired. Please request a new password reset link.');
      setScreenState('invalid');
      return;
    }

    setScreenState('updating');
    try {
      console.log('🔑 Updating password...');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        console.error('🔑 Password update error:', error);
        setScreenState('ready');
        Alert.alert('Could not reset password', error.message || 'Please try again.', [{ text: 'OK' }]);
        return;
      }

      console.log('🔑 Password updated successfully, signing out for clean login');
      await supabase.auth.signOut();
      setScreenState('done');
    } catch (e) {
      console.error('🔑 Password update unexpected error:', e);
      setScreenState('ready');
      Alert.alert('Could not reset password', 'An unexpected error occurred. Please try again.', [{ text: 'OK' }]);
    }
  };

  if (screenState === 'restoring') {
    return (
      <GradientBackground>
        <View style={[styles.container, styles.centeredContent]}>
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.text }]}>Verifying your reset link...</Text>
            <Text style={[styles.loadingSubtext, { color: themeColors.textSecondary }]}>This should only take a moment</Text>
          </View>
        </View>
      </GradientBackground>
    );
  }

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
  loadingText: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginTop: 20,
    textAlign: 'center' as const,
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center' as const,
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
