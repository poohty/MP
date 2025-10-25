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
      quality: 1,
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
      quality: 1,
    });
    
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      extractTextFromImage(result.assets[0].uri);
    }
  };

  const extractTextFromImage = async (uri: string) => {
    try {
      setIsExtracting(true);
      
      // Convert image to base64
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onload = async () => {
        const base64data = reader.result?.toString().split(',')[1];
        
        if (!base64data) {
          throw new Error('Failed to convert image to base64');
        }
        
        // Call AI endpoint to extract text
        const aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: '🚨 ULTRA-PRECISE RECIPE EXTRACTION & CATEGORIZATION EXPERT 🚨\n\nYou are the MOST ACCURATE recipe content extractor. Your job is to extract ONLY the complete ingredients and step-by-step instructions from recipe images, then categorize with ABSOLUTE PRECISION.\n\n📋 EXTRACTION REQUIREMENTS:\n\n✅ EXTRACT EXACTLY (MANDATORY):\n\n🥘 INGREDIENTS SECTION:\n- Complete list of ALL ingredients with EXACT measurements\n- Include quantities, measurements, and any sub-sections\n- Format: "- [ingredient with exact measurement and preparation notes]"\n- Include ALL ingredient lists (for sauce, marinade, etc.)\n- Do NOT summarize or alter ingredients\n\n👨‍🍳 INSTRUCTIONS SECTION:\n- Step-by-step cooking instructions (numbered sequentially)\n- Each step exactly as described on the page\n- Include temperatures, times, and cooking methods\n- Do NOT combine or summarize steps\n- Format: "1. [detailed, actionable cooking step]"\n\n❌ DO NOT EXTRACT:\n- Personal stories, blog content, author bios\n- Nutritional information or disclaimers\n- Comments, reviews, ratings\n- Advertisement content\n- Social sharing buttons\n- Related recipe suggestions\n\n🚨 CATEGORIZATION RULES (ULTRA-STRICT):\n\n🥗 SALADS & SOUPS (HIGHEST PRIORITY - CHECK FIRST):\n- ANY recipe with: soup, stew, chili, bisque, chowder, broth, pho, ramen, gazpacho, minestrone, gumbo, borscht\n- ALL liquid-based dishes served in bowls\n- ALL salads (caesar, greek, cobb, coleslaw, pasta salad, etc.)\n\n🥞 BREAKFAST:\n- Pancakes, waffles, French toast, oatmeal, granola, breakfast bowls, egg dishes, muffins\n\n🍤 APPETIZER:\n- Small plates, dips, wings, sliders, finger foods\n\n🍖 MAIN COURSE:\n- Solid entrees (NOT liquid-based), meat dishes, pasta (NOT soup-like), pizza, burgers\n\n🍰 DESSERTS:\n- Cakes, cookies, pies, ice cream, puddings, sweet treats\n\n🎯 FORMAT RESPONSE AS:\nRECIPE TEXT:\n\nINGREDIENTS:\n- [exact ingredient with measurement]\n- [exact ingredient with measurement]\n\nINSTRUCTIONS:\n1. [detailed cooking step with temperatures/times]\n2. [detailed cooking step with temperatures/times]\n\nSUGGESTED CATEGORY: [category name]'
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: '🚨 ULTRA-PRECISE RECIPE EXTRACTION & CATEGORIZATION\n\nExtract the COMPLETE recipe from this image with MAXIMUM ACCURACY. Focus ONLY on ingredients and cooking instructions.\n\n📋 CRITICAL EXTRACTION MISSION:\n\n🥘 INGREDIENTS EXTRACTION:\n- Find and extract the COMPLETE list of ALL ingredients\n- Include EXACT quantities, measurements, and preparation notes\n- Include ALL ingredient sub-sections (for sauce, marinade, etc.)\n- Do NOT summarize or alter any ingredient\n- Format each as: "- [ingredient with exact measurement]"\n\n👨‍🍳 INSTRUCTIONS EXTRACTION:\n- Find and extract ALL step-by-step cooking instructions\n- Number each step exactly as described (1, 2, 3...)\n- Include temperatures, cooking times, and methods\n- Do NOT combine or summarize steps\n- Each step must be actionable and complete\n\n🚨 CATEGORIZATION PROTOCOL (ULTRA-STRICT):\n\n1. 🥗 SOUP DETECTION (HIGHEST PRIORITY):\n   Scan for: soup, stew, chili, bisque, chowder, broth, pho, ramen, gazpacho, minestrone, gumbo, borscht\n   If ANY found → "Salads & Soups" (MANDATORY)\n\n2. 🥗 SALAD DETECTION:\n   Scan for: salad, caesar, greek, cobb, coleslaw\n   If found → "Salads & Soups"\n\n3. 🥞 BREAKFAST DETECTION:\n   Scan for: pancake, waffle, french toast, oatmeal, granola, breakfast, egg, omelet, muffin\n   If found → "Breakfast"\n\n4. 🍰 DESSERT DETECTION:\n   Scan for: cake, cookie, pie, dessert, sweet, chocolate, pudding, ice cream\n   If found → "Desserts"\n\n5. 🍤 APPETIZER DETECTION:\n   Scan for: appetizer, dip, wings, slider, finger food\n   If found → "Appetizer"\n\n6. DEFAULT: "Main Course"\n\n🎯 MANDATORY FORMAT:\nRECIPE TEXT:\n\nINGREDIENTS:\n- [exact ingredient with measurement]\n- [exact ingredient with measurement]\n\nINSTRUCTIONS:\n1. [detailed cooking step with temperatures/times]\n2. [detailed cooking step with temperatures/times]\n\nSUGGESTED CATEGORY: [category name]\n\n🚨 CRITICAL: Extract ONLY the recipe content. Ignore all other text on the image.'
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
        
        const data = await aiResponse.json();
        const completion = data.completion || 'Failed to extract text from image';
        
        // Parse AI response for category suggestion with enhanced validation
        const categoryMatch = completion.match(/SUGGESTED CATEGORY:\s*(Breakfast|Appetizer|Salads & Soups|Main Course|Desserts)/i);
        if (categoryMatch) {
          const suggestedCategory = categoryMatch[1] as RecipeCategory;
          setCategory(suggestedCategory);
          console.log(`🤖 AI suggested category: ${suggestedCategory}`);
          
          // Additional validation for soup detection in extracted text
          const recipeTextMatch = completion.match(/RECIPE TEXT:\s*([\s\S]*?)(?=\n\nSUGGESTED CATEGORY:|$)/i);
          const recipeText = recipeTextMatch ? recipeTextMatch[1].trim().toLowerCase() : '';
          
          const soupKeywords = ['soup', 'stew', 'chili', 'bisque', 'chowder', 'broth', 'pho', 'ramen', 'gazpacho', 'minestrone'];
          const hasSoupKeyword = soupKeywords.some(keyword => recipeText.includes(keyword));
          
          if (hasSoupKeyword && suggestedCategory !== 'Salads & Soups') {
            console.log(`🚨 SOUP OVERRIDE: Found soup keyword in recipe text, forcing category to Salads & Soups`);
            setCategory('Salads & Soups');
          }
        }
        
        // Extract recipe text (remove category suggestion from display)
        const recipeTextMatch = completion.match(/RECIPE TEXT:\s*([\s\S]*?)(?=\n\nSUGGESTED CATEGORY:|$)/i);
        let recipeText = recipeTextMatch ? recipeTextMatch[1].trim() : completion;
        
        // Ensure recipe text has proper formatting for ingredients and instructions
        if (recipeText && !recipeText.includes('INGREDIENTS:') && !recipeText.includes('INSTRUCTIONS:')) {
          // If the AI didn't format properly, try to structure it
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
        
        console.log(`✅ Successfully extracted recipe content (${recipeText.length} chars) and categorized as: ${category}`);
        
        Alert.alert(
          'Extraction Complete',
          'Recipe text has been successfully extracted. Please review and save.',
          [{ text: 'OK' }]
        );
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error extracting text:', error);
      setExtractedText('Failed to extract text from image. Please try again or enter the recipe manually.');
      setIsExtracting(false);
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
        imageUri: thumbnailUri || imageUri || undefined, // Use thumbnail if provided, otherwise original image
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
        
        {/* Thumbnail Upload Section */}
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
            <Text style={styles.loadingSubtext}>This may take a few moments</Text>
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
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingSubtext: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
    opacity: 0.7,
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