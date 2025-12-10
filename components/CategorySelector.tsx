import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ScrollView } from 'react-native';
import { RecipeCategory } from '@/types';
import Colors from '@/constants/colors';
import { useTheme } from '@/hooks/theme-store';

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
  const { isDark } = useTheme();
  const theme = isDark ? Colors.dark : Colors.light;
  
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
            { backgroundColor: theme.surface },
            selectedCategory === category && {
              backgroundColor: 'transparent',
              borderColor: isDark ? '#FFFFFF' : theme.primary,
            }
          ]}
          onPress={() => onSelectCategory(category)}
        >
          <Text
            style={[
              styles.categoryText,
              { 
                color: selectedCategory === category 
                  ? (isDark ? '#FFFFFF' : theme.primary)
                  : theme.text 
              },
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
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryText: {
    fontWeight: '500' as const,
    fontSize: 14,
    textAlign: 'center' as const,
  },
});