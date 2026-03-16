import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/hooks/theme-store';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import Input from '@/components/Input';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react-native';

export default function ResetPasswordScreen() {
  const { isDark } = useTheme();
  const themeColors = isDark ? Colors.dark : Colors.light;
  const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string }>();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [_isSessionReady, setIsSessionReady] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    async function restoreSession() {
      console.log('🔑 Reset password screen opened');
      console.log('🔑 Params:', JSON.stringify(params));

      if (!isSupabaseEnabled) {
        console.warn('🔑 Supabase not enabled');
        setIsSessionReady(true);
        return;
      }

      try {
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
              } else {
                console.log('🔑 Web session restored successfully');
              }
            }
          }
        }

        if (params.access_token && params.refresh_token) {
          console.log('🔑 Native: restoring session from deep link params');
          const { error } = await supabase.auth.setSession({
            access_token: params.access_token as string,
            refresh_token: params.refresh_token as string,
          });
          if (error) {
            console.error('🔑 Native session restore error:', error);
          } else {
            console.log('🔑 Native session restored successfully');
          }
        }

        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          console.log('🔑 Session active, ready to reset password');
          setIsSessionReady(true);
        } else {
          console.log('🔑 No active session found — user may need to use the link from email');
          setIsSessionReady(true);
        }
      } catch (e) {
        console.error('🔑 Session restore error:', e);
        setIsSessionReady(true);
      }
    }

    void restoreSession();
  }, [params]);

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      console.log('🔑 Deep link received:', event.url);
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
              setIsSessionReady(true);
            }
          }
        }
      } catch (e) {
        console.error('🔑 Deep link parse error:', e);
      }
    };

    const sub = Linking.addEventListener('url', handleDeepLink);
    return () => sub.remove();
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
    if (!validate()) return;

    if (!isSupabaseEnabled) {
      Alert.alert('Unavailable', 'Password reset is unavailable in offline mode.', [{ text: 'OK' }]);
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔑 Updating password...');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        console.error('🔑 Password update error:', error);
        Alert.alert('Could not reset password', error.message || 'Please try again.', [{ text: 'OK' }]);
        return;
      }

      console.log('🔑 Password updated successfully');
      setIsDone(true);
    } catch (e) {
      console.error('🔑 Password update unexpected error:', e);
      Alert.alert('Could not reset password', 'Please try again.', [{ text: 'OK' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isDone) {
    return (
      <GradientBackground>
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.centeredContent}>
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
          </ScrollView>
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
              title="Reset Password"
              onPress={handleResetPassword}
              isLoading={isLoading}
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
    flexGrow: 1,
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
    alignSelf: 'center',
  },
  button: {
    marginTop: 12,
  },
  footer: {
    alignItems: 'center',
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
    alignItems: 'center',
    ...Colors.shadowMd,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
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
    width: '100%',
  },
});
