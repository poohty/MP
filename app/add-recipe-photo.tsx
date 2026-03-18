import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, Image, ScrollView, Alert, Platform } from 'react-native';
import { router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRecipes } from '@/hooks/recipe-store';
import Button from '@/components/Button';
import Input from '@/components/Input';
import DropdownSelect from '@/components/DropdownSelect';
import Colors from '@/constants/colors';
import { useTheme } from '@/hooks/theme-store';
import { compressImageUri } from '@/utils/image-compression';

import { RecipeCategory } from '@/types';

const MAX_IMAGE_DIMENSION = 1024;
const AI_REQUEST_TIMEOUT_MS = 30000;

export default function AddRecipePhotoScreen() {
  const { addRecipe } = useRecipes();
  const { isDark } = useTheme();
  const themeColors = isDark ? Colors.dark : Colors.light;

  const themedStyles = useMemo(() => {
    return StyleSheet.create({
      container: {
        backgroundColor: themeColors.background,
      },
      uploadContainer: {
        backgroundColor: themeColors.surface,
      },
      uploadText: {
        color: themeColors.textSecondary,
      },
      loadingContainer: {
        backgroundColor: themeColors.surface,
        borderColor: themeColors.primary,
      },
      loadingTitle: {
        color: themeColors.text,
      },
      loadingProgress: {
        color: themeColors.primary,
      },
      loadingSubtext: {
        color: themeColors.textSecondary,
      },
      textLabel: {
        color: themeColors.text,
      },
      extractedText: {
        color: themeColors.text,
        backgroundColor: themeColors.surface,
      },
      thumbnailLabel: {
        color: themeColors.text,
      },
      thumbnailDescription: {
        color: themeColors.textSecondary,
      },
      thumbnailUploadText: {
        color: themeColors.textSecondary,
      },
      thumbnailContainer: {
        backgroundColor: themeColors.surface,
      },
      thumbnailUploadContainer: {
        backgroundColor: themeColors.surface,
        borderColor: themeColors.border,
      },
      darkInvertButton: {
        backgroundColor: isDark ? Colors.light.background : themeColors.surface,
        borderWidth: 1,
        borderColor: isDark ? themeColors.border : themeColors.border,
      },
      darkInvertButtonText: {
        color: isDark ? Colors.light.foreground : themeColors.text,
      },
    });
  }, [isDark, themeColors.background, themeColors.border, themeColors.primary, themeColors.surface, themeColors.text, themeColors.textSecondary]);
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
      void extractTextFromImage(result.assets[0].uri);
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
      void extractTextFromImage(result.assets[0].uri);
    }
  };

  const resizeImageForExtraction = async (uri: string): Promise<string> => {
    const startTime = Date.now();
    console.log(`[Resize] Starting image resize for extraction...`);

    try {
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        return new Promise<string>((resolve, reject) => {
          const img = new (window as any).Image();
          img.onload = () => {
            let { width, height } = img;
            if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
              const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
              width = Math.round(width * scale);
              height = Math.round(height * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas not supported')); return; }
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            const b64 = dataUrl.split(',')[1] || '';
            console.log(`[Resize] Web resize done in ${Date.now() - startTime}ms, base64 length: ${b64.length}`);
            resolve(b64);
          };
          img.onerror = () => reject(new Error('Failed to load image for resize'));
          img.src = URL.createObjectURL(blob);
        });
      }

      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: MAX_IMAGE_DIMENSION } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );

      const response = await fetch(manipulated.uri);
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = (typeof reader.result === 'string' ? reader.result : '').split(',')[1] || '';
          console.log(`[Resize] Native resize done in ${Date.now() - startTime}ms, base64 length: ${b64.length}`);
          resolve(b64);
        };
        reader.onerror = () => reject(new Error('Failed to read resized image'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn(`[Resize] Resize failed, falling back to original:`, error);
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = (typeof reader.result === 'string' ? reader.result : '').split(',')[1] || '';
          console.log(`[Resize] Fallback base64 length: ${b64.length}`);
          resolve(b64);
        };
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(blob);
      });
    }
  };

  const extractTextFromImage = async (uri: string) => {
    const totalStart = Date.now();
    try {
      setIsExtracting(true);
      setExtractionProgress('📸 Preparing image...');
      console.log('[PhotoExtraction] Starting recipe photo extraction...');

      const base64data = await resizeImageForExtraction(uri);

      if (!base64data || base64data.length < 100) {
        throw new Error('Failed to convert image to base64');
      }

      const imageSizeKB = Math.round(base64data.length / 1024);
      console.log(`[PhotoExtraction] Image payload size: ${imageSizeKB} KB`);

      if (imageSizeKB > 4000) {
        console.warn(`[PhotoExtraction] Image still large (${imageSizeKB} KB), may be slow`);
      }

      setExtractionProgress('🤖 AI is reading the recipe...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
      const aiStart = Date.now();

      console.log('[PhotoExtraction] Sending to AI for extraction...');
      const aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `Extract the complete recipe from this image. Return EXACTLY this format:

INGREDIENTS:
- [ingredient with measurement]

INSTRUCTIONS:
1. [step]
2. [step]
(number ALL steps)

CATEGORY: [Breakfast|Appetizer|Salads & Soups|Main Course|Desserts]

Rules:
- Extract EVERY instruction. Never skip or summarize.
- Split paragraphs into numbered steps at sentence boundaries.
- Keep short steps like "Stir well." or "Serve immediately." as their own step.
- Never drop the last step. Preserve original wording.
- Category: soup/stew/salad=Salads & Soups, sweet=Desserts, eggs/pancakes=Breakfast, small plates=Appetizer, else=Main Course`
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract the recipe from this photo.' },
                { type: 'image', image: base64data }
              ]
            }
          ]
        }),
      });

      clearTimeout(timeoutId);
      const aiElapsed = Date.now() - aiStart;
      console.log(`[PhotoExtraction] AI response received in ${aiElapsed}ms, status: ${aiResponse.status}`);

      if (!aiResponse.ok) {
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      setExtractionProgress('📝 Organizing recipe data...');

      const data = await aiResponse.json();
      const completion = data.completion || 'Failed to extract text from image';

      const categoryMatch = completion.match(/CATEGORY:\s*(Breakfast|Appetizer|Salads & Soups|Main Course|Desserts)/i);
      if (categoryMatch) {
        const suggestedCategory = categoryMatch[1] as RecipeCategory;
        setCategory(suggestedCategory);
        console.log(`[PhotoExtraction] AI suggested category: ${suggestedCategory}`);

        const lowerCompletion = completion.toLowerCase();
        const soupKeywords = ['soup', 'stew', 'chili', 'bisque', 'chowder', 'broth', 'pho', 'ramen', 'gazpacho', 'minestrone'];
        if (soupKeywords.some(kw => lowerCompletion.includes(kw)) && suggestedCategory !== 'Salads & Soups') {
          console.log('[PhotoExtraction] Soup keyword override applied');
          setCategory('Salads & Soups');
        }
      }

      let recipeText = completion;
      const recipeTextBlockMatch = completion.match(/RECIPE TEXT:\s*([\s\S]*?)(?=\n\nCATEGORY:|$)/i);
      if (recipeTextBlockMatch) {
        recipeText = recipeTextBlockMatch[1].trim();
      }

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

      const instructionMatch = recipeText.match(/INSTRUCTIONS:[\s\S]*/i);
      const instructionBlock = instructionMatch ? instructionMatch[0] : '';
      const instructionLineCount = (instructionBlock.match(/^\d+\./gm) || []).length;
      console.log(`[PhotoExtraction] Extracted text length: ${recipeText.length}`);
      console.log(`[PhotoExtraction] Instruction steps found: ${instructionLineCount}`);

      setExtractedText(recipeText);
      setIsExtracting(false);
      setExtractionProgress('');

      const totalElapsed = Date.now() - totalStart;
      console.log(`[PhotoExtraction] Total extraction time: ${totalElapsed}ms`);

      Alert.alert(
        '✅ Extraction Complete',
        'Recipe text has been extracted. Please review and save.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      const totalElapsed = Date.now() - totalStart;
      const isTimeout = error?.name === 'AbortError';
      console.error(`[PhotoExtraction] Extraction failed after ${totalElapsed}ms:`, isTimeout ? 'Request timed out' : error);

      setIsExtracting(false);
      setExtractionProgress('');

      if (isTimeout) {
        Alert.alert(
          '⏱️ Extraction Timed Out',
          'The AI took too long to process the photo. Try again with a clearer or simpler photo.',
          [{ text: 'OK' }]
        );
      } else {
        setExtractedText('Failed to extract text from image. Please try again or enter the recipe manually.');
        Alert.alert(
          '❌ Extraction Failed',
          'Failed to extract text from image. Please try again with a clearer photo.',
          [{ text: 'OK' }]
        );
      }
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
      quality: 0.7,
    });
    
    if (!result.canceled) {
      const compressed = await compressImageUri(result.assets[0].uri);
      setThumbnailUri(compressed);
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
      quality: 0.7,
    });
    
    if (!result.canceled) {
      const compressed = await compressImageUri(result.assets[0].uri);
      setThumbnailUri(compressed);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a recipe name');
      return;
    }
    
    setIsLoading(true);
    try {
      const contentToSave = extractedText.trim();

      const instructionMatch = contentToSave.match(/INSTRUCTIONS:[\s\S]*/i);
      if (instructionMatch) {
        const block = instructionMatch[0];
        const stepCount = (block.match(/^\d+\./gm) || []).length;
        const sentenceCount = (block.match(/[.!?]\s/g) || []).length + 1;
        console.log(`[SaveValidation] Content length: ${contentToSave.length}`);
        console.log(`[SaveValidation] Instruction block length: ${block.length}`);
        console.log(`[SaveValidation] Numbered steps: ${stepCount}, Approx sentences: ${sentenceCount}`);
      } else {
        console.log(`[SaveValidation] No INSTRUCTIONS header found, saving full content (${contentToSave.length} chars)`);
      }

      const saved = await addRecipe({
        name: name.trim(),
        category,
        imageUri: thumbnailUri || imageUri || undefined,
        content: contentToSave,
      });

      if (!saved) {
        Alert.alert(
          'Not Saved',
          'Recipe was not saved. If this is a duplicate, try changing the name or URL.'
        );
        return;
      }
      
      console.log(`[SaveValidation] Recipe saved successfully with ${contentToSave.length} chars of content`);
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
      <ScrollView style={[styles.container, themedStyles.container]} contentContainerStyle={styles.content}>
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
            <View style={[styles.uploadContainer, themedStyles.uploadContainer]}>
              <Text style={[styles.uploadText, themedStyles.uploadText]}>Upload a recipe photo</Text>
              <View style={styles.buttonRow}>
                <Button
                  title="Take Photo"
                  onPress={takePhoto}
                  variant="secondary"
                  style={[styles.uploadButton, themedStyles.darkInvertButton]}
                  textStyle={themedStyles.darkInvertButtonText}
                />
                <Button
                  title="Choose Photo"
                  onPress={pickImage}
                  variant="secondary"
                  style={[styles.uploadButton, themedStyles.darkInvertButton]}
                  textStyle={themedStyles.darkInvertButtonText}
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
          <Text style={[styles.thumbnailLabel, themedStyles.thumbnailLabel]}>Recipe Thumbnail (Optional)</Text>
          <Text style={[styles.thumbnailDescription, themedStyles.thumbnailDescription]}>
            Upload a photo of the finished dish to use as the recipe thumbnail
          </Text>
          
          {thumbnailUri ? (
            <View style={[styles.thumbnailContainer, themedStyles.thumbnailContainer]}>
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
            <View style={[styles.thumbnailUploadContainer, themedStyles.thumbnailUploadContainer]}>
              <Text style={[styles.thumbnailUploadText, themedStyles.thumbnailUploadText]}>Add a thumbnail image</Text>
              <View style={styles.thumbnailButtonRow}>
                <Button
                  title="Take Photo"
                  onPress={takeThumbnailPhoto}
                  variant="secondary"
                  size="small"
                  style={[styles.thumbnailButton, themedStyles.darkInvertButton]}
                  textStyle={themedStyles.darkInvertButtonText}
                />
                <Button
                  title="Choose Photo"
                  onPress={pickThumbnail}
                  variant="secondary"
                  size="small"
                  style={[styles.thumbnailButton, themedStyles.darkInvertButton]}
                  textStyle={themedStyles.darkInvertButtonText}
                />
              </View>
            </View>
          )}
        </View>
        
        {isExtracting ? (
          <View style={[styles.loadingContainer, themedStyles.loadingContainer]}>
            <Text style={[styles.loadingTitle, themedStyles.loadingTitle]}>✨ Extracting Recipe</Text>
            {extractionProgress ? (
              <Text style={[styles.loadingProgress, themedStyles.loadingProgress]}>{extractionProgress}</Text>
            ) : null}
            <Text style={[styles.loadingSubtext, themedStyles.loadingSubtext]}>Please wait, this usually takes 5-15 seconds</Text>
          </View>
        ) : extractedText ? (
          <View style={styles.textContainer}>
            <Text style={[styles.textLabel, themedStyles.textLabel]}>Extracted Recipe</Text>
            <Text style={[styles.extractedText, themedStyles.extractedText]}>{extractedText}</Text>
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
    marginBottom:  16,
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
    fontWeight: '700',
    marginBottom: 12,
  },
  loadingProgress: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtext: {
    color: Colors.textSecondary,
    fontSize: 13,
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
