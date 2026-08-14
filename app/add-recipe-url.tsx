import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Alert } from 'react-native';
import { router, Stack } from 'expo-router';
import { useRecipes } from '@/hooks/recipe-store';
import Button from '@/components/Button';
import Input from '@/components/Input';
import DropdownSelect from '@/components/DropdownSelect';
import Colors from '@/constants/colors';
import { RecipeCategory } from '@/types';

export default function AddRecipeUrlScreen() {
  const { addRecipe } = useRecipes();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<RecipeCategory>('Breakfast');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});

  const categoryOptions = [
    { label: 'Breakfast', value: 'Breakfast' },
    { label: 'Appetizer', value: 'Appetizer' },
    { label: 'Salads & Soups', value: 'Salads & Soups' },
    { label: 'Main Course', value: 'Main Course' },
    { label: 'Desserts', value: 'Desserts' },
  ];

  const validate = () => {
    const newErrors: { name?: string; url?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Recipe name is required';
    }

    if (!url.trim()) {
      newErrors.url = 'Recipe URL is required';
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      newErrors.url = 'Please enter a valid URL starting with http:// or https://';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


  const handleSave = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {

      const saved = await addRecipe({
        name: name.trim(),
        category: category,
        url: url.trim(),
      });

      if (!saved) {
        Alert.alert(
          'Not Saved',
          'Recipe was not saved. If this is a duplicate, try changing the name or URL.'
        );
        return;
      }

      Alert.alert('Success', `Recipe added to "${category}" successfully!`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving recipe URL:', error);
      Alert.alert('Error', 'Failed to save recipe URL');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Add Recipe URL' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Add a link to a recipe from your favorite website
          </Text>
        </View>

        <Input
          label="Recipe Name"
          placeholder="Enter recipe name"
          value={name}
          onChangeText={setName}
          error={errors.name}
        />

        <Input
          label="Recipe URL"
          placeholder="https://example.com/recipe"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
          error={errors.url}
        />

        <DropdownSelect
          label="Category"
          options={categoryOptions}
          selectedValue={category}
          onSelect={(value) => setCategory(value as RecipeCategory)}
        />

        {isLoading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingTitle}>✨ Processing Recipe</Text>
            <Text style={styles.loadingProgress}>🤖 Analyzing recipe content and extracting details...</Text>
            <Text style={styles.loadingSubtext}>This may take 15-30 seconds</Text>
          </View>
        )}

        <Button
          title="Save Recipe"
          onPress={handleSave}
          isLoading={isLoading}
          style={styles.saveButton}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
  },
  infoContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    marginTop: 24,
    marginBottom: 32,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginVertical: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  loadingTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  loadingProgress: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  loadingSubtext: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center' as const,
  },
});