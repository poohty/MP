import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { useRecipes } from '@/hooks/recipe-store';
import { useMealPlans } from '@/hooks/meal-plan-store';
import DropdownSelect from '@/components/DropdownSelect';
import Button from '@/components/Button';
import Colors from '@/constants/colors';
import { } from '@/types';

export default function CreateMealPlanScreen() {
  const { recipes } = useRecipes();
  const { generateMealPlan, saveMealPlan } = useMealPlans();
  
  const [includeBreakfast, setIncludeBreakfast] = useState<string>('false');
  const [breakfastCount, setBreakfastCount] = useState<number>(0);
  const [mainCourseCount, setMainCourseCount] = useState<number>(3);
  const [includeAppetizers, setIncludeAppetizers] = useState<string>('false');
  const [appetizerCount, setAppetizerCount] = useState<number>(0);
  const [includeSaladsAndSoups, setIncludeSaladsAndSoups] = useState<string>('false');
  const [saladsAndSoupsCount, setSaladsAndSoupsCount] = useState<number>(0);
  const [includeDesserts, setIncludeDesserts] = useState<string>('false');
  const [dessertCount, setDessertCount] = useState<number>(0);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const mainCourseOptions = Array.from({ length: 8 }, (_, i) => ({
    label: i.toString(),
    value: i,
  }));
  
  const yesNoOptions = [
    { label: 'Yes', value: 'true' },
    { label: 'No', value: 'false' },
  ];
  
  const recipeOptions = recipes.map(recipe => ({
    label: recipe.name,
    value: recipe.id,
  }));
  
  const handleCreateMealPlan = async () => {
    if (breakfastCount === 0 && mainCourseCount === 0 && appetizerCount === 0 && saladsAndSoupsCount === 0 && dessertCount === 0) {
      Alert.alert('Error', 'Please select at least one meal to include in your plan');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('🍽️ Creating meal plan with:', {
        breakfastCount: includeBreakfast === 'true' ? breakfastCount : 0,
        mainCourseCount,
        appetizerCount: includeAppetizers === 'true' ? appetizerCount : 0,
        saladsAndSoupsCount: includeSaladsAndSoups === 'true' ? saladsAndSoupsCount : 0,
        dessertCount: includeDesserts === 'true' ? dessertCount : 0,
        selectedRecipeIds
      });
      
      const mealPlan = generateMealPlan(
        includeBreakfast === 'true' ? breakfastCount : 0,
        mainCourseCount,
        includeAppetizers === 'true' ? appetizerCount : 0,
        includeSaladsAndSoups === 'true' ? saladsAndSoupsCount : 0,
        includeDesserts === 'true' ? dessertCount : 0,
        selectedRecipeIds
      );
      
      if (mealPlan) {
        console.log('✅ Meal plan generated successfully:', mealPlan);
        const saved = await saveMealPlan(mealPlan);
        
        if (saved) {
          console.log('✅ Meal plan saved successfully');
          router.push({
            pathname: '/meal-plan-details',
            params: { id: mealPlan.id }
          });
        } else {
          Alert.alert('Error', 'Failed to save meal plan');
        }
      } else {
        console.log('❌ Failed to generate meal plan');
        Alert.alert('Error', 'Failed to generate meal plan. Please make sure you have recipes in your cookbook.');
      }
    } catch (error) {
      console.error('Error creating meal plan:', error);
      Alert.alert('Error', `Failed to create meal plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelectRecipe = (recipeId: string) => {
    if (selectedRecipeIds.includes(recipeId)) {
      setSelectedRecipeIds(selectedRecipeIds.filter(id => id !== recipeId));
    } else {
      setSelectedRecipeIds([...selectedRecipeIds, recipeId]);
    }
  };
  
  return (
    <>
      <Stack.Screen options={{ title: 'Create Meal Plan' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Create a meal plan for the next 7 days from your recipe collection. The meals you select will be spread across the entire week. For example, if you select 3 main courses, you&apos;ll have meals for 3 days of the week.
            
            💡 Tip: Favorite recipes (marked with ❤️ in your cook book) have a 3x higher chance of being selected for your meal plan!
          </Text>
        </View>
        
        <DropdownSelect
          label="Do you want any breakfast options?"
          options={yesNoOptions}
          selectedValue={includeBreakfast}
          onSelect={(value) => {
            setIncludeBreakfast(value as string);
            if (value === 'false') setBreakfastCount(0);
          }}
        />
        
        {includeBreakfast === 'true' && (
          <DropdownSelect
            label="How many breakfast options would you like this week? (1-7 days)"
            options={mainCourseOptions.filter(o => o.value > 0)}
            selectedValue={breakfastCount}
            onSelect={(value) => setBreakfastCount(value as number)}
          />
        )}
        
        <DropdownSelect
          label="How many main courses do you need for this week? (0-7 days)"
          options={mainCourseOptions}
          selectedValue={mainCourseCount}
          onSelect={(value) => setMainCourseCount(value as number)}
        />
        
        <DropdownSelect
          label="Do you want any appetizers?"
          options={yesNoOptions}
          selectedValue={includeAppetizers}
          onSelect={(value) => {
            setIncludeAppetizers(value as string);
            if (value === 'false') setAppetizerCount(0);
          }}
        />
        
        {includeAppetizers === 'true' && (
          <DropdownSelect
            label="How many appetizers would you like this week? (1-7 days)"
            options={mainCourseOptions.filter(o => o.value > 0)}
            selectedValue={appetizerCount}
            onSelect={(value) => setAppetizerCount(value as number)}
          />
        )}
        
        <DropdownSelect
          label="Do you want any salads & soups?"
          options={yesNoOptions}
          selectedValue={includeSaladsAndSoups}
          onSelect={(value) => {
            setIncludeSaladsAndSoups(value as string);
            if (value === 'false') setSaladsAndSoupsCount(0);
          }}
        />
        
        {includeSaladsAndSoups === 'true' && (
          <DropdownSelect
            label="How many salads & soups would you like this week? (1-7 days)"
            options={mainCourseOptions.filter(o => o.value > 0)}
            selectedValue={saladsAndSoupsCount}
            onSelect={(value) => setSaladsAndSoupsCount(value as number)}
          />
        )}
        
        <DropdownSelect
          label="Would you like dessert options this week?"
          options={yesNoOptions}
          selectedValue={includeDesserts}
          onSelect={(value) => {
            setIncludeDesserts(value as string);
            if (value === 'false') setDessertCount(0);
          }}
        />
        
        {includeDesserts === 'true' && (
          <DropdownSelect
            label="How many desserts would you like this week? (1-7 days)"
            options={mainCourseOptions.filter(o => o.value > 0)}
            selectedValue={dessertCount}
            onSelect={(value) => setDessertCount(value as number)}
          />
        )}
        
        <DropdownSelect
          label="Is there any specific recipe you want added in this week?"
          options={recipeOptions}
          selectedValue={selectedRecipeIds[0] || ''}
          onSelect={(value) => handleSelectRecipe(String(value))}
          placeholder="Select a recipe (optional)"
        />
        
        {selectedRecipeIds.length > 0 && (
          <View style={styles.selectedRecipesContainer}>
            <Text style={styles.selectedRecipesTitle}>Selected Recipes:</Text>
            {selectedRecipeIds.map(id => {
              const recipe = recipes.find(r => r.id === id);
              return (
                <View key={id} style={styles.selectedRecipe}>
                  <Text style={styles.selectedRecipeName}>{recipe?.name}</Text>
                  <Text style={styles.selectedRecipeCategory}>{recipe?.category}</Text>
                </View>
              );
            })}
          </View>
        )}
        
        <Button
          title="Create Meal Plan"
          onPress={handleCreateMealPlan}
          isLoading={isLoading}
          style={styles.createButton}
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
  infoContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  selectedRecipesContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  selectedRecipesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  selectedRecipe: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBackground,
  },
  selectedRecipeName: {
    color: Colors.text,
    flex: 1,
  },
  selectedRecipeCategory: {
    color: Colors.primary,
    marginLeft: 8,
  },
  createButton: {
    marginTop: 16,
    marginBottom: 32,
  },
});