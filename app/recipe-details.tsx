import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, TouchableOpacity, Linking, Alert, Platform, TextInput, Modal } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useRecipes } from '@/hooks/recipe-store';
import { useAuth } from '@/hooks/auth-store';
import Colors from '@/constants/colors';
import { ExternalLink, Trash2, CheckSquare, Square, Edit3, Camera, Link as LinkIcon, BookPlus, Mic, MicOff, SkipForward, RotateCcw, Settings } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GradientBackground from '@/components/GradientBackground';
import { Recipe, RecipeCategory } from '@/types';
import DropdownSelect from '@/components/DropdownSelect';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RecipeDetailsScreen() {
  const { id, friendUserId } = useLocalSearchParams<{ id: string; friendUserId?: string }>();
  const { user } = useAuth();
  const { recipes, deleteRecipe, updateRecipeStepProgress, changeRecipeCategory, updateRecipeImage, convertImageToBase64, importRecipeFromFriend, getRecipesForUser } = useRecipes();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<{ [stepIndex: number]: boolean }>({});
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [, setIsImporting] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [currentVoiceStep, setCurrentVoiceStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceVariant, setVoiceVariant] = useState<'female' | 'male' | 'neutral'>('female');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const voiceStepsRef = useRef<string[]>([]);

  const handleExtractRecipeContent = useCallback(async (recipeToUpdate: Recipe) => {
    if (!recipeToUpdate.url) return;
    
    setIsLoadingContent(true);
    try {
      // For now, we'll just show a message that this feature is being updated
      console.log('Recipe content extraction is being updated...');
    } catch (error) {
      console.error('Error extracting recipe content:', error);
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  const loadRecipe = useCallback(async () => {
    if (friendUserId) {
      const friendRecipes = await getRecipesForUser(friendUserId);
      const foundRecipe = friendRecipes.find(r => r.id === id);
      if (foundRecipe) {
        setRecipe(foundRecipe);
        setCheckedSteps({});
      } else {
        Alert.alert('Error', 'Recipe not found');
        router.back();
      }
    } else {
      const foundRecipe = recipes.find(r => r.id === id);
      if (foundRecipe) {
        setRecipe(foundRecipe);
        setCheckedSteps(foundRecipe.stepProgress || {});
        if (!foundRecipe.content && foundRecipe.url) {
          handleExtractRecipeContent(foundRecipe);
        }
      } else {
        Alert.alert('Error', 'Recipe not found');
        router.back();
      }
    }
  }, [id, friendUserId, getRecipesForUser, recipes, handleExtractRecipeContent]);

  useEffect(() => {
    if (id) {
      loadRecipe();
      loadVoiceSettings();
    }
  }, [id, loadRecipe]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const loadVoiceSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('@voice_variant');
      if (saved === 'female' || saved === 'male' || saved === 'neutral') {
        setVoiceVariant(saved);
      }
    } catch (error) {
      console.error('Failed to load voice settings:', error);
    }
  };

  const saveVoiceSettings = async (variant: 'female' | 'male' | 'neutral') => {
    try {
      await AsyncStorage.setItem('@voice_variant', variant);
      setVoiceVariant(variant);
    } catch (error) {
      console.error('Failed to save voice settings:', error);
    }
  };

  const getVoiceConfig = () => {
    switch (voiceVariant) {
      case 'female':
        return {
          language: 'en-US',
          rate: 0.9,
          pitch: 1.1,
        };
      case 'male':
        return {
          language: 'en-GB',
          rate: 0.9,
          pitch: 0.85,
        };
      case 'neutral':
        return {
          language: 'en-US',
          rate: 0.9,
          pitch: 1.0,
        };
      default:
        return {
          language: 'en-US',
          rate: 0.9,
          pitch: 1.0,
        };
    }
  };

  const speakStep = async (stepIndex: number) => {
    if (stepIndex >= voiceStepsRef.current.length) {
      Speech.speak('Enjoy your meal. See ya next time', {
        ...getVoiceConfig(),
        onDone: () => {
          setIsSpeaking(false);
          setIsVoiceMode(false);
          setCurrentVoiceStep(0);
        },
      });
      return;
    }

    const stepText = voiceStepsRef.current[stepIndex];
    const speakText = `Step ${stepIndex + 1}. ${stepText}`;

    setIsSpeaking(true);
    Speech.speak(speakText, {
      ...getVoiceConfig(),
      onDone: () => {
        setIsSpeaking(false);
      },
    });
  };

  const handleStartVoiceMode = (steps: string[]) => {
    voiceStepsRef.current = steps;
    setIsVoiceMode(true);
    setCurrentVoiceStep(0);
    speakStep(0);
  };

  const handleStopVoiceMode = () => {
    Speech.stop();
    setIsSpeaking(false);
    setIsVoiceMode(false);
    setCurrentVoiceStep(0);
  };

  const handleRepeatStep = () => {
    Speech.stop();
    speakStep(currentVoiceStep);
  };

  const handleNextStep = async () => {
    Speech.stop();
    
    if (!recipe) return;
    
    await toggleStepCheck(currentVoiceStep);
    
    const nextStep = currentVoiceStep + 1;
    setCurrentVoiceStep(nextStep);
    
    if (nextStep >= voiceStepsRef.current.length) {
      Speech.speak('Enjoy your meal. See ya next time', {
        ...getVoiceConfig(),
        onDone: () => {
          setIsSpeaking(false);
          setIsVoiceMode(false);
          setCurrentVoiceStep(0);
        },
      });
    } else {
      speakStep(nextStep);
    }
  };

  const handleImportToMyCookbook = async () => {
    if (!recipe || !user) return;

    setIsImporting(true);
    try {
      const success = await importRecipeFromFriend(recipe, user.id);
      if (success) {
        Alert.alert(
          'Success',
          'Recipe added to your cookbook!',
          [
            {
              text: 'View in My Cookbook',
              onPress: () => router.push('/(tabs)/recipe-book'),
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to add recipe to your cookbook');
      }
    } catch {
      Alert.alert('Error', 'Failed to add recipe to your cookbook');
    } finally {
      setIsImporting(false);
    }
  };

  const toggleStepCheck = async (stepIndex: number) => {
    if (!recipe || friendUserId) return;
    
    const newCheckedSteps = {
      ...checkedSteps,
      [stepIndex]: !checkedSteps[stepIndex]
    };
    
    setCheckedSteps(newCheckedSteps);
    
    // Save step progress to storage
    try {
      await updateRecipeStepProgress(recipe.id, newCheckedSteps);
    } catch (error) {
      console.error('Failed to save step progress:', error);
    }
  };

  const parseRecipeContent = (content: string) => {
    const sections = {
      ingredients: [] as string[],
      instructions: [] as string[],
      nutritionalFacts: '' as string,
      calories: '' as string,
      prepTime: '' as string,
      cookTime: '' as string,
      totalTime: '' as string,
      notes: '' as string
    };
    
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let currentSection = '';
    
    // Enhanced parsing logic with better section detection
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperLine = line.toUpperCase();
      
      // Section headers - more precise detection
      if (upperLine.startsWith('**INGREDIENTS:**') || upperLine.startsWith('INGREDIENTS:') || upperLine === 'INGREDIENTS' || upperLine.includes('INGREDIENTS LIST')) {
        currentSection = 'ingredients';
        continue;
      } else if (upperLine.startsWith('**INSTRUCTIONS:**') || upperLine.startsWith('**DIRECTIONS:**') || upperLine.startsWith('INSTRUCTIONS:') || upperLine.startsWith('DIRECTIONS:') || upperLine.startsWith('METHOD:') || 
                 upperLine.startsWith('STEPS:') || upperLine === 'INSTRUCTIONS' || upperLine === 'DIRECTIONS' || 
                 upperLine === 'METHOD' || upperLine === 'STEPS' || upperLine.includes('COOKING INSTRUCTIONS')) {
        currentSection = 'instructions';
        continue;
      } else if (upperLine.startsWith('**NUTRITIONAL FACTS:**') || upperLine.startsWith('**NUTRITION:**') || upperLine.startsWith('NUTRITIONAL FACTS:') || upperLine.startsWith('NUTRITION:') || upperLine === 'NUTRITIONAL FACTS' || 
                 upperLine === 'NUTRITION' || upperLine.includes('NUTRITION INFO')) {
        currentSection = 'nutritionalFacts';
        continue;
      } else if (upperLine.startsWith('**TIMES:**') || upperLine.startsWith('TIMES:') || upperLine === 'TIMES' || upperLine.includes('PREP TIME') || upperLine.includes('COOK TIME')) {
        currentSection = 'times';
        continue;
      } else if (upperLine.startsWith('**NOTES:**') || upperLine.startsWith('NOTES:') || upperLine.startsWith('TIPS:') || upperLine === 'NOTES' || 
                 upperLine === 'TIPS' || upperLine.includes('COOKING TIPS')) {
        currentSection = 'notes';
        continue;
      }
      
      // Auto-detect sections based on content patterns
      if (!currentSection) {
        // Numbered steps or checkboxes = instructions
        if ((/^\d+\./.test(line) || line.startsWith('☐')) && line.length > 10) {
          currentSection = 'instructions';
        }
        // Bullet points with measurements = ingredients
        else if ((line.startsWith('-') || line.startsWith('•')) && 
                 (line.match(/\d+\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)/i))) {
          currentSection = 'ingredients';
        }
        // Lines with cooking verbs = instructions
        else if (line.length > 15) {
          const cookingVerbs = ['heat', 'cook', 'bake', 'boil', 'simmer', 'fry', 'sauté', 'mix', 'stir', 'add', 'combine', 'whisk', 'blend', 'preheat', 'season', 'garnish', 'serve'];
          const hasCookingVerb = cookingVerbs.some(verb => line.toLowerCase().includes(verb));
          if (hasCookingVerb) {
            currentSection = 'instructions';
          }
        }
        // Nutrition-related lines
        else if (line.toLowerCase().includes('calories:') || line.toLowerCase().includes('protein:') || line.toLowerCase().includes('carbs:') || line.toLowerCase().includes('fat:')) {
          currentSection = 'nutritionalFacts';
        }
        // Time-related lines
        else if (line.toLowerCase().includes('prep time:') || line.toLowerCase().includes('cook time:') || line.toLowerCase().includes('total time:')) {
          // Process time info inline instead of changing section
        }
      }
      
      // Parse content based on current section
      if (currentSection === 'ingredients') {
        // Only add lines that look like ingredients (with measurements or typical ingredient patterns)
        if (line.startsWith('-') || line.startsWith('•') || 
            line.match(/^\d+\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)/i) ||
            line.match(/\d+\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)/i) ||
            line.match(/\b(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)s?\b/i)) {
          const cleanedLine = line
            .replace(/^[-•☐]\s*/, '')
            .trim();
          if (cleanedLine.length > 2) {
            sections.ingredients.push(cleanedLine);
          }
        }
      } else if (currentSection === 'instructions') {
        // Only add lines that look like cooking instructions (NOT ingredients)
        const looksLikeIngredient = line.match(/\d+\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)/i) ||
                                   line.match(/\b(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)s?\b/i);
        
        if (!looksLikeIngredient && (
            /^\d+\./.test(line) || line.startsWith('☐') ||
            (line.length > 15 && (line.includes('cook') || line.includes('heat') || line.includes('add') || 
                                  line.includes('mix') || line.includes('stir') || line.includes('bake') || 
                                  line.includes('boil') || line.includes('simmer') || line.includes('serve') ||
                                  line.includes('preheat') || line.includes('season') || line.includes('combine') ||
                                  line.includes('place') || line.includes('remove') || line.includes('cover') ||
                                  line.includes('reduce') || line.includes('increase') || line.includes('let') ||
                                  line.includes('allow') || line.includes('until') || line.includes('for') ||
                                  line.includes('minutes') || line.includes('hours'))))) {
          const cleanedLine = line.replace(/^\d+\.\s*/, '').replace(/^[-•☐]\s*/, '');
          if (cleanedLine.length > 5) {
            sections.instructions.push(cleanedLine);
          }
        }
      } else if (currentSection === 'nutritionalFacts') {
        sections.nutritionalFacts += (sections.nutritionalFacts ? '\n' : '') + line;
        
        // Try to extract a specific Calories value if present
        const caloriesMatch =
          line.match(/calories\s*[:\-]?\s*([^,;]+)/i) ||
          line.match(/(\d+)\s*calories\b/i);
        
        if (caloriesMatch && !sections.calories) {
          const caloriesText = caloriesMatch[0].trim();
          sections.calories = caloriesText;
        }
      } else if (currentSection === 'notes') {
        sections.notes += (sections.notes ? ' ' : '') + line;
      }
    }
    
    // Fallback: if no clear sections found, try to extract from raw content
    if (sections.instructions.length === 0 && sections.ingredients.length === 0 && content.length > 50) {
      const allLines = content.split('\n').map(l => l.trim()).filter(l => l.length > 5);
      
      allLines.forEach(line => {
        // Check if it's an ingredient (has measurements)
        if (line.match(/\d+\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)/i) ||
            line.match(/\b(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)s?\b/i)) {
          sections.ingredients.push(line.replace(/^[-•]\s*/, ''));
        }
        // Check if it's an instruction (has cooking verbs and is long enough, but NOT an ingredient)
        else if (line.length > 15) {
          const cookingVerbs = ['heat', 'cook', 'bake', 'boil', 'simmer', 'fry', 'sauté', 'mix', 'stir', 'add', 'combine', 'whisk', 'blend', 'preheat', 'season', 'serve', 'place', 'remove', 'cover', 'reduce', 'increase', 'let', 'allow', 'until', 'minutes', 'hours'];
          const hasCookingVerb = cookingVerbs.some(verb => line.toLowerCase().includes(verb));
          const looksLikeIngredient = line.match(/\d+\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)/i) ||
                                     line.match(/\b(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)s?\b/i);
          
          if (hasCookingVerb && !looksLikeIngredient) {
            sections.instructions.push(line.replace(/^\d+\.\s*/, '').replace(/^[-•☐]\s*/, ''));
          }
        }
        // Check for nutrition info
        else if (line.toLowerCase().includes('calories:') || line.toLowerCase().includes('protein:') || line.toLowerCase().includes('carbs:') || line.toLowerCase().includes('fat:')) {
          sections.nutritionalFacts += (sections.nutritionalFacts ? '\n' : '') + line;
          
          // Try to extract a specific Calories value if present
          const caloriesMatch =
            line.match(/calories\s*[:\-]?\s*([^,;]+)/i) ||
            line.match(/(\d+)\s*calories\b/i);
          
          if (caloriesMatch && !sections.calories) {
            const caloriesText = caloriesMatch[0].trim();
            sections.calories = caloriesText;
          }
        }
        // Check for time info
        else if (line.toLowerCase().includes('prep time:') || line.toLowerCase().includes('cook time:') || line.toLowerCase().includes('total time:')) {
          const lower = line.toLowerCase();
          
          // Extract prep time
          if (lower.includes('prep time')) {
            const match = line.match(/prep time\s*[:\-]?\s*(.+)$/i);
            if (match && !sections.prepTime) {
              sections.prepTime = match[1].trim();
            }
          }
          
          // Extract cook time
          if (lower.includes('cook time')) {
            const match = line.match(/cook time\s*[:\-]?\s*(.+)$/i);
            if (match && !sections.cookTime) {
              sections.cookTime = match[1].trim();
            }
          }
          
          // Extract total time
          if (lower.includes('total time')) {
            const match = line.match(/total time\s*[:\-]?\s*(.+)$/i);
            if (match && !sections.totalTime) {
              sections.totalTime = match[1].trim();
            }
          }
        }
      });
    }
    
    // ---------------------------
    // Fallback parsing from full content
    // ---------------------------
    try {
      const fullText = content;

      // Prep time (e.g., "Prep Time: 15 minutes" or "Prep: 15 mins")
      if (!sections.prepTime) {
        const prepMatch =
          fullText.match(/prep(?:\s+time)?\s*[:\-]?\s*([^\n]+)/i);
        if (prepMatch && prepMatch[1]) {
          sections.prepTime = prepMatch[1].trim();
        }
      }

      // Cook time (e.g., "Cook Time: 30 minutes" or "Cook: 30 mins")
      if (!sections.cookTime) {
        const cookMatch =
          fullText.match(/cook(?:\s+time)?\s*[:\-]?\s*([^\n]+)/i);
        if (cookMatch && cookMatch[1]) {
          sections.cookTime = cookMatch[1].trim();
        }
      }

      // Total time (e.g., "Total Time: 45 minutes" or "Total: 45 mins")
      if (!sections.totalTime) {
        const totalMatch =
          fullText.match(/total(?:\s+time)?\s*[:\-]?\s*([^\n]+)/i);
        if (totalMatch && totalMatch[1]) {
          sections.totalTime = totalMatch[1].trim();
        }
      }

      // Calories (e.g., "Calories: 320 kcal" or "320 calories")
      if (!sections.calories) {
        const caloriesMatch =
          fullText.match(/calories?\s*[:\-]?\s*([^\n]+)/i) ||
          fullText.match(/(\d+)\s*calories\b/i);

        if (caloriesMatch && caloriesMatch[1]) {
          sections.calories = caloriesMatch[1].trim();
        }
      }

      // Nutritional Facts block (from the AI-generated section)
      // Look for the "**Nutritional Facts:**" heading and capture everything until the next bold heading or end
      if (!sections.nutritionalFacts) {
        const nutritionBlockMatch = fullText.match(
          /\*\*Nutritional Facts:\*\*\s*([\s\S]+?)(\n\*\*|$)/i
        );
        if (nutritionBlockMatch && nutritionBlockMatch[1]) {
          sections.nutritionalFacts = nutritionBlockMatch[1].trim();
        }
      }
    } catch (e) {
      console.log('⚠️ Fallback time/nutrition parsing error:', e);
    }
    
    return sections;
  };

  const handleOpenUrl = async () => {
    if (recipe?.url) {
      const canOpen = await Linking.canOpenURL(recipe.url);
      if (canOpen) {
        await Linking.openURL(recipe.url);
      } else {
        Alert.alert('Error', 'Cannot open this URL');
      }
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Recipe',
      'Are you sure you want to delete this recipe?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: async () => {
            if (recipe) {
              await deleteRecipe(recipe.id);
              router.back();
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleCategoryChange = async (newCategory: RecipeCategory) => {
    if (!recipe) return;
    
    try {
      const success = await changeRecipeCategory(recipe.id, newCategory);
      if (success) {
        setRecipe({ ...recipe, category: newCategory });
        setShowCategorySelector(false);
        Alert.alert('Success', `Recipe moved to ${newCategory} category`);
      } else {
        Alert.alert('Error', 'Failed to change recipe category');
      }
    } catch (error) {
      console.error('Error changing recipe category:', error);
      Alert.alert('Error', 'Failed to change recipe category');
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please allow access to your photos to upload an image.');
        return;
      }

      setIsUploadingImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images' as any],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        const reader = new FileReader();
        const response = await fetch(imageUri);
        const blob = await response.blob();
        
        reader.onloadend = async () => {
          const base64String = reader.result as string;
          
          if (recipe) {
            const success = await updateRecipeImage(recipe.id, base64String);
            if (success) {
              setRecipe({ ...recipe, imageUri: base64String });
              setShowImageModal(false);
              Alert.alert('Success', 'Recipe image updated successfully!');
            } else {
              Alert.alert('Error', 'Failed to update recipe image');
            }
          }
        };
        
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePasteImageUrl = async () => {
    if (!recipe) return;
    
    const url = imageUrlInput.trim();
    
    if (!url) {
      Alert.alert('Error', 'Please enter an image URL');
      return;
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Error', 'Please enter a valid image URL starting with http:// or https://');
      return;
    }

    try {
      setIsUploadingImage(true);
      
      const base64Image = await convertImageToBase64(url);
      
      if (base64Image && base64Image.startsWith('data:')) {
        const success = await updateRecipeImage(recipe.id, base64Image);
        if (success) {
          setRecipe({ ...recipe, imageUri: base64Image });
          setShowImageModal(false);
          setImageUrlInput('');
          Alert.alert('Success', 'Recipe image updated successfully!');
        } else {
          Alert.alert('Error', 'Failed to update recipe image');
        }
      } else {
        Alert.alert('Error', 'Failed to load image from URL. Please make sure the URL is a direct image link.');
      }
    } catch (error) {
      console.error('Error loading image from URL:', error);
      Alert.alert('Error', 'Failed to load image from URL. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const categoryOptions = [
    { label: 'Breakfast', value: 'Breakfast' },
    { label: 'Appetizer', value: 'Appetizer' },
    { label: 'Salads & Soups', value: 'Salads & Soups' },
    { label: 'Main Course', value: 'Main Course' },
    { label: 'Desserts', value: 'Desserts' },
  ];

  const getImageSource = (recipe: Recipe): string | undefined => {
    if (recipe.imageUri && 
        typeof recipe.imageUri === 'string' && 
        (recipe.imageUri.startsWith('data:image/') || 
         recipe.imageUri.startsWith('http://') || 
         recipe.imageUri.startsWith('https://'))) {
      return recipe.imageUri;
    }
    return undefined;
  };

  if (!recipe) {
    return (
      <>
        <Stack.Screen options={{ title: "Recipe Details" }} />
        <GradientBackground>
          <View style={styles.container}>
            <Text style={styles.title}>Recipe not found</Text>
          </View>
        </GradientBackground>
      </>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: recipe.name,
          headerBackTitle: Platform.OS === 'ios' ? 'Back' : undefined,
          headerBackVisible: true,
          gestureEnabled: true,
          headerRight: () => (
            <View style={styles.headerButtons}>
              {friendUserId ? (
                <TouchableOpacity 
                  onPress={handleImportToMyCookbook}
                  style={styles.headerButton}
                >
                  <BookPlus size={24} color={Colors.success} />
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity 
                    onPress={() => setShowCategorySelector(!showCategorySelector)} 
                    style={styles.headerButton}
                  >
                    <Edit3 size={24} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                    <Trash2 size={24} color={Colors.error} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          ),
        }} 
      />
      <GradientBackground>
        <ScrollView style={styles.container}>
        <View style={styles.imageContainer}>
          {getImageSource(recipe) ? (
            <Image
              source={{ uri: getImageSource(recipe) }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.image, { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: Colors.textSecondary, fontSize: 16 }}>No Image</Text>
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.gradient}
          />
          <View style={styles.imageOverlay}>
            <Text style={styles.categoryBadge}>{recipe.category}</Text>
          </View>
          <TouchableOpacity 
            style={styles.changeImageButton}
            onPress={() => setShowImageModal(true)}
          >
            <Camera size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title}>{recipe.name}</Text>
          
          {showCategorySelector && (
            <View style={styles.categoryChangeContainer}>
              <Text style={styles.categoryChangeTitle}>Move to Category:</Text>
              <DropdownSelect
                label=""
                options={categoryOptions}
                selectedValue={recipe.category}
                onSelect={(value) => handleCategoryChange(value as RecipeCategory)}
              />
              <TouchableOpacity 
                style={styles.cancelCategoryButton}
                onPress={() => setShowCategorySelector(false)}
              >
                <Text style={styles.cancelCategoryText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {recipe.url && (
            <TouchableOpacity 
              style={styles.urlContainer}
              onPress={handleOpenUrl}
            >
              <ExternalLink size={16} color={Colors.primary} />
              <Text style={styles.url} numberOfLines={1} ellipsizeMode="tail">
                {recipe.url}
              </Text>
            </TouchableOpacity>
          )}
          
          {isLoadingContent && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>🤖 AI is extracting the full recipe content...</Text>
            </View>
          )}
          
          {recipe.content && (() => {
            const parsedContent = parseRecipeContent(recipe.content);
            
            // Use structured fields from Recipe object, falling back to parsed content
            const displayPrepTime =
              recipe.prepTime || parsedContent.prepTime || 'no data found';
            const displayCookTime =
              recipe.cookTime || parsedContent.cookTime || 'no data found';
            const displayTotalTime =
              recipe.totalTime || parsedContent.totalTime || 'no data found';
            const displayCalories =
              recipe.calories || parsedContent.calories || 'no data found';
            const displayNutrition =
              recipe.nutritionalInfo || parsedContent.nutritionalFacts || 'no data found';
            
            return (
              <View style={styles.recipeContent}>
                {/* Ingredients Section */}
                {parsedContent.ingredients.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🥘 Ingredients</Text>
                    {parsedContent.ingredients.map((ingredient, index) => (
                      <View key={index} style={styles.ingredientItem}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.ingredientText}>{ingredient}</Text>
                      </View>
                    ))}
                    
                    {/* Time & Nutrition under ingredients */}
                    <View style={styles.subSection}>
                      <Text style={styles.sectionSubtitle}>⏱️ Time</Text>
                      <Text style={styles.detailText}>
                        Prep time: {displayPrepTime}
                      </Text>
                      <Text style={styles.detailText}>
                        Cook time: {displayCookTime}
                      </Text>
                      <Text style={styles.detailText}>
                        Total time: {displayTotalTime}
                      </Text>

                      <Text style={[styles.sectionSubtitle, { marginTop: 12 }]}>📊 Nutrition</Text>
                      <Text style={styles.detailText}>
                        Calories: {displayCalories}
                      </Text>
                      <Text style={styles.detailText}>
                        Nutritional info: {displayNutrition}
                      </Text>
                    </View>
                  </View>
                )}
                
                {/* Instructions Section */}
                {parsedContent.instructions.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.instructionsHeader}>
                      <Text style={styles.sectionTitle}>👨‍🍳 Instructions</Text>
                      <TouchableOpacity
                        onPress={() => {
                          if (isVoiceMode) {
                            handleStopVoiceMode();
                          } else {
                            handleStartVoiceMode(parsedContent.instructions);
                          }
                        }}
                        style={styles.voiceButton}
                      >
                        {isVoiceMode ? (
                          <MicOff size={24} color={Colors.error} />
                        ) : (
                          <Mic size={24} color={Colors.primary} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setShowVoiceSettings(true)}
                        style={styles.voiceButton}
                      >
                        <Settings size={20} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    {isVoiceMode && (
                      <View style={styles.voiceControls}>
                        <Text style={styles.voiceControlsTitle}>
                          🎙️ Voice Mode Active - Step {currentVoiceStep + 1} of {parsedContent.instructions.length}
                        </Text>
                        <View style={styles.voiceControlButtons}>
                          <TouchableOpacity
                            onPress={handleRepeatStep}
                            style={[styles.voiceControlButton, styles.repeatButton]}
                            disabled={isSpeaking}
                          >
                            <RotateCcw size={20} color="#FFFFFF" />
                            <Text style={styles.voiceControlButtonText}>Repeat</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleNextStep}
                            style={[styles.voiceControlButton, styles.nextButton]}
                            disabled={isSpeaking}
                          >
                            <SkipForward size={20} color="#FFFFFF" />
                            <Text style={styles.voiceControlButtonText}>Next Step</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                    <Text style={styles.instructionsSubtitle}>Tap each step to check it off as you cook!</Text>
                    {parsedContent.instructions.map((instruction, index) => {
                      // Clean up instruction text and handle checkboxes
                      const cleanInstruction = instruction.replace(/^☐\s*/, '').replace(/^\d+\.\s*/, '');
                      
                      return (
                        <TouchableOpacity 
                          key={index} 
                          style={[
                            styles.instructionItem,
                            checkedSteps[index] && styles.checkedInstructionItem
                          ]}
                          onPress={() => toggleStepCheck(index)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.stepHeader}>
                            {checkedSteps[index] ? (
                              <CheckSquare size={24} color={Colors.success} />
                            ) : (
                              <Square size={24} color={Colors.textSecondary} />
                            )}
                            <Text style={[
                              styles.stepNumber,
                              checkedSteps[index] && styles.checkedStepNumber
                            ]}>{index + 1}.</Text>
                          </View>
                          <Text style={[
                            styles.instructionText,
                            checkedSteps[index] && styles.checkedText
                          ]}>
                            {cleanInstruction}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                
                {/* Notes Section */}
                {parsedContent.notes && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💡 Notes & Tips</Text>
                    <Text style={styles.notesText}>{parsedContent.notes}</Text>
                  </View>
                )}
                
                {/* Show raw content with step checkboxes ONLY for instruction-like content */}
                {(parsedContent.ingredients.length === 0 && parsedContent.instructions.length === 0) && (
                  <View style={styles.rawContentContainer}>
                    <Text style={styles.contentTitle}>Recipe Details</Text>
                    {/* Only create checkboxes for instruction-like lines (not ingredients) */}
                    {(() => {
                      const lines = recipe.content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                      
                      // Filter for instruction-like lines only (exclude ingredient-like lines)
                      const instructionLines = lines.filter(line => {
                        // Must be numbered steps, checkboxes, OR contain cooking verbs
                        const isNumberedStep = /^\d+\./.test(line) && line.length > 10;
                        const hasCheckbox = line.startsWith('☐');
                        const hasCookingVerb = line.length > 15 && 
                          ['cook', 'heat', 'add', 'mix', 'stir', 'bake', 'boil', 'simmer', 'serve', 'preheat', 'season', 'combine', 'place', 'remove', 'cover', 'reduce', 'increase', 'let', 'allow', 'until', 'minutes', 'hours'].some(verb => 
                            line.toLowerCase().includes(verb)
                          );
                        
                        // Exclude lines that look like ingredients (have measurements or measurement words)
                        const looksLikeIngredient = line.match(/\d+\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)/i) ||
                                                   line.match(/\b(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)s?\b/i) ||
                                                   line.startsWith('-') && line.match(/\b(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)s?\b/i) ||
                                                   line.startsWith('•') && line.match(/\b(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)s?\b/i);
                        
                        return (isNumberedStep || hasCheckbox || hasCookingVerb) && !looksLikeIngredient;
                      });
                      
                      if (instructionLines.length > 0) {
                        return (
                          <View>
                            <Text style={styles.instructionsSubtitle}>Tap each cooking step to check it off:</Text>
                            {instructionLines.map((step, index) => {
                              const cleanStep = step.replace(/^\d+\.\s*/, '').replace(/^[-•☐]\s*/, '');
                              
                              return (
                                <TouchableOpacity 
                                  key={index} 
                                  style={[
                                    styles.instructionItem,
                                    checkedSteps[index] && styles.checkedInstructionItem
                                  ]}
                                  onPress={() => toggleStepCheck(index)}
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.stepHeader}>
                                    {checkedSteps[index] ? (
                                      <CheckSquare size={24} color={Colors.success} />
                                    ) : (
                                      <Square size={24} color={Colors.textSecondary} />
                                    )}
                                    <Text style={[
                                      styles.stepNumber,
                                      checkedSteps[index] && styles.checkedStepNumber
                                    ]}>{index + 1}.</Text>
                                  </View>
                                  <Text style={[
                                    styles.instructionText,
                                    checkedSteps[index] && styles.checkedText
                                  ]}>
                                    {cleanStep}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                            
                            {/* Show full content below checkboxes */}
                            <View style={styles.fullContentSection}>
                              <Text style={styles.fullContentTitle}>Full Recipe Content:</Text>
                              <Text style={styles.contentText}>{recipe.content}</Text>
                            </View>
                          </View>
                        );
                      } else {
                        return <Text style={styles.contentText}>{recipe.content}</Text>;
                      }
                    })()} 
                  </View>
                )}
              </View>
            );
          })()}
          
          {!recipe.content && !isLoadingContent && recipe.url && (
            <View style={styles.noContentContainer}>
              <Text style={styles.noContentTitle}>Recipe Instructions</Text>
              <Text style={styles.noContentText}>
                This recipe was imported without detailed instructions. 
                Tap the link above to view the full recipe on the original website.
              </Text>
              <TouchableOpacity 
                style={styles.extractButton}
                onPress={() => handleExtractRecipeContent(recipe)}
              >
                <Text style={styles.extractButtonText}>🤖 Extract Recipe Content with AI</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        </ScrollView>

        <Modal
          visible={showImageModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowImageModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Change Recipe Image</Text>
              <Text style={styles.modalDescription}>
                Choose a new image for this recipe
              </Text>

              <TouchableOpacity 
                style={styles.modalButton}
                onPress={handlePickImage}
                disabled={isUploadingImage}
              >
                <Camera size={24} color={Colors.primary} />
                <Text style={styles.modalButtonText}>
                  {isUploadingImage ? 'Uploading...' : 'Upload from Photos'}
                </Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.urlInputContainer}>
                <LinkIcon size={20} color={Colors.textSecondary} style={styles.urlIcon} />
                <TextInput
                  style={styles.urlInput}
                  placeholder="Paste image URL here..."
                  placeholderTextColor={Colors.textSecondary}
                  value={imageUrlInput}
                  onChangeText={setImageUrlInput}
                  editable={!isUploadingImage}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity 
                style={[styles.modalButton, styles.pasteButton]}
                onPress={handlePasteImageUrl}
                disabled={isUploadingImage || !imageUrlInput.trim()}
              >
                <Text style={styles.modalButtonText}>
                  {isUploadingImage ? 'Loading...' : 'Use This URL'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setShowImageModal(false);
                  setImageUrlInput('');
                }}
                disabled={isUploadingImage}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showVoiceSettings}
          transparent
          animationType="slide"
          onRequestClose={() => setShowVoiceSettings(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Voice Settings</Text>
              <Text style={styles.modalDescription}>
                Choose your preferred voice for cooking instructions
              </Text>

              <TouchableOpacity
                style={[
                  styles.voiceVariantButton,
                  voiceVariant === 'female' && styles.voiceVariantButtonActive,
                ]}
                onPress={() => saveVoiceSettings('female')}
              >
                <View style={styles.voiceVariantContent}>
                  <Text style={[
                    styles.voiceVariantText,
                    voiceVariant === 'female' && styles.voiceVariantTextActive,
                  ]}>
                    Female Voice
                  </Text>
                  <Text style={styles.voiceVariantDescription}>Higher pitch</Text>
                </View>
                {voiceVariant === 'female' && (
                  <View style={styles.checkmark}>
                    <CheckSquare size={24} color={Colors.primary} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.voiceVariantButton,
                  voiceVariant === 'male' && styles.voiceVariantButtonActive,
                ]}
                onPress={() => saveVoiceSettings('male')}
              >
                <View style={styles.voiceVariantContent}>
                  <Text style={[
                    styles.voiceVariantText,
                    voiceVariant === 'male' && styles.voiceVariantTextActive,
                  ]}>
                    Male Voice
                  </Text>
                  <Text style={styles.voiceVariantDescription}>Lower pitch</Text>
                </View>
                {voiceVariant === 'male' && (
                  <View style={styles.checkmark}>
                    <CheckSquare size={24} color={Colors.primary} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.voiceVariantButton,
                  voiceVariant === 'neutral' && styles.voiceVariantButtonActive,
                ]}
                onPress={() => saveVoiceSettings('neutral')}
              >
                <View style={styles.voiceVariantContent}>
                  <Text style={[
                    styles.voiceVariantText,
                    voiceVariant === 'neutral' && styles.voiceVariantTextActive,
                  ]}>
                    Neutral Voice
                  </Text>
                  <Text style={styles.voiceVariantDescription}>Balanced tone</Text>
                </View>
                {voiceVariant === 'neutral' && (
                  <View style={styles.checkmark}>
                    <CheckSquare size={24} color={Colors.primary} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowVoiceSettings(false)}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </GradientBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
  },
  imageContainer: {
    height: 250,
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
  },
  categoryBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    color: Colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  url: {
    color: Colors.primary,
    marginLeft: 8,
    flex: 1,
  },
  recipeContent: {
    marginBottom: 24,
  },
  loadingContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
    marginTop: 2,
  },
  ingredientText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  checkedInstructionItem: {
    backgroundColor: Colors.success + '10',
    borderColor: Colors.success + '30',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    minWidth: 60,
  },
  stepNumber: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    minWidth: 30,
  },
  checkedStepNumber: {
    color: Colors.success,
  },
  instructionText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  checkedText: {
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
    opacity: 0.7,
  },
  instructionsSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  notesText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  rawContentContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  contentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  contentText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  noContentContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.textSecondary + '20',
  },
  extractButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  extractButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  noContentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  noContentText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  categoryChangeContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  categoryChangeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  cancelCategoryButton: {
    marginTop: 12,
    padding: 8,
    alignItems: 'center',
  },
  cancelCategoryText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  fullContentSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.textSecondary + '20',
  },
  fullContentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  nutritionText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  timesText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  changeImageButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  pasteButton: {
    backgroundColor: Colors.primary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.textSecondary + '30',
  },
  dividerText: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginHorizontal: 12,
    fontWeight: '600',
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  urlIcon: {
    marginRight: 8,
  },
  urlInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    padding: 0,
  },
  cancelButton: {
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  subSection: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  sectionSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  voiceButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.cardBackground,
    marginLeft: 8,
  },
  voiceControls: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.primary + '40',
  },
  voiceControlsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  voiceControlButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  voiceControlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  repeatButton: {
    backgroundColor: Colors.textSecondary,
  },
  nextButton: {
    backgroundColor: Colors.success,
  },
  voiceControlButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  voiceVariantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  voiceVariantButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  voiceVariantContent: {
    flex: 1,
  },
  voiceVariantText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  voiceVariantTextActive: {
    color: Colors.primary,
  },
  voiceVariantDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  checkmark: {
    marginLeft: 12,
  },
});