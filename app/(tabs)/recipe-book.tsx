import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useRecipes } from '@/hooks/recipe-store';
import RecipeList from '@/components/RecipeList';
import CategorySelector from '@/components/CategorySelector';
import GradientBackground from '@/components/GradientBackground';
import { Recipe, RecipeCategory } from '@/types';
import Colors from '@/constants/colors';
import { Image } from 'lucide-react-native';
import { useTheme } from '@/hooks/theme-store';

export default function RecipeBookScreen() {
  const { recipes, isLoading, deleteRecipe, toggleFavorite, reExtractImages, supabaseTemporarilyUnavailable } = useRecipes();
  const { isDark } = useTheme();
  const themeColors = isDark ? Colors.dark : Colors.light;
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory>('Breakfast');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
  


  return (
    <GradientBackground>
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>Cook Book</Text>
        <View style={styles.headerButtons}>
          {recipesWithoutImages > 0 && (
            <TouchableOpacity 
              style={[styles.addButton, { backgroundColor: themeColors.accent }]}
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

      {supabaseTemporarilyUnavailable && (
        <View style={[styles.syncBanner, { backgroundColor: themeColors.warning }]}>
          <Text style={[styles.syncBannerText, { color: themeColors.background }]}>
            ⚠️ Sync temporarily unavailable. Pull to refresh or try again in a minute.
          </Text>
        </View>
      )}
      
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
  syncBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  syncBannerText: {
    fontSize: 13,
    fontWeight: '500',
  },
});