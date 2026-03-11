import React, { useState } from 'react';
import { Text, TextInput, StyleSheet, Alert, ScrollView, View, TouchableOpacity } from 'react-native';
import { useAuth } from '@/hooks/auth-store';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { router } from 'expo-router';
import { VOICE_OPTIONS, type VoicePreference } from '@/constants/voice';
import { Mic } from 'lucide-react-native';

export default function EditProfileScreen() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [voicePreference, setVoicePreference] = useState<VoicePreference>(user?.voicePreference ?? 'female');

  const handleSave = async () => {
    if (!user) return;

    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }

    if (username && !/^[a-zA-Z0-9_\-.]+$/.test(username)) {
      Alert.alert('Validation', 'Username can only use letters, numbers, dots, hyphens, and underscores.');
      return;
    }

    await updateProfile({
      name: name.trim(),
      username: username.trim() || undefined,
      bio: bio.trim() || undefined,
      voicePreference,
    });

    Alert.alert('Profile Updated', 'Your profile has been saved.', [
      {
        text: 'OK',
        onPress: () => router.back(),
      },
    ]);
  };

  return (
    <GradientBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={Colors.textSecondary}
        />

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Your username"
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={Colors.textSecondary}
        />
        <Text style={styles.helperText}>
          This username will be used when other users search for you.
        </Text>

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell others a little about you..."
          placeholderTextColor={Colors.textSecondary}
          multiline
          numberOfLines={3}
        />

        <View style={styles.voiceSection}>
          <View style={styles.voiceLabelRow}>
            <Mic size={18} color={Colors.primary} />
            <Text style={styles.voiceSectionTitle}>Cook Along Voice</Text>
          </View>
          <Text style={styles.voiceDescription}>
            Choose which voice reads your cooking steps aloud.
          </Text>
          <View style={styles.voiceOptionsRow}>
            {VOICE_OPTIONS.map((option) => {
              const isSelected = voicePreference === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.voiceOption,
                    isSelected && styles.voiceOptionSelected,
                  ]}
                  onPress={() => setVoicePreference(option.value)}
                  activeOpacity={0.7}
                  testID={`voice-option-${option.value}`}
                >
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.voiceOptionLabel, isSelected && styles.voiceOptionLabelSelected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Button title="Save Profile" onPress={handleSave} style={styles.saveButton} />
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  voiceSection: {
    marginTop: 28,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  voiceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  voiceSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  voiceDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  voiceOptionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  voiceOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  voiceOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(88,65,199,0.15)',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  voiceOptionLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  voiceOptionLabelSelected: {
    color: Colors.text,
  },
  saveButton: {
    marginTop: 24,
  },
});
