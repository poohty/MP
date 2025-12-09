import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { useAuth } from '@/hooks/auth-store';
import { useUser } from '@/hooks/user-store';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { User, Settings, Info, Heart, Users, Mic } from 'lucide-react-native';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { user, logout, updateProfile } = useAuth();
  const { currentUserProfile, updateShareCookbook } = useUser();
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);

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
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          <Text style={styles.email}>{user?.email || 'user@example.com'}</Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              router.push('/edit-profile');
            }}
          >
            <View style={styles.menuIconContainer}>
              <User size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuText}>Edit Profile</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Settings size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuText}>Preferences</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Instructions</Text>
          
          <View style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Mic size={20} color={Colors.primary} />
            </View>
            <View style={styles.voiceOptionContainer}>
              <Text style={styles.menuText}>Instruction Voice</Text>
              <View style={styles.voiceButtons}>
                <TouchableOpacity
                  style={[
                    styles.voiceButton,
                    (user?.instructionVoice || 'female') === 'female' && styles.voiceButtonActive
                  ]}
                  onPress={async () => {
                    await updateProfile({ instructionVoice: 'female' });
                  }}
                >
                  <Text style={[
                    styles.voiceButtonText,
                    (user?.instructionVoice || 'female') === 'female' && styles.voiceButtonTextActive
                  ]}>Female</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.voiceButton,
                    user?.instructionVoice === 'male' && styles.voiceButtonActive
                  ]}
                  onPress={async () => {
                    await updateProfile({ instructionVoice: 'male' });
                  }}
                >
                  <Text style={[
                    styles.voiceButtonText,
                    user?.instructionVoice === 'male' && styles.voiceButtonTextActive
                  ]}>Male</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social</Text>
          
          <View style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Users size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuText}>Share Cookbook with Friends</Text>
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
              trackColor={{ false: Colors.surface, true: Colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Info size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuText}>Help & Support</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Heart size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuText}>About Meal Planning Roulette</Text>
          </TouchableOpacity>
        </View>
        
        <Button
          title="Logout"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutButton}
        />
        
        <Text style={styles.version}>Version 1.0.0</Text>
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
  voiceOptionContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  voiceButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  voiceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.textSecondary + '30',
  },
  voiceButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  voiceButtonText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  voiceButtonTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
});