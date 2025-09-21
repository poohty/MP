import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useRecipes } from '@/hooks/recipe-store';
import RecipeList from '@/components/RecipeList';
import CategorySelector from '@/components/CategorySelector';
import GradientBackground from '@/components/GradientBackground';
import { Recipe, RecipeCategory } from '@/types';
import Colors from '@/constants/colors';
import { Plus, RefreshCw, Image } from 'lucide-react-native';

export default function RecipeBookScreen() {
  const { recipes, isLoading, debugStorage, deleteRecipe, toggleFavorite, refreshRecipes, reExtractImages } = useRecipes();
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory>('Breakfast');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExtractingImages, setIsExtractingImages] = useState(false);

  const filteredRecipes = recipes.filter(recipe => recipe.category === selectedCategory);

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

  const handleExtractImages = async () => {
    try {
      setIsExtractingImages(true);
      
      // Show immediate feedback that the process is starting
      const recipesWithoutImagesCount = recipes.filter(recipe => recipe.url && !recipe.imageUri).length;
      
      if (recipesWithoutImagesCount === 0) {
        Alert.alert(
          'All Set! ✅',
          'All your recipes already have images.',
          [{ text: 'OK' }]
        );
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

  // Count recipes without images
  const recipesWithoutImages = recipes.filter(recipe => recipe.url && !recipe.imageUri).length;

  return (
    <GradientBackground>
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cook Book</Text>
        <View style={styles.headerButtons}>
          {recipesWithoutImages > 0 && (
            <TouchableOpacity 
              style={[styles.addButton, { marginRight: 8, backgroundColor: Colors.accent }]}
              onPress={handleExtractImages}
              disabled={isExtractingImages}
            >
              <Image size={16} color={isExtractingImages ? Colors.textSecondary : Colors.text} />
              {recipesWithoutImages > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{recipesWithoutImages}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.addButton, { marginRight: 8 }]}
            onPress={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={20} color={isRefreshing ? Colors.textSecondary : Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.addButton, { marginRight: 8 }]}
            onPress={debugStorage}
          >
            <Text style={styles.debugText}>Debug</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('../add-recipe-photo')}
          >
            <Plus size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.categoryContainer}>
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
          emptyMessage={`No ${selectedCategory.toLowerCase()} recipes found`}
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
    paddingHorizontal: 16,
    paddingVertical: 20,
    minHeight: 70,
    backgroundColor: Colors.background,
  },
  categoryContainer: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  listContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugText: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
});