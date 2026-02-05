import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { useAuth } from '@/hooks/auth-store';
import { useUser } from '@/hooks/user-store';
import { useTheme } from '@/hooks/theme-store';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { User, Settings, Info, Heart, Users, Moon, Mail } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { currentUserProfile, updateShareCookbook } = useUser();
  const { toggleTheme, isDark } = useTheme();
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  const colors = isDark ? Colors.dark : Colors.light;

  useEffect(() => {
    async function checkEmailVerification() {
      if (!isSupabaseEnabled || !user) {
        setIsEmailVerified(true);
        return;
      }

      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const verified = !!authUser?.email_confirmed_at;
        setIsEmailVerified(verified);
      } catch (error) {
        console.warn('Failed to check email verification:', error);
        setIsEmailVerified(true);
      }
    }

    checkEmailVerification();
  }, [user]);

  const handleResendVerification = async () => {
    if (!user?.email) return;

    setIsResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: 'mealplannerroulette://auth-callback',
        },
      });

      if (error) {
        Alert.alert('Error', 'Failed to resend verification email. Please try again.');
      } else {
        Alert.alert('Email Sent', 'Verification email has been sent. Please check your inbox.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend verification email.');
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: logout,
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <GradientBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {!isEmailVerified && (
          <View style={[styles.verificationBanner, { backgroundColor: colors.primary }]}>
            <View style={styles.verificationContent}>
              <Mail size={20} color="#FFFFFF" style={styles.verificationIcon} />
              <View style={styles.verificationTextContainer}>
                <Text style={styles.verificationTitle}>Verify your email</Text>
                <Text style={styles.verificationMessage}>
                  Check your inbox and click the verification link
                </Text>
              </View>
            </View>
            <Button
              title={isResendingEmail ? 'Sending...' : 'Resend'}
              onPress={handleResendVerification}
              disabled={isResendingEmail}
              variant="outline"
              style={styles.resendButton}
            />
          </View>
        )}
        <View style={styles.header}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{user?.name || 'User'}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email || 'user@example.com'}</Text>
        </View>
        
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          
          <View style={styles.menuItem}>
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              <Moon size={20} color={colors.primary} />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              router.push('/edit-profile');
            }}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              <User size={20} color={colors.primary} />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Edit Profile</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              <Settings size={20} color={colors.primary} />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Preferences</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Social</Text>
          
          <View style={styles.menuItem}>
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              <Users size={20} color={colors.primary} />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Share Cookbook with Friends</Text>
            <Switch
              value={currentUserProfile?.shareCookbookWithFriends || false}
              onValueChange={async (value) => {
                setIsUpdatingShare(true);
                try {
                  const success = await updateShareCookbook(value);
                  if (!success) {
                    Alert.alert('Error', 'Failed to update setting');
                  }
                } catch {
                  Alert.alert('Error', 'Failed to update setting');
                } finally {
                  setIsUpdatingShare(false);
                }
              }}
              disabled={isUpdatingShare}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              <Info size={20} color={colors.primary} />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Help & Support</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              <Heart size={20} color={colors.primary} />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>About Meal Planning Roulette</Text>
          </TouchableOpacity>
        </View>
        
        <Button
          title="Logout"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutButton}
        />
        
        <Text style={[styles.version, { color: colors.textSecondary }]}>Version 1.0.0</Text>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuText: {
    fontSize: 16,
    color: Colors.text,
  },
  logoutButton: {
    marginTop: 16,
    marginBottom: 24,
  },
  version: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 14,
  },
  verificationBanner: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  verificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  verificationIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  verificationTextContainer: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  verificationMessage: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  resendButton: {
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
    borderWidth: 1,
  },
});