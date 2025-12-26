import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { useAuth } from '@/hooks/auth-store';
import { useUser } from '@/hooks/user-store';
import { useTheme } from '@/hooks/theme-store';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { User, Settings, Info, Heart, Users, Moon } from 'lucide-react-native';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { user, logout, isEmailVerified, resendVerification, refreshEmailVerified } = useAuth();
  const { currentUserProfile, updateShareCookbook } = useUser();
  const { toggleTheme, isDark } = useTheme();
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);
  const [isVerifyBannerDismissed, setIsVerifyBannerDismissed] = useState<boolean>(false);

  const shouldShowVerifyBanner = useMemo(() => {
    return !isEmailVerified && !isVerifyBannerDismissed;
  }, [isEmailVerified, isVerifyBannerDismissed]);

  const colors = isDark ? Colors.dark : Colors.light;

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
        {shouldShowVerifyBanner ? (
          <View style={styles.verifyBanner} testID="verifyBanner">
            <View style={styles.verifyBannerTopRow}>
              <Text style={styles.verifyBannerTitle}>Verify your email</Text>
              <TouchableOpacity
                onPress={() => setIsVerifyBannerDismissed(true)}
                style={styles.verifyBannerClose}
                testID="dismissVerifyBannerButton"
              >
                <Text style={styles.verifyBannerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.verifyBannerBody}>
              Verify to enable friends and sharing, and to secure your account.
            </Text>
            <View style={styles.verifyBannerActions}>
              <TouchableOpacity
                style={styles.verifyBannerAction}
                onPress={async () => {
                  const email = user?.email ?? '';
                  const result = await resendVerification(email);
                  if (!result.ok) {
                    Alert.alert('Could not resend', result.error || 'Please try again.', [{ text: 'OK' }]);
                    return;
                  }
                  Alert.alert('Sent', 'Check your email for a verification link.', [{ text: 'OK' }]);
                }}
                testID="verifyBannerResendButton"
              >
                <Text style={styles.verifyBannerActionText}>Resend email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.verifyBannerActionSecondary}
                onPress={async () => {
                  const verifiedNow = await refreshEmailVerified();
                  if (verifiedNow) {
                    Alert.alert('Verified', 'Thanks — your email is verified.', [{ text: 'OK' }]);
                    return;
                  }
                  Alert.alert('Not verified yet', 'If you just verified, try again in a moment.', [{ text: 'OK' }]);
                }}
                testID="verifyBannerIVerifiedButton"
              >
                <Text style={styles.verifyBannerActionSecondaryText}>I verified</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

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
          
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.85}
            onPress={() => {
              if (!isEmailVerified) {
                Alert.alert('Verify your email', 'Verify your email to share your cookbook.', [{ text: 'OK' }]);
              }
            }}
            testID="shareCookbookRow"
          >
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              <Users size={20} color={colors.primary} />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Share Cookbook with Friends</Text>
            <Switch
              value={currentUserProfile?.shareCookbookWithFriends || false}
              onValueChange={async (value) => {
                if (!isEmailVerified) {
                  Alert.alert('Verify your email', 'Verify your email to share your cookbook.', [{ text: 'OK' }]);
                  return;
                }

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
              disabled={isUpdatingShare || !isEmailVerified}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </TouchableOpacity>
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
  verifyBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    ...Colors.shadowMd,
  },
  verifyBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  verifyBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  verifyBannerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  verifyBannerCloseText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  verifyBannerBody: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  verifyBannerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  verifyBannerAction: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBannerActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  verifyBannerActionSecondary: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBannerActionSecondaryText: {
    color: Colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
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
});