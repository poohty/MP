import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-store';
import { useTheme } from '@/hooks/theme-store';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import Input from '@/components/Input';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen() {
  const { login } = useAuth();
  const { isDark } = useTheme();
  const themeColors = isDark ? Colors.dark : Colors.light;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const canResend = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

  const handleLogin = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      const result = await login(email.trim(), password);

      if (!result.ok) {
        if (result.reason === 'EMAIL_NOT_VERIFIED') {
          Alert.alert(
            'Email not verified',
            'Please verify your email using the link we sent, then log in.',
            [{ text: 'OK' }]
          );
          return;
        }

        setErrors({ email: 'Invalid email or password' });
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ email: 'An error occurred during login' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const trimmed = email.trim();
    if (!canResend) {
      Alert.alert('Enter your email', 'Please enter a valid email address first.', [{ text: 'OK' }]);
      return;
    }

    if (!isSupabaseEnabled) {
      Alert.alert('Unavailable', 'Email verification is unavailable in offline mode.', [{ text: 'OK' }]);
      return;
    }

    try {
      console.log('📨 Resend verification email:', { email: trimmed });
      const { error } = await supabase.auth.resend({ type: 'signup', email: trimmed });
      if (error) {
        console.error('📨 Resend verification error:', error);
        Alert.alert('Could not resend', error.message || 'Please try again.', [{ text: 'OK' }]);
        return;
      }

      Alert.alert(
        'Verification email sent',
        'Check your inbox for a new verification link, then come back and log in.',
        [{ text: 'OK' }]
      );
    } catch (e) {
      console.error('📨 Resend verification unexpected error:', e);
      Alert.alert('Could not resend', 'Please try again.', [{ text: 'OK' }]);
    }
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
      >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: themeColors.text }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>Log in to your account</Text>
        </View>
        
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/go2xqufleh6nyngscogs1?v=20251220' }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.heroGradient}
          />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Meal Planning Roulette</Text>
            <Text style={styles.heroSubtitle}>
              Create random meal plans from your recipe collection
            </Text>
          </View>
        </View>
        
        <View style={[styles.loginBlock, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          
          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            isPassword
            error={errors.password}
          />
          
          <Button
            title="Log In"
            onPress={handleLogin}
            isLoading={isLoading}
            style={styles.button}
          />
        </View>
        
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>Don&apos;t have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/signup')}>
            <Text style={[styles.footerLink, { color: themeColors.primary }]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resendRow}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/verify-email', params: { email: email.trim() } })}
            testID="didntGetEmailLink"
            style={styles.resendButton}
          >
            <Text style={[styles.resendText, { color: themeColors.textSecondary }]}>Didn’t get the email?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleResendVerification}
            disabled={!canResend}
            testID="resendVerificationButton"
            style={[styles.resendButton, { opacity: canResend ? 1 : 0.5 }]}
          >
            <Text style={[styles.resendText, { color: themeColors.textSecondary }]}>Resend verification email</Text>
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
  header: {
    marginBottom: 20,
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
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  heroContainer: {
    height: 140,
    borderRadius: Colors.radius,
    overflow: 'hidden',
    marginBottom: 20,
    ...Colors.shadowMd,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  loginBlock: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
    ...Colors.shadowMd,
  },
  button: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 14,
  },
  resendRow: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  resendButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerText: {
    fontSize: 15,
    marginRight: 4,
  },
  footerLink: {
    fontWeight: '700',
    fontSize: 15,
  },
});