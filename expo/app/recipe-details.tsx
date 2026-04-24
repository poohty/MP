import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, TouchableOpacity, Linking, Alert, Platform, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Keyboard } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useRecipes } from '@/hooks/recipe-store';
import { useAuth } from '@/hooks/auth-store';
import Colors from '@/constants/colors';
import { ExternalLink, CheckSquare, Square, Edit3, Camera, Link as LinkIcon, BookPlus, Mic, MicOff, StickyNote, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GradientBackground from '@/components/GradientBackground';
import { Recipe, RecipeCategory } from '@/types';
import DropdownSelect from '@/components/DropdownSelect';
import * as ImagePicker from 'expo-image-picker';
import { compressImageUri, compressBase64Image } from '@/utils/image-compression';
import { useCookAlong } from '@/hooks/useCookAlong';
import { useWalkthrough, WalkthroughStep } from '@/hooks/useWalkthrough';
import WalkthroughModal from '@/components/WalkthroughModal';


const RECIPE_DETAIL_WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    title: 'Hands-free cooking',
    body: 'Tap the microphone next to Instructions to start the hands-free cook-along.',
  },
  {
    title: 'Voice commands',
    body: "Say 'Step Complete' to move to the next step. Say 'Repeat Step' to hear the current step again.",
  },
];

