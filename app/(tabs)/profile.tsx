import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, Switch, Modal, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/auth-store';
import { useUser } from '@/hooks/user-store';
import { useTheme } from '@/hooks/theme-store';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { User, Settings, Info, Heart, Users, Moon, Volume2, X } from 'lucide-react-native';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { currentUserProfile, updateShareCookbook, availableVoices, selectedVoice, isLoadingVoices, updateSelectedVoice } = useUser();
  const { toggleTheme, isDark } = useTheme();
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isUpdatingVoice, setIsUpdatingVoice] = useState(false);

  const colors = isDark ? Colors.dark : Colors.light;

  const handleVoiceSelect = async (voiceIdentifier: string) => {
    setIsUpdatingVoice(true);
    try {
      const success = await updateSelectedVoice(voiceIdentifier);
      if (success) {
        const voice = availableVoices.find((v) => v.identifier === voiceIdentifier);
        if (voice) {
          Speech.speak('This is how I sound.', { voice: voiceIdentifier });
        }
        setShowVoiceModal(false);
      } else {
        Alert.alert('Error', 'Failed to update voice setting');
      }
    } catch {
      Alert.alert('Error', 'Failed to update voice setting');
    } finally {
      setIsUpdatingVoice(false);
    }
  };

  const selectedVoiceName = availableVoices.find((v) => v.identifier === selectedVoice)?.name || 'Default';

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

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowVoiceModal(true)}
            disabled={isLoadingVoices}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
              <Volume2 size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuText, { color: colors.text }]}>Recipe Voice</Text>
              <Text style={[styles.menuSubtext, { color: colors.textSecondary }]}>{selectedVoiceName}</Text>
            </View>
            {isLoadingVoices && <ActivityIndicator size="small" color={colors.primary} />}
          </TouchableOpacity>
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

      <Modal
        visible={showVoiceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVoiceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Voice</Text>
              <TouchableOpacity onPress={() => setShowVoiceModal(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              Choose a voice for recipe instructions
            </Text>
            <ScrollView style={styles.voiceList}>
              {availableVoices.map((voice) => {
                const isSelected = voice.identifier === selectedVoice;
                const genderIndicator = voice.name.toLowerCase().includes('male') 
                  ? voice.name.toLowerCase().includes('female') ? '♀' : '♂' 
                  : '';
                return (
                  <TouchableOpacity
                    key={voice.identifier}
                    style={[
                      styles.voiceItem,
                      { borderColor: colors.muted },
                      isSelected && { backgroundColor: colors.primary + '20', borderColor: colors.primary }
                    ]}
                    onPress={() => handleVoiceSelect(voice.identifier)}
                    disabled={isUpdatingVoice}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.voiceName, { color: colors.text }]}>
                        {genderIndicator && `${genderIndicator} `}{voice.name}
                      </Text>
                      <Text style={[styles.voiceDetails, { color: colors.textSecondary }]}>
                        {voice.language} • {voice.quality || 'Standard'}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.selectedBadgeText, { color: colors.primaryForeground }]}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {isUpdatingVoice && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  menuSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  voiceList: {
    maxHeight: 400,
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
  },
  voiceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  voiceDetails: {
    fontSize: 12,
    marginTop: 4,
  },
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});