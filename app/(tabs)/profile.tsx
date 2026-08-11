import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, Switch, ActivityIndicator, Linking, Platform } from 'react-native';
import { useAuth } from '@/hooks/auth-store';
import { useUser } from '@/hooks/user-store';
import { useTheme } from '@/hooks/theme-store';
import { useSubscription } from '@/hooks/subscription-store';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { User, Settings, Info, Heart, Users, Moon, Mic, Crown, RotateCcw, Shield, FileText, Trash2 } from 'lucide-react-native';
import { VOICE_OPTIONS, type VoicePreference } from '@/constants/voice';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { user, logout, updateProfile, deleteAccount } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const { currentUserProfile, updateShareCookbook } = useUser();
  const { toggleTheme, isDark } = useTheme();
  const { isProUser, restore } = useSubscription();
  const [shareToggle, setShareToggle] = useState<boolean | null>(null);
  const [isSavingShare, setIsSavingShare] = useState(false);
  const [voicePreference, setVoicePreference] = useState<VoicePreference>(user?.voicePreference ?? 'female');
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const hydratedRef = useRef(false);
  const voiceHydratedRef = useRef(false);

  const handleManageSubscription = useCallback((): void => {
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';

    Linking.openURL(url).catch((err) => {
      console.error('Failed to open subscription management URL:', err);
      Alert.alert('Error', 'Unable to open subscription settings. Please open the App Store or Google Play Store manually.');
    });
  }, []);

  const handleRestore = useCallback(async (): Promise<void> => {
    setIsRestoring(true);
    try {
      const success = await restore();
      if (success) {
        Alert.alert('Restored', 'Your subscription has been restored successfully.');
      } else {
        Alert.alert('Not Found', 'No active subscription found for this account.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred during restore.';
      Alert.alert('Restore Failed', message);
    } finally {
      setIsRestoring(false);
    }
  }, [restore]);

  useEffect(() => {
    if (!hydratedRef.current) {
      const sourceValue = currentUserProfile?.shareCookbookWithFriends ?? user?.shareCookbookWithFriends;
      if (typeof sourceValue === 'boolean') {
        setShareToggle(sourceValue);
        hydratedRef.current = true;
      }
    }
  }, [currentUserProfile?.shareCookbookWithFriends, user?.shareCookbookWithFriends]);

  useEffect(() => {
    if (!voiceHydratedRef.current) {
      const pref = currentUserProfile?.voicePreference ?? user?.voicePreference;
      if (pref === 'female' || pref === 'male') {
        setVoicePreference(pref);
        voiceHydratedRef.current = true;
      }
    }
  }, [currentUserProfile?.voicePreference, user?.voicePreference]);

  const handleShareToggle = async (nextValue: boolean): Promise<void> => {
    setShareToggle(nextValue);
    setIsSavingShare(true);
    try {
      const success = await updateShareCookbook(nextValue);
      if (!success) {
        setShareToggle(!nextValue);
        Alert.alert('Error', 'Failed to update setting');
      }
    } catch {
      setShareToggle(!nextValue);
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setIsSavingShare(false);
    }
  };

  const colors = isDark ? Colors.dark : Colors.light;

  const handleVoiceChange = useCallback(async (value: VoicePreference): Promise<void> => {
    setVoicePreference(value);
    setIsSavingVoice(true);
    try {
      await updateProfile({ voicePreference: value });
    } catch {
      setVoicePreference(voicePreference);
      Alert.alert('Error', 'Failed to update voice preference');
    } finally {
      setIsSavingVoice(false);
    }
  }, [voicePreference, updateProfile]);

  const handleDeleteAccount = (): void => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? All your recipes, meal plans, and saved preferences will be permanently deleted. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const res = await deleteAccount();
              if (!res.ok) {
                Alert.alert('Error', res.message || 'Could not delete account.');
              }
            } catch (err) {
              Alert.alert('Error', 'An unexpected error occurred during account deletion.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = (): void => {
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

          <View style={styles.voiceRow}>
            <View style={styles.voiceHeader}>
              <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
                <Mic size={20} color={colors.primary} />
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>Hands Free Voice Preference</Text>
            </View>
            <View style={styles.voiceOptionsRow}>
              {VOICE_OPTIONS.map((option) => {
                const isSelected = voicePreference === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.voiceChip,
                      { borderColor: isSelected ? colors.primary : colors.surface, backgroundColor: isSelected ? colors.primary + '20' : colors.surface },
                    ]}
                    onPress={() => handleVoiceChange(option.value)}
                    disabled={isSavingVoice}
                    activeOpacity={0.7}
                    testID={`voice-option-${option.value}`}
                  >
                    <View style={[styles.radioOuter, { borderColor: isSelected ? colors.primary : colors.textSecondary }]}>
                      {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                    </View>
                    <Text style={[styles.voiceChipText, { color: isSelected ? colors.text : colors.textSecondary, fontWeight: isSelected ? '700' as const : '500' as const }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Subscription</Text>

          <View style={styles.menuItem}>
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              <Crown size={20} color={isProUser ? '#FFD700' : colors.primary} />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>
              Current Tier: <Text style={{ fontWeight: 'bold', color: isProUser ? colors.primary : colors.textSecondary }}>{isProUser ? 'Pro Plan' : 'Free Plan'}</Text>
            </Text>
            {isProUser && (
              <TouchableOpacity onPress={handleManageSubscription}>
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>Manage</Text>
              </TouchableOpacity>
            )}
          </View>

          {!isProUser && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                router.push('/paywall');
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
                <Crown size={20} color={colors.primary} />
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>Upgrade to Pro</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleRestore}
            disabled={isRestoring}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              {isRestoring ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <RotateCcw size={20} color={colors.primary} />
              )}
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Restore Purchases</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Social</Text>
          
          <View style={styles.menuItem}>
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              <Users size={20} color={colors.primary} />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Share Cookbook with Friends</Text>
            {shareToggle === null ? (
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Loading…</Text>
            ) : (
              <Switch
                value={shareToggle}
                onValueChange={handleShareToggle}
                disabled={isSavingShare}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            )}
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Legal & Support</Text>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Linking.openURL('https://mealplannerroulette.com/support.html')}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              <Info size={20} color={colors.primary} />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Help & Support</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Linking.openURL('https://mealplannerroulette.com/privacy.html')}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              <Shield size={20} color={colors.primary} />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Linking.openURL('https://mealplannerroulette.com/terms.html')}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              <FileText size={20} color={colors.primary} />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Terms of Service</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleDeleteAccount}
            disabled={isDeleting}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: '#FF3B30' + '15' }]}>
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FF3B30" />
              ) : (
                <Trash2 size={20} color="#FF3B30" />
              )}
            </View>
            <Text style={[styles.menuText, { color: '#FF3B30', fontWeight: '600' }]}>Delete Account</Text>
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
    flex: 1,
  },
  voiceRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  voiceOptionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 56,
  },
  voiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  voiceChipText: {
    fontSize: 15,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
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