import React, { useState } from 'react';
import { Text, TextInput, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from '@/hooks/auth-store';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { router } from 'expo-router';

export default function EditProfileScreen() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');

  const handleSave = async () => {
    if (!user) return;

    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }

    if (username && !/^[a-zA-Z0-9_\-\.]+$/.test(username)) {
      Alert.alert('Validation', 'Username can only use letters, numbers, dots, hyphens, and underscores.');
      return;
    }

    await updateProfile({
      name: name.trim(),
      username: username.trim() || undefined,
      bio: bio.trim() || undefined,
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
    fontWeight: '600',
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
  saveButton: {
    marginTop: 24,
  },
});
