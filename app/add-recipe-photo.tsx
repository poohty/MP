import React, { useState } from 'react';
import { StyleSheet, View, Text, Image, ScrollView, Alert } from 'react-native';
import { router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useRecipes } from '@/hooks/recipe-store';
import Button from '@/components/Button';
import Input from '@/components/Input';
import DropdownSelect from '@/components/DropdownSelect';
import Colors from '@/constants/colors';

import { RecipeCategory } from '@/types';

export default function AddRecipePhotoScreen() {
  const { addRecipe } = useRecipes();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<RecipeCategory>('Breakfast');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState('');

  const categoryOptions = [
    { label: 'Breakfast', value: 'Breakfast' },
    { label: 'Appetizer', value: 'Appetizer' },
    { label: 'Salads & Soups', value: 'Salads & Soups' },
    { label: 'Main Course', value: 'Main Course' },
    { label: 'Desserts', value: 'Desserts' },
  ];

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload recipes.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      extractTextFromImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera to take photos.');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      extractTextFromImage(result.assets[0].uri);
    }
  };

  const extractTextFromImage = async (uri: string) => {
    try {
      setIsExtracting(true);
      setExtractionProgress('Converting image...');
      console.log('🔍 Starting recipe photo extraction...');
      
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const base64data = reader.result?.toString().split(',')[1];
          
          if (!base64data) {
            throw new Error('Failed to convert image to base64');
          }
          
          console.log('✅ Image converted to base64');
          setExtractionProgress('Analyzing recipe...');
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
            console.log('⏰ Request timeout after 45 seconds');
          }, 45000);
          
          console.log('🤖 Sending to AI for extraction...');
          const aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
            body: JSON.stringify({
              messages: [
                {
                  role: 'system',
                  content: 'Extract recipe from image. Return:\nINGREDIENTS:\n- [each ingredient]\n\nINSTRUCTIONS:\n1. [each step]\n\nCATEGORY: [Breakfast|Appetizer|Salads & Soups|Main Course|Desserts]\n\nFor category: soup/stew/salad=Salads & Soups, sweet=Desserts, eggs/pancakes=Breakfast, small plates=Appetizer, else=Main Course'
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Extract ingredients, instructions, and suggest category from this recipe photo'
                    },
                    {
                      type: 'image',
                      image: base64data
                    }
                  ]
                }
              ]
            }),
          });
          
          clearTimeout(timeoutId);
          
          if (!aiResponse.ok) {
            throw new Error(`AI API error: ${aiResponse.status}`);
          }
          
          console.log('✅ Received AI response');
          setExtractionProgress('Processing results...');
          
          const data = await aiResponse.json();
          const completion = data.completion || 'Failed to extract text from image';
          console.log('📝 Extraction complete');
          
          const categoryMatch = completion.match(/CATEGORY:\s*(Breakfast|Appetizer|Salads & Soups|Main Course|Desserts)/i);
          if (categoryMatch) {
            const suggestedCategory = categoryMatch[1] as RecipeCategory;
            setCategory(suggestedCategory);
            console.log(`🤖 AI suggested category: ${suggestedCategory}`);
            
            const recipeTextMatch = completion.match(/RECIPE TEXT:\s*([\s\S]*?)(?=\n\nCATEGORY:|$)/i);
            const recipeText = recipeTextMatch ? recipeTextMatch[1].trim().toLowerCase() : '';
            
            const soupKeywords = ['soup', 'stew', 'chili', 'bisque', 'chowder', 'broth', 'pho', 'ramen', 'gazpacho', 'minestrone'];
            const hasSoupKeyword = soupKeywords.some(keyword => recipeText.includes(keyword));
            
            if (hasSoupKeyword && suggestedCategory !== 'Salads & Soups') {
              console.log(`🚨 SOUP OVERRIDE: Found soup keyword, forcing category to Salads & Soups`);
              setCategory('Salads & Soups');
            }
          }
          
          const recipeTextMatch = completion.match(/RECIPE TEXT:\s*([\s\S]*?)(?=\n\nCATEGORY:|$)/i);
          let recipeText = recipeTextMatch ? recipeTextMatch[1].trim() : completion;
          
          if (recipeText && !recipeText.includes('INGREDIENTS:') && !recipeText.includes('INSTRUCTIONS:')) {
            const lines = recipeText.split('\n').filter((line: string) => line.trim());
            let formattedText = '';
            let inIngredients = false;
            let inInstructions = false;
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.match(/^\d+\./)) {
                if (!inInstructions) {
                  formattedText += '\n\nINSTRUCTIONS:\n';
                  inInstructions = true;
                }
                formattedText += trimmedLine + '\n';
              } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
                if (!inIngredients && !inInstructions) {
                  formattedText += 'INGREDIENTS:\n';
                  inIngredients = true;
                }
                formattedText += trimmedLine + '\n';
              } else {
                formattedText += trimmedLine + '\n';
              }
            }
            
            if (formattedText.trim()) {
              recipeText = formattedText.trim();
            }
          }
          
          setExtractedText(recipeText);
          setIsExtracting(false);
          setExtractionProgress('');
          
          console.log(`✅ Successfully extracted recipe content (${recipeText.length} chars) and categorized as: ${category}`);
          
          Alert.alert(
            '✅ Extraction Complete',
            'Recipe text has been successfully extracted from the photo. Please review and save.',
            [{ text: 'OK' }]
          );
        } catch (error) {
          console.error('Error in onload handler:', error);
          setExtractedText('Failed to extract text from image. Please try again or enter the recipe manually.');
          setIsExtracting(false);
          setExtractionProgress('');
          
          if (error instanceof Error && error.name === 'AbortError') {
            Alert.alert(
              'Request Timeout',
              'The extraction took too long. Please try again with a clearer or smaller photo.',
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Extraction Failed',
              'Failed to extract text from image. Please try again or enter the recipe manually.',
              [{ text: 'OK' }]
            );
          }
        }
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error extracting text:', error);
      setExtractedText('Failed to extract text from image. Please try again or enter the recipe manually.');
      setIsExtracting(false);
      setExtractionProgress('');
      Alert.alert(
        'Extraction Failed',
        'Failed to extract text from image. Please try again or enter the recipe manually.',
        [{ text: 'OK' }]
      );
    }
  };

  const pickThumbnail = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload thumbnail.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    
    if (!result.canceled) {
      setThumbnailUri(result.assets[0].uri);
    }
  };

  const takeThumbnailPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera to take photos.');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    
    if (!result.canceled) {
      setThumbnailUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a recipe name');
      return;
    }
    
    setIsLoading(true);
    try {
      await addRecipe({
        name: name.trim(),
        category,
        imageUri: thumbnailUri || imageUri || undefined,
        content: extractedText,
      });
      
      Alert.alert('Success', 'Recipe added successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving recipe:', error);
      Alert.alert('Error', 'Failed to save recipe');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Add Recipe from Photo' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.imageSection}>
          {imageUri ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.image} />
              <Button
                title="Remove"
                onPress={() => setImageUri(null)}
                variant="outline"
                size="small"
                style={styles.removeButton}
              />
            </View>
          ) : (
            <View style={styles.uploadContainer}>
              <Text style={styles.uploadText}>Upload a recipe photo</Text>
              <View style={styles.buttonRow}>
                <Button
                  title="Take Photo"
                  onPress={takePhoto}
                  variant="secondary"
                  style={styles.uploadButton}
                />
                <Button
                  title="Choose Photo"
                  onPress={pickImage}
                  variant="secondary"
                  style={styles.uploadButton}
                />
              </View>
            </View>
          )}
        </View>
        
        <Input
          label="Recipe Name"
          placeholder="Enter recipe name"
          value={name}
          onChangeText={setName}
        />
        
        <DropdownSelect
          label="Category"
          options={categoryOptions}
          selectedValue={category}
          onSelect={(value) => setCategory(value as RecipeCategory)}
        />
        
        <View style={styles.thumbnailSection}>
          <Text style={styles.thumbnailLabel}>Recipe Thumbnail (Optional)</Text>
          <Text style={styles.thumbnailDescription}>
            Upload a photo of the finished dish to use as the recipe thumbnail
          </Text>
          
          {thumbnailUri ? (
            <View style={styles.thumbnailContainer}>
              <Image source={{ uri: thumbnailUri }} style={styles.thumbnailImage} />
              <Button
                title="Remove Thumbnail"
                onPress={() => setThumbnailUri(null)}
                variant="outline"
                size="small"
                style={styles.removeThumbnailButton}
              />
            </View>
          ) : (
            <View style={styles.thumbnailUploadContainer}>
              <Text style={styles.thumbnailUploadText}>Add a thumbnail image</Text>
              <View style={styles.thumbnailButtonRow}>
                <Button
                  title="Take Photo"
                  onPress={takeThumbnailPhoto}
                  variant="secondary"
                  size="small"
                  style={styles.thumbnailButton}
                />
                <Button
                  title="Choose Photo"
                  onPress={pickThumbnail}
                  variant="secondary"
                  size="small"
                  style={styles.thumbnailButton}
                />
              </View>
            </View>
          )}
        </View>
        
        {isExtracting ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Extracting recipe text...</Text>
            {extractionProgress ? (
              <Text style={styles.loadingSubtext}>{extractionProgress}</Text>
            ) : (
              <Text style={styles.loadingSubtext}>This may take up to 30 seconds</Text>
            )}
          </View>
        ) : extractedText ? (
          <View style={styles.textContainer}>
            <Text style={styles.textLabel}>Extracted Recipe</Text>
            <Text style={styles.extractedText}>{extractedText}</Text>
          </View>
        ) : null}
        
        <Button
          title="Save Recipe"
          onPress={handleSave}
          isLoading={isLoading}
          style={styles.saveButton}
          disabled={!name.trim()}
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
  imageSection: {
    marginBottom: 24,
  },
  uploadContainer: {
    height: 200,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  uploadText: {
    color: Colors.textSecondary,
    marginBottom: 16,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  uploadButton: {
    marginHorizontal: 8,
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginVertical: 16,
  },
  loadingText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  loadingSubtext: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  textContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
  textLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  extractedText: {
    color: Colors.text,
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    marginTop: 16,
    marginBottom: 32,
  },
  thumbnailSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  thumbnailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  thumbnailDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  thumbnailContainer: {
    position: 'relative',
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  removeThumbnailButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  thumbnailUploadContainer: {
    height: 120,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.cardBackground,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  thumbnailUploadText: {
    color: Colors.textSecondary,
    marginBottom: 12,
    fontSize: 14,
  },
  thumbnailButtonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  thumbnailButton: {
    marginHorizontal: 6,
    flex: 1,
  },
});
