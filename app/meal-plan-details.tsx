import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useMealPlans } from '@/hooks/meal-plan-store';
import Colors from '@/constants/colors';
import { Trash2, ChevronRight, ShoppingCart } from 'lucide-react-native';
import { MealPlan, MealPlanRecipe, RecipeCategory } from '@/types';
import MultiplierDropdown from '@/components/MultiplierDropdown';
import Button from '@/components/Button';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const RouletteWheelIcon = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Defs>
      <LinearGradient id="wheelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#8B5CF6" />
        <Stop offset="50%" stopColor="#A855F7" />
        <Stop offset="100%" stopColor="#C084FC" />
      </LinearGradient>
      <LinearGradient id="redSection" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#DC2626" />
        <Stop offset="100%" stopColor="#EF4444" />
      </LinearGradient>
      <LinearGradient id="blackSection" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#1F2937" />
        <Stop offset="100%" stopColor="#374151" />
      </LinearGradient>
    </Defs>
    
    {/* Outer rim */}
    <Circle cx="12" cy="12" r="10" stroke="#D97706" strokeWidth="1" fill="url(#wheelGradient)" />
    
    {/* Red sections */}
    <Path d="M12 2 A10 10 0 0 1 19.31 6.34 L12 12 Z" fill="url(#redSection)" />
    <Path d="M12 12 L19.31 17.66 A10 10 0 0 1 12 22 Z" fill="url(#redSection)" />
    <Path d="M12 12 L4.69 17.66 A10 10 0 0 1 2 12 Z" fill="url(#redSection)" />
    
    {/* Black sections */}
    <Path d="M12 12 L19.31 6.34 A10 10 0 0 1 22 12 L12 12 Z" fill="url(#blackSection)" />
    <Path d="M12 12 L12 22 A10 10 0 0 1 4.69 17.66 Z" fill="url(#blackSection)" />
    <Path d="M12 12 L2 12 A10 10 0 0 1 4.69 6.34 Z" fill="url(#blackSection)" />
    <Path d="M12 12 L4.69 6.34 A10 10 0 0 1 12 2 Z" fill="url(#blackSection)" />
    
    {/* Numbers */}
    <Circle cx="12" cy="5" r="1.5" fill="white" />
    <Circle cx="17" cy="8" r="1.5" fill="white" />
    <Circle cx="17" cy="16" r="1.5" fill="white" />
    <Circle cx="12" cy="19" r="1.5" fill="white" />
    <Circle cx="7" cy="16" r="1.5" fill="white" />
    <Circle cx="7" cy="8" r="1.5" fill="white" />
    
    {/* Center hub */}
    <Circle cx="12" cy="12" r="2" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
    <Circle cx="12" cy="12" r="1" fill="#FCD34D" />
  </Svg>
);