export default function RecipeDetailsScreen() {
  const { id, friendUserId } = useLocalSearchParams<{ id: string; friendUserId?: string }>();
  const { user } = useAuth();
  const { recipes, updateRecipeStepProgress, changeRecipeCategory, updateRecipeImage, updateRecipeNotes, convertImageToBase64, importRecipeFromFriend, getRecipesForUser } = useRecipes();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<{ [stepIndex: number]: boolean }>({});
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [, setIsImporting] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [notesDraft, setNotesDraft] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const notesSectionYRef = useRef<number>(0);

  const scrollToNotesSection = useCallback(() => {
    setTimeout(() => {
      try {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, notesSectionYRef.current - 16), animated: true });
      } catch (e) {
        console.log('scrollToNotesSection error', e);
      }
    }, Platform.OS === 'ios' ? 250 : 150);
  }, []);

  const walkthrough = useWalkthrough('recipe-detail', RECIPE_DETAIL_WALKTHROUGH_STEPS);


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
        setNotesDraft(foundRecipe.userNotes ?? '');
        setIsEditingNotes(false);
        if (!foundRecipe.content && foundRecipe.url) {
          void handleExtractRecipeContent(foundRecipe);
        }
      } else {
        Alert.alert('Error', 'Recipe not found');
        router.back();
      }
    }
  }, [id, friendUserId, getRecipesForUser, recipes, handleExtractRecipeContent]);

  useEffect(() => {
    if (id) {
      void loadRecipe();
    }
  }, [id, loadRecipe]);





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

  const clearAllChecks = useCallback(async () => {
    if (!recipe) return;
    const cleared: { [stepIndex: number]: boolean } = {};
    setCheckedSteps(cleared);
    try {
      await updateRecipeStepProgress(recipe.id, cleared);
      console.log('[RecipeDetails] All checks cleared for recipe:', recipe.id);
    } catch (error) {
      console.error('Failed to clear step progress:', error);
    }
  }, [recipe, updateRecipeStepProgress]);

  const toggleStepCheck = async (stepIndex: number) => {
    if (!recipe || friendUserId) return;
    
    const newCheckedSteps = {
      ...checkedSteps,
      [stepIndex]: !checkedSteps[stepIndex]
    };
    
    setCheckedSteps(newCheckedSteps);
    
    try {
      await updateRecipeStepProgress(recipe.id, newCheckedSteps);
    } catch (error) {
      console.error('Failed to save step progress:', error);
    }

    const totalSteps = parsedInstructions.length;
    if (totalSteps > 0) {
      const allChecked = Array.from({ length: totalSteps }, (_, i) => i).every(
        (i) => !!newCheckedSteps[i]
      );
      if (allChecked) {
        setTimeout(() => {
          Alert.alert(
            'All Steps Complete!',
            'You finished all the instructions. Would you like to clear the checkmarks?',
            [
              { text: 'Keep Checks', style: 'cancel' },
              {
                text: 'Clear Checks',
                onPress: () => void clearAllChecks(),
              },
            ]
          );
        }, 300);
      }
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
    const rawInstructionLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperLine = line.toUpperCase();
      
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
      
      if (!currentSection) {
        if ((/^\d+\./.test(line) || line.startsWith('☐')) && line.length > 3) {
          currentSection = 'instructions';
        } else if ((line.startsWith('-') || line.startsWith('•')) && 
                 (line.match(/\d+\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)/i))) {
          currentSection = 'ingredients';
        } else if (line.toLowerCase().includes('calories:') || line.toLowerCase().includes('protein:') || line.toLowerCase().includes('carbs:') || line.toLowerCase().includes('fat:')) {
          currentSection = 'nutritionalFacts';
        }
      }
      
      if (currentSection === 'ingredients') {
        if (line.startsWith('-') || line.startsWith('•') || 
            line.match(/^\d+\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)/i) ||
            line.match(/\d+\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)/i) ||
            line.match(/\b(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)s?\b/i)) {
          const cleanedLine = line.replace(/^[-•☐]\s*/, '').trim();
          if (cleanedLine.length > 2) {
            sections.ingredients.push(cleanedLine);
          }
        }
      } else if (currentSection === 'instructions') {
        rawInstructionLines.push(line);
      } else if (currentSection === 'nutritionalFacts') {
        sections.nutritionalFacts += (sections.nutritionalFacts ? '\n' : '') + line;
        const caloriesMatch = line.match(/calories\s*[:\-]?\s*([^,;]+)/i) || line.match(/(\d+)\s*calories\b/i);
        if (caloriesMatch && !sections.calories) {
          sections.calories = caloriesMatch[0].trim();
        }
      } else if (currentSection === 'notes') {
        sections.notes += (sections.notes ? ' ' : '') + line;
      }
    }
    
    sections.instructions = parseInstructionLines(rawInstructionLines);
    console.log(`[parseRecipeContent] Parsed ${sections.instructions.length} instruction steps from ${rawInstructionLines.length} raw lines`);
    
    if (sections.instructions.length === 0 && sections.ingredients.length === 0 && content.length > 50) {
      const allLines = content.split('\n').map(l => l.trim()).filter(l => l.length > 3);
      const fallbackInstructionLines: string[] = [];
      
      allLines.forEach(line => {
        if (line.match(/\d+\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)/i) ||
            line.match(/\b(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|gram|ml|liter|clove|slice)s?\b/i)) {
          sections.ingredients.push(line.replace(/^[-•]\s*/, ''));
        } else if (/^\d+\./.test(line) || line.startsWith('☐') || line.length > 10) {
          fallbackInstructionLines.push(line);
        } else if (line.toLowerCase().includes('calories:') || line.toLowerCase().includes('protein:') || line.toLowerCase().includes('carbs:') || line.toLowerCase().includes('fat:')) {
          sections.nutritionalFacts += (sections.nutritionalFacts ? '\n' : '') + line;
          const caloriesMatch = line.match(/calories\s*[:\-]?\s*([^,;]+)/i) || line.match(/(\d+)\s*calories\b/i);
          if (caloriesMatch && !sections.calories) {
            sections.calories = caloriesMatch[0].trim();
          }
        }
      });
      
      if (fallbackInstructionLines.length > 0) {
        sections.instructions = parseInstructionLines(fallbackInstructionLines);
        console.log(`[parseRecipeContent] Fallback parsed ${sections.instructions.length} instruction steps`);
      }
    }
    
    try {
      const fullText = content;

      if (!sections.prepTime) {
        const prepMatch = fullText.match(/prep(?:\s+time)?\s*[:\-]?\s*([^\n]+)/i);
        if (prepMatch && prepMatch[1]) sections.prepTime = prepMatch[1].trim();
      }
      if (!sections.cookTime) {
        const cookMatch = fullText.match(/cook(?:\s+time)?\s*[:\-]?\s*([^\n]+)/i);
        if (cookMatch && cookMatch[1]) sections.cookTime = cookMatch[1].trim();
      }
      if (!sections.totalTime) {
        const totalMatch = fullText.match(/total(?:\s+time)?\s*[:\-]?\s*([^\n]+)/i);
        if (totalMatch && totalMatch[1]) sections.totalTime = totalMatch[1].trim();
      }
      if (!sections.calories) {
        const caloriesMatch = fullText.match(/calories?\s*[:\-]?\s*([^\n]+)/i) || fullText.match(/(\d+)\s*calories\b/i);
        if (caloriesMatch && caloriesMatch[1]) sections.calories = caloriesMatch[1].trim();
      }
      if (!sections.nutritionalFacts) {
        const nutritionBlockMatch = fullText.match(/\*\*Nutritional Facts:\*\*\s*([\s\S]+?)(\n\*\*|$)/i);
        if (nutritionBlockMatch && nutritionBlockMatch[1]) sections.nutritionalFacts = nutritionBlockMatch[1].trim();
      }
    } catch (e) {
      console.log('⚠️ Fallback time/nutrition parsing error:', e);
    }
    
    return sections;
  };

  const parseInstructionLines = (rawLines: string[]): string[] => {
    if (rawLines.length === 0) return [];

    const hasNumberedSteps = rawLines.some(l => /^\d+\./.test(l) || l.startsWith('☐'));

    if (hasNumberedSteps) {
      const steps: string[] = [];
      let currentStep = '';

      for (const line of rawLines) {
        const isNewStep = /^\d+\./.test(line) || /^☐\s*\d+\./.test(line) || line.startsWith('☐');
        if (isNewStep) {
          if (currentStep.trim()) {
            steps.push(currentStep.trim());
          }
          currentStep = line.replace(/^☐\s*/, '').replace(/^\d+\.\s*/, '').trim();
        } else {
          currentStep += ' ' + line;
        }
      }
      if (currentStep.trim()) {
        steps.push(currentStep.trim());
      }

      const filtered = steps.filter(s => s.length > 0);
      if (filtered.length > 0) {
        console.log(`[parseInstructionLines] Extracted ${filtered.length} numbered steps`);
        return filtered;
      }
    }

    const joined = rawLines.join(' ').trim();
    if (!joined) return [];

    const sentenceSplit = joined
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sentenceSplit.length > 1) {
      console.log(`[parseInstructionLines] Split paragraph into ${sentenceSplit.length} sentence-based steps`);
      return sentenceSplit;
    }

    console.log(`[parseInstructionLines] Preserving entire instruction block as single step`);
    return [joined];
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
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        const compressedUri = await compressImageUri(result.assets[0].uri);
        
        const response = await fetch(compressedUri);
        const blob = await response.blob();
        const reader = new FileReader();
        
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
      
      let base64Image = await convertImageToBase64(url);
      
      if (base64Image && base64Image.startsWith('data:')) {
        base64Image = await compressBase64Image(base64Image);
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

  const parsedInstructions = useMemo(() => {
    if (!recipe?.content) return [] as string[];
    const parsed = parseRecipeContent(recipe.content);
    return parsed.instructions;
  }, [recipe?.content]);

  const cookAlong = useCookAlong(parsedInstructions, user?.voicePreference, clearAllChecks);

  useEffect(() => {
    if (cookAlong.cookAlongActive && cookAlong.currentStepIndex >= 0) {
      const newChecked = { ...checkedSteps };
      for (let i = 0; i <= cookAlong.currentStepIndex; i++) {
        newChecked[i] = true;
      }
      setCheckedSteps(newChecked);
    }
  }, [cookAlong.currentStepIndex, cookAlong.cookAlongActive]);

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
                <TouchableOpacity 
                    onPress={() => setShowCategorySelector(!showCategorySelector)} 
                    style={styles.headerButton}
                  >
                    <Edit3 size={24} color={Colors.primary} />
                  </TouchableOpacity>
              )}
            </View>
          ),
        }} 
      />
      <GradientBackground>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          contentContainerStyle={{ paddingBottom: isEditingNotes ? 320 : 32 }}
          keyboardShouldPersistTaps="handled"
        >
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
          
          {recipe.url ? (
            <TouchableOpacity 
              style={styles.urlContainer}
              onPress={handleOpenUrl}
            >
              <ExternalLink size={16} color={Colors.primary} />
              <Text style={styles.url} numberOfLines={1} ellipsizeMode="tail">
                {recipe.url}
              </Text>
            </TouchableOpacity>
          ) : null}
          {isLoadingContent ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>🤖 AI is extracting the full recipe content...</Text>
            </View>
          ) : null}
          {recipe.content ? (() => {
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
                    <View style={styles.instructionHeaderRow}>
                      <Text style={styles.sectionTitle}>👨‍🍳 Instructions</Text>
                      {!friendUserId && (
                        <TouchableOpacity
                          style={[
                            styles.micButton,
                            (cookAlong.cookAlongActive || cookAlong.phase === 'starting') && styles.micButtonActive,
                          ]}
                          onPress={(cookAlong.cookAlongActive || cookAlong.phase === 'starting') ? cookAlong.stopCookAlong : cookAlong.startCookAlong}
                          activeOpacity={0.7}
                          testID="cook-along-mic-button"
                        >
                          {(cookAlong.cookAlongActive || cookAlong.phase === 'starting') ? (
                            <MicOff size={18} color="#FFFFFF" />
                          ) : (
                            <Mic size={18} color={Colors.primary} />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                    {(cookAlong.cookAlongActive || cookAlong.phase === 'starting') && (
                      <View style={styles.cookAlongStatus}>
                        {cookAlong.phase === 'starting' && !cookAlong.isSpeaking && (
                          <View style={styles.statusRow}>
                            <ActivityIndicator size="small" color={Colors.primary} />
                            <Text style={styles.statusText}>Starting cook-along...</Text>
                          </View>
                        )}
                        {cookAlong.isSpeaking && (
                          <View style={styles.statusRow}>
                            <ActivityIndicator size="small" color={Colors.primary} />
                            <Text style={styles.statusText}>Speaking...</Text>
                          </View>
                        )}
                        {cookAlong.isListening && (
                          <View style={styles.statusRow}>
                            <View style={styles.listeningDot} />
                            <Text style={styles.statusText}>Listening...</Text>
                          </View>
                        )}
                        {cookAlong.phase === 'active' && !cookAlong.isSpeaking && !cookAlong.isListening && (
                          <Text style={styles.statusText}>Cook-along active - Step {cookAlong.currentStepIndex + 1}</Text>
                        )}
                      </View>
                    )}
                    {!cookAlong.cookAlongActive && cookAlong.phase !== 'starting' && (
                      <Text style={styles.instructionsSubtitle}>Tap each step to check it off as you cook!</Text>
                    )}
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
                            ]}>{`${index + 1}.`}</Text>
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
                {parsedContent.notes ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💡 Notes & Tips</Text>
                    <Text style={styles.notesText}>{parsedContent.notes}</Text>
                  </View>
                ) : null}

                {/* My Notes (user-authored) */}
                {!friendUserId && (
                  <View
                    style={styles.section}
                    testID="my-notes-section"
                    onLayout={(e) => { notesSectionYRef.current = e.nativeEvent.layout.y; }}
                  >
                    <View style={styles.myNotesHeader}>
                      <View style={styles.myNotesTitleRow}>
                        <StickyNote size={18} color={Colors.primary} />
                        <Text style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 8 }]}>My Notes</Text>
                      </View>
                      {!isEditingNotes && (
                        <TouchableOpacity
                          onPress={() => {
                            setNotesDraft(recipe.userNotes ?? '');
                            setIsEditingNotes(true);
                            scrollToNotesSection();
                          }}
                          style={styles.myNotesEditBtn}
                          testID="my-notes-edit-btn"
                        >
                          <Edit3 size={16} color={Colors.primary} />
                          <Text style={styles.myNotesEditBtnText}>{recipe.userNotes ? 'Edit' : 'Add'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isEditingNotes ? (
                      <View>
                        <TextInput
                          value={notesDraft}
                          onChangeText={setNotesDraft}
                          placeholder="Add your personal notes about this recipe..."
                          placeholderTextColor={Colors.textSecondary}
                          style={styles.myNotesInput}
                          multiline
                          textAlignVertical="top"
                          editable={!isSavingNotes}
                          testID="my-notes-input"
                        />
                        <View style={styles.myNotesActions}>
                          <TouchableOpacity
                            style={[styles.myNotesBtn, styles.myNotesCancelBtn]}
                            onPress={() => {
                              Keyboard.dismiss();
                              setIsEditingNotes(false);
                              setNotesDraft(recipe.userNotes ?? '');
                            }}
                            disabled={isSavingNotes}
                            testID="my-notes-cancel-btn"
                          >
                            <Text style={styles.myNotesCancelText}>Cancel</Text>
                          </TouchableOpacity>
                          {recipe.userNotes ? (
                            <TouchableOpacity
                              style={[styles.myNotesBtn, styles.myNotesClearBtn]}
                              onPress={() => {
                                Alert.alert(
                                  'Remove note?',
                                  'This will delete your note for this recipe.',
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Remove',
                                      style: 'destructive',
                                      onPress: async () => {
                                        setIsSavingNotes(true);
                                        const ok = await updateRecipeNotes(recipe.id, '');
                                        setIsSavingNotes(false);
                                        if (ok) {
                                          setRecipe({ ...recipe, userNotes: '' });
                                          setNotesDraft('');
                                          setIsEditingNotes(false);
                                        } else {
                                          Alert.alert('Error', 'Failed to remove note');
                                        }
                                      },
                                    },
                                  ]
                                );
                              }}
                              disabled={isSavingNotes}
                              testID="my-notes-clear-btn"
                            >
                              <Trash2 size={16} color={Colors.error ?? '#E74C3C'} />
                              <Text style={styles.myNotesClearText}>Remove</Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity
                            style={[styles.myNotesBtn, styles.myNotesSaveBtn]}
                            onPress={async () => {
                              const trimmed = notesDraft.trim();
                              Keyboard.dismiss();
                              setIsSavingNotes(true);
                              const ok = await updateRecipeNotes(recipe.id, trimmed);
                              setIsSavingNotes(false);
                              if (ok) {
                                setRecipe({ ...recipe, userNotes: trimmed });
                                setIsEditingNotes(false);
                              } else {
                                Alert.alert('Error', 'Failed to save note');
                              }
                            }}
                            disabled={isSavingNotes}
                            testID="my-notes-save-btn"
                          >
                            {isSavingNotes ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={styles.myNotesSaveText}>Save</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : recipe.userNotes ? (
                      <Text style={styles.myNotesText} testID="my-notes-text">{recipe.userNotes}</Text>
                    ) : (
                      <Text style={styles.myNotesEmpty}>No notes yet. Tap Add to jot down tips, tweaks, or reminders for this recipe.</Text>
                    )}
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
                                    ]}>{`${index + 1}.`}</Text>
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
          })() : null}
          {!recipe.content && !isLoadingContent && recipe.url ? (
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
          ) : null}
        </View>
        </ScrollView>
        </KeyboardAvoidingView>
        <WalkthroughModal
          visible={walkthrough.isVisible}
          step={walkthrough.currentStep}
          stepIndex={walkthrough.stepIndex}
          totalSteps={walkthrough.totalSteps}
          onNext={walkthrough.next}
        />
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
  myNotesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  myNotesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  myNotesEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
  },
  myNotesEditBtnText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 6,
  },
  myNotesInput: {
    minHeight: 100,
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.textSecondary + '30',
    padding: 12,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  myNotesActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 8,
  },
  myNotesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  myNotesCancelBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.textSecondary + '40',
  },
  myNotesCancelText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  myNotesClearBtn: {
    backgroundColor: (Colors.error ?? '#E74C3C') + '15',
  },
  myNotesClearText: {
    color: Colors.error ?? '#E74C3C',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  myNotesSaveBtn: {
    backgroundColor: Colors.primary,
    minWidth: 72,
    justifyContent: 'center',
  },
  myNotesSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  myNotesText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  myNotesEmpty: {
    color: Colors.textSecondary,
    fontSize: 13,
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
  instructionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  cookAlongStatus: {
    backgroundColor: Colors.primary + '12',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  listeningDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
  },
});