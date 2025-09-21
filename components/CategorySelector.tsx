import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ScrollView } from 'react-native';
import { RecipeCategory } from '@/types';
import Colors from '@/constants/colors';

interface CategorySelectorProps {
  selectedCategory: RecipeCategory;
  onSelectCategory: (category: RecipeCategory) => void;
}

const categories: RecipeCategory[] = [
  'Breakfast',
  'Appetizer',
  'Salads & Soups',
  'Main Course',
  'Desserts'
];

export default function CategorySelector({ 
  selectedCategory, 
  onSelectCategory 
}: CategorySelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {categories.map((category) => (
        <TouchableOpacity
          key={category}
          style={[
            styles.categoryButton,
            selectedCategory === category && styles.selectedCategory
          ]}
          onPress={() => onSelectCategory(category)}
        >
          <Text
            style={[
              styles.categoryText,
              selectedCategory === category && styles.selectedCategoryText
            ]}
          >
            {category}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    flexDirection: 'row',
    minHeight: 80,
  },
  categoryButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCategory: {
    backgroundColor: 'transparent',
    borderColor: Colors.primary,
  },
  categoryText: {
    color: Colors.textSecondary,
    fontWeight: '500',
    fontSize: 14,
    textAlign: 'center',
  },
  selectedCategoryText: {
    color: Colors.primary,
  },
});