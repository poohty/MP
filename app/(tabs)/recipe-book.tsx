import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useRecipes } from '@/hooks/recipe-store';
import RecipeList from '@/components/RecipeList';
import CategorySelector from '@/components/CategorySelector';
import GradientBackground from '@/components/GradientBackground';
import { Recipe, RecipeCategory } from '@/types';
import Colors from '@/constants/colors';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/hooks/theme-store';
import { useWalkthrough, WalkthroughStep } from '@/hooks/useWalkthrough';
import WalkthroughModal from '@/components/WalkthroughModal';

const RECIPE_BOOK_STEPS: WalkthroughStep[] = [
  { title: 'Browse categories', body: 'Tap a category to filter your cookbook.' },
  { title: 'Search recipes', body: 'Use the search bar to find recipes by name across your cookbook.' },
  { title: 'Open a recipe', body: 'Tap a recipe card to view ingredients, instructions, and details.' },
];

export default function RecipeBookScreen() {
  const { recipes, isLoading, deleteRecipe, toggleFavorite } = useRecipes();
  const { isDark } = useTheme();
  const themeColors = isDark ? Colors.dark : Colors.light;
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory>('Breakfast');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const walkthrough = useWalkthrough('recipe-book', RECIPE_BOOK_STEPS);

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



  return (
    <GradientBackground>
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>Cook Book</Text>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: themeColors.primary }]}
          onPress={() => router.push('../add-recipe-photo')}
        >
          <Plus size={24} color={themeColors.primaryForeground} />
        </TouchableOpacity>
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
      <WalkthroughModal
        visible={walkthrough.isVisible}
        step={walkthrough.currentStep}
        stepIndex={walkthrough.stepIndex}
        totalSteps={walkthrough.totalSteps}
        onNext={walkthrough.next}
        onSkip={walkthrough.skip}
      />
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 70,
    borderBottomWidth: 1,
    position: 'relative',
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
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    ...Colors.shadow,
  },

});