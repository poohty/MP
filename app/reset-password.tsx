import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { useAuth } from '@/hooks/auth-store';
import { KeyRound } from 'lucide-react-native';

export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const canSubmit = useMemo(() => {
    return newPassword.length >= 8 && confirmPassword.length >= 8 && newPassword === confirmPassword;
  }, [confirmPassword, newPassword]);

  const handleSave = useCallback(async () => {
    const trimmed = newPassword.trim();

    if (trimmed.length < 8) {
      Alert.alert('Password too short', 'Password must be at least 8 characters.', [{ text: 'OK' }]);
      return;
    }

    if (trimmed !== confirmPassword.trim()) {
      Alert.alert('Passwords do not match', 'Please make sure both passwords match.', [{ text: 'OK' }]);
      return;
    }

    try {
      setIsSaving(true);
      const result = await updatePassword(trimmed);
      if (!result.ok) {
        Alert.alert('Could not update password', result.error || 'Please try again.', [{ text: 'OK' }]);
        return;
      }

      Alert.alert('Password updated', 'Your password has been updated. Please log in again.', [
        {
          text: 'Go to Login',
          onPress: () => router.replace('/login'),
        },
      ]);
    } catch (e) {
      console.error('🔐 ResetPassword unexpected error:', e);
      Alert.alert('Could not update password', 'Please try again.', [{ text: 'OK' }]);
    } finally {
      setIsSaving(false);
    }
  }, [confirmPassword, newPassword, updatePassword]);

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
        testID="resetPasswordScreen"
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <KeyRound size={26} color={Colors.primary} />
            </View>

            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle} testID="resetPasswordBody">
              Enter a new password for your account.
            </Text>

            <View style={styles.form}>
              <Input
                label="New password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChangeText={setNewPassword}
                isPassword
                testID="newPasswordInput"
              />

              <Input
                label="Confirm password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                isPassword
                testID="confirmPasswordInput"
              />

              <Button
                title={isSaving ? 'Saving…' : 'Save new password'}
                onPress={handleSave}
                disabled={!canSubmit || isSaving}
                isLoading={isSaving}
                variant="primary"
                testID="saveNewPasswordButton"
              />

              <Button
                title="Back to Login"
                onPress={() => router.replace('/login')}
                variant="secondary"
                testID="backToLoginFromResetButton"
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
    backgroundColor: 'rgba(34, 197, 94, 0.10)',
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
  form: {
    marginTop: 14,
    gap: 10,
  },
});
