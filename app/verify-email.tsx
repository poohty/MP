import React, { useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking } from 'react-native';
import { router } from 'expo-router';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { MailCheck, ArrowRight } from 'lucide-react-native';

export default function VerifyEmailScreen() {
  const openMail = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL('mailto:');
      if (supported) {
        await Linking.openURL('mailto:');
      }
    } catch (e) {
      console.warn('⚠️ Failed to open mail app:', e);
    }
  }, []);

  return (
    <GradientBackground>
      <View style={styles.container} testID="verifyEmailScreen">
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <MailCheck size={28} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            We sent you a verification link. Open your email, tap the link, then come back and log in.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity onPress={openMail} style={styles.secondaryBtn} testID="openEmailAppButton">
              <Text style={styles.secondaryText}>Open email app</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace('/login')}
              style={styles.primaryBtn}
              testID="goToLoginButton"
            >
              <Text style={styles.primaryText}>Go to Login</Text>
              <ArrowRight size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  primaryBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.light.muted,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
});