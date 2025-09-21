import React from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator } from 'react-native';
import { Recipe } from '@/types';
import RecipeCard from './RecipeCard';
import Colors from '@/constants/colors';

interface RecipeListProps {
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
  onDeleteRecipe?: (recipe: Recipe) => Promise<boolean>;
  onToggleFavorite?: (recipe: Recipe) => Promise<boolean>;
  isLoading?: boolean;
  emptyMessage?: string;
}

export default function RecipeList({
  recipes,
  onSelectRecipe,
  onDeleteRecipe,
  onToggleFavorite,
  isLoading = false,
  emptyMessage = 'No recipes found'
}: RecipeListProps) {
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (recipes.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={recipes}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <RecipeCard 
          recipe={item} 
          onPress={onSelectRecipe}
          onDelete={onDeleteRecipe}
          onToggleFavorite={onToggleFavorite}
        />
      )}
      contentContainerStyle={styles.listContainer}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
});