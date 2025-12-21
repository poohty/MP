import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useRecipes } from '@/hooks/recipe-store';
import RecipeList from '@/components/RecipeList';
import CategorySelector from '@/components/CategorySelector';
import GradientBackground from '@/components/GradientBackground';
import { Recipe, RecipeCategory } from '@/types';
import Colors from '@/constants/colors';
import { Plus, RefreshCw, Image } from 'lucide-react-native';
import { useTheme } from '@/hooks/theme-store';

export default function RecipeBookScreen() {
  const { recipes, isLoading, debugStorage, deleteRecipe, toggleFavorite, refreshRecipes, reExtractImages, forceReExtractAllImages } = useRecipes();
  const { isDark } = useTheme();
  const themeColors = isDark ? Colors.dark : Colors.light;
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory>('Breakfast');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExtractingImages, setIsExtractingImages] = useState(false);

  const trimmedSearch = useMemo(() => searchQuery.trim(), [searchQuery]);
  const isSearching = trimmedSearch.length > 0;

  const filteredRecipes = useMemo(() => {
    if (!isSearching) {
      return recipes.filter((recipe) => recipe.category === selectedCategory);
    }

    const q = trimmedSearch.toLowerCase();
    return recipes.filter((recipe) => (recipe.name ?? '').toLowerCase().includes(q));
  }, [isSearching, recipes, selectedCategory, trimmedSearch]);

  const emptyMessage = isSearching
    ? 'No matching recipes found'
    : `No ${selectedCategory.toLowerCase()} recipes found`;

  const handleSelectRecipe = (recipe: Recipe) => {
    router.push({
      pathname: '/recipe-details',
      params: { id: recipe.id }
    });
  };

  const handleDeleteRecipe = async (recipe: Recipe): Promise<boolean> => {
    try {
      const success = await deleteRecipe(recipe.id);
      return success;
    } catch (error) {
      console.error('Error deleting recipe:', error);
      return false;
    }
  };

  const handleToggleFavorite = async (recipe: Recipe): Promise<boolean> => {
    try {
      const success = await toggleFavorite(recipe.id);
      return success;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return false;
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await refreshRecipes();
    } catch (error) {
      console.error('Error refreshing recipes:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleForceReExtractAll = async () => {
    try {
      const recipesWithUrls = recipes.filter(r => r.url).length;
      
      if (recipesWithUrls === 0) {
        Alert.alert(
          'No Recipes to Process',
          'There are no recipes with URLs to re-extract images from.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      Alert.alert(
        '🔄 Force Re-Extract All Images',
        `This will force re-extract images for ${recipesWithUrls} recipe${recipesWithUrls !== 1 ? 's' : ''} with URLs.\n\nThis process may take several minutes. You'll see progress updates.\n\nContinue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start Re-Extract',
            style: 'destructive',
            onPress: async () => {
              setIsExtractingImages(true);
              
              // Show progress alert
              Alert.alert(
                '🔄 Re-Extracting Images',
                `Processing ${recipesWithUrls} recipes...\n\nThis will run in the background. Check console logs for detailed progress.\n\nPlease wait...`,
                []
              );
              
              try {
                console.log(`🚀 Starting FORCE re-extraction for ${recipesWithUrls} recipes...`);
                const result = await forceReExtractAllImages();
                console.log(`✅ FORCE re-extraction complete: ${result.success} success, ${result.failed} failed`);
                
                // Refresh recipes to update UI
                await refreshRecipes();
                
                setIsExtractingImages(false);
                
                // Show completion alert
                Alert.alert(
                  'Re-Extraction Complete! 🎉',
                  `Successfully processed ${result.success} image${result.success !== 1 ? 's' : ''}.${result.failed > 0 ? `\n\n⚠️ ${result.failed} failed to extract.` : ''}\n\n✨ Your cookbook should now display all available images!`,
                  [{ text: 'Great!' }]
                );
              } catch (error) {
                console.error('❌ Error during force re-extraction:', error);
                setIsExtractingImages(false);
                
                Alert.alert(
                  'Re-Extraction Error',
                  'An error occurred during the re-extraction process. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error force re-extracting images:', error);
      setIsExtractingImages(false);
    }
  };
  
  const handleExtractImages = async () => {
    try {
      setIsExtractingImages(true);
      
      const recipesWithoutImagesCount = recipes.filter(recipe => recipe.url && !recipe.imageUri).length;
      
      if (recipesWithoutImagesCount === 0) {
        Alert.alert(
          'All Set! ✅',
          'All your recipes already have images.',
          [{ text: 'OK' }]
        );
        setIsExtractingImages(false);
        return;
      }
      
      console.log(`🚀 Starting image extraction for ${recipesWithoutImagesCount} recipes...`);
      
      const result = await reExtractImages();
      console.log(`Image extraction complete: ${result.success} success, ${result.failed} failed`);
      
      // Show detailed user-friendly feedback
      if (result.success > 0) {
        Alert.alert(
          'Image Extraction Complete! 🎉',
          `Successfully found images for ${result.success} out of ${recipesWithoutImagesCount} recipe${recipesWithoutImagesCount !== 1 ? 's' : ''}!\n\n✨ The AI used advanced image extraction and Google Images search to find the best possible images for your recipes.${result.failed > 0 ? `\n\n⚠️ ${result.failed} recipe${result.failed !== 1 ? 's' : ''} still need images. You can try again later as the AI continues to improve.` : ''}`,
          [{ text: 'Awesome!' }]
        );
      } else if (result.failed > 0) {
        Alert.alert(
          'Image Search Complete',
          `The AI searched extensively but couldn't find suitable images for ${result.failed} recipe${result.failed !== 1 ? 's' : ''}.\n\n🔍 The AI tried:\n• Extracting images from recipe webpages\n• Searching Google Images for recipe photos\n• Multiple retry attempts\n\nYou can try again later as our image detection continues to improve!`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'All Set! ✅',
          'All your recipes already have images.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error extracting images:', error);
      Alert.alert(
        'Extraction Error',
        'An error occurred while trying to extract images. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsExtractingImages(false);
    }
  };

  const recipesWithoutImages = recipes.filter(recipe => recipe.url && !recipe.imageUri).length;
  const recipesWithImages = recipes.filter(recipe => recipe.imageUri).length;
  const totalRecipes = recipes.length;
  
  const handleDebugMenu = () => {
    Alert.alert(
      '🛠️ Debug Menu',
      `Total Recipes: ${totalRecipes}\nWith Images: ${recipesWithImages}\nWithout Images: ${recipesWithoutImages}`,
      [
        { text: 'Image Diagnostics', onPress: () => router.push('/image-diagnostics') },
        { text: 'Debug Storage', onPress: debugStorage },
        { text: 'Force Re-Extract ALL', onPress: handleForceReExtractAll },
        { text: 'Close', style: 'cancel' }
      ]
    );
  };

  return (
    <GradientBackground>
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>Cook Book</Text>
        <View style={styles.headerButtons}>
          {recipesWithoutImages > 0 && (
            <TouchableOpacity 
              style={[styles.addButton, { marginRight: 8, backgroundColor: themeColors.accent }]}
              onPress={handleExtractImages}
              disabled={isExtractingImages}
            >
              <Image size={16} color={isExtractingImages ? themeColors.textSecondary : themeColors.accentForeground} />
              {recipesWithoutImages > 0 && (
                <View style={[styles.badge, { backgroundColor: themeColors.error }]}>
                  <Text style={styles.badgeText}>{recipesWithoutImages}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.addButton, { marginRight: 8, backgroundColor: themeColors.primary }]}
            onPress={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={20} color={isRefreshing ? themeColors.textSecondary : themeColors.primaryForeground} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.addButton, { marginRight: 8, backgroundColor: themeColors.primary }]}
            onPress={handleDebugMenu}
          >
            <Text style={[styles.debugText, { color: themeColors.primaryForeground }]}>Debug</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: themeColors.primary }]}
            onPress={() => router.push('../add-recipe-photo')}
          >
            <Plus size={24} color={themeColors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={[styles.searchContainer, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <View style={[styles.searchInputWrap, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
          testID="cookbookSearchContainer"
        >
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search recipes…"
            placeholderTextColor={themeColors.textSecondary}
            style={[styles.searchInput, { color: themeColors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            testID="cookbookSearchInput"
          />
        </View>
      </View>

      <View style={[styles.categoryContainer, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <CategorySelector
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </View>
      
      <View style={styles.listContainer}>
        <RecipeList
          recipes={filteredRecipes}
          onSelectRecipe={handleSelectRecipe}
          onDeleteRecipe={handleDeleteRecipe}
          onToggleFavorite={handleToggleFavorite}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
        />
      </View>
    </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 70,
    borderBottomWidth: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  searchInputWrap: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: 16,
    height: '100%',
  },
  categoryContainer: {
    borderBottomWidth: 1,
  },
  listContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Colors.shadow,
  },
  debugText: {
    fontSize: 10,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});