export default function MealPlanDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { mealPlans, deleteMealPlan, respinRecipe, updateRecipeMultiplier, generateGroceryList } = useMealPlans();
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isGeneratingGroceryList, setIsGeneratingGroceryList] = useState(false);

  useEffect(() => {
    if (id) {
      const foundMealPlan = mealPlans.find(p => p.id === id);
      if (foundMealPlan) {
        setMealPlan(foundMealPlan);
      } else {
        Alert.alert('Error', 'Meal plan not found');
        router.back();
      }
    }
  }, [id, mealPlans]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Meal Plan',
      'Are you sure you want to delete this meal plan?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: async () => {
            if (mealPlan) {
              await deleteMealPlan(mealPlan.id);
              router.back();
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleSelectRecipe = (mealPlanRecipe: MealPlanRecipe) => {
    router.push({
      pathname: '/recipe-details',
      params: { id: mealPlanRecipe.recipe.id }
    });
  };

  const handleRespinRecipe = (category: RecipeCategory, index: number) => {
    if (!mealPlan) return;
    
    const updatedMealPlan = respinRecipe(mealPlan.id, category, index);
    if (updatedMealPlan) {
      setMealPlan(updatedMealPlan);
    }
  };

  const handleMultiplierChange = (category: RecipeCategory, index: number, multiplier: number) => {
    if (!mealPlan) return;
    
    const updatedMealPlan = updateRecipeMultiplier(mealPlan.id, category, index, multiplier);
    if (updatedMealPlan) {
      setMealPlan(updatedMealPlan);
    }
  };

  const handleGenerateGroceryList = async () => {
    if (!mealPlan) return;
    
    setIsGeneratingGroceryList(true);
    try {
      const groceryList = await generateGroceryList(mealPlan);
      if (groceryList) {
        router.push({
          pathname: '/grocery-list',
          params: { groceryListData: JSON.stringify(groceryList) }
        });
      } else {
        Alert.alert('Error', 'Failed to generate grocery list. Please try again.');
      }
    } catch (error) {
      console.error('Error generating grocery list:', error);
      Alert.alert('Error', 'Failed to generate grocery list. Please try again.');
    } finally {
      setIsGeneratingGroceryList(false);
    }
  };

  const renderRecipeItem = (mealPlanRecipe: MealPlanRecipe, category: RecipeCategory, index: number) => (
    <View key={mealPlanRecipe.recipe.id} style={styles.recipeItem}>
      <TouchableOpacity
        style={styles.recipeContent}
        onPress={() => handleSelectRecipe(mealPlanRecipe)}
      >
        <Text style={styles.recipeName}>{mealPlanRecipe.recipe.name}</Text>
        <ChevronRight size={20} color={Colors.primary} />
      </TouchableOpacity>
      
      <View style={styles.recipeControls}>
        <MultiplierDropdown
          value={mealPlanRecipe.multiplier}
          onValueChange={(multiplier) => handleMultiplierChange(category, index, multiplier)}
        />
        <TouchableOpacity
          style={styles.respinButton}
          onPress={() => handleRespinRecipe(category, index)}
        >
          <RouletteWheelIcon size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (!mealPlan) {
    return null;
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Meal Plan',
          headerRight: () => (
            <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
              <Trash2 size={24} color={Colors.error} />
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.date}>{formatDate(mealPlan.createdAt)}</Text>
        </View>
        
        {mealPlan.breakfast && mealPlan.breakfast.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Breakfast</Text>
            {mealPlan.breakfast.map((mealPlanRecipe, index) => 
              renderRecipeItem(mealPlanRecipe, 'Breakfast', index)
            )}
          </View>
        )}
        
        {mealPlan.mainCourses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Main Courses</Text>
            {mealPlan.mainCourses.map((mealPlanRecipe, index) => 
              renderRecipeItem(mealPlanRecipe, 'Main Course', index)
            )}
          </View>
        )}
        
        {mealPlan.appetizers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appetizers</Text>
            {mealPlan.appetizers.map((mealPlanRecipe, index) => 
              renderRecipeItem(mealPlanRecipe, 'Appetizer', index)
            )}
          </View>
        )}
        
        {mealPlan.saladsAndSoups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Salads & Soups</Text>
            {mealPlan.saladsAndSoups.map((mealPlanRecipe, index) => 
              renderRecipeItem(mealPlanRecipe, 'Salads & Soups', index)
            )}
          </View>
        )}
        
        {mealPlan.desserts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Desserts</Text>
            {mealPlan.desserts.map((mealPlanRecipe, index) => 
              renderRecipeItem(mealPlanRecipe, 'Desserts', index)
            )}
          </View>
        )}
        
        <View style={styles.groceryListSection}>
          <Button
            title={isGeneratingGroceryList ? 'Generating...' : 'Create Grocery List'}
            onPress={handleGenerateGroceryList}
            disabled={isGeneratingGroceryList}
            style={styles.groceryListButton}
          >
            {isGeneratingGroceryList ? (
              <ActivityIndicator size="small" color={Colors.background} style={styles.buttonIcon} />
            ) : (
              <ShoppingCart size={20} color={Colors.background} style={styles.buttonIcon} />
            )}
          </Button>
        </View>
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
  headerButton: {
    marginRight: 8,
  },
  header: {
    marginBottom: 24,
  },
  date: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  recipeItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  recipeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipeName: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  recipeControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  respinButton: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 8,
    padding: 8,
  },
  groceryListSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  groceryListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
});