import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useMealPlans } from '@/hooks/meal-plan-store';
import Colors from '@/constants/colors';
import { Trash2, ChevronRight, ShoppingCart, CalendarDays } from 'lucide-react-native';
import { MealPlan, MealPlanRecipe, RecipeCategory } from '@/types';
import MultiplierDropdown from '@/components/MultiplierDropdown';
import Button from '@/components/Button';
import { useWalkthrough, WalkthroughStep } from '@/hooks/useWalkthrough';
import WalkthroughModal from '@/components/WalkthroughModal';
import DatePickerModal from '@/components/DatePickerModal';

const MEAL_PLAN_REVIEW_STEPS: WalkthroughStep[] = [
  { title: 'Roulette changes', body: 'Tap the Roulette Wheel to swap a suggestion. You can spin as many times as you want.' },
];

const CALENDAR_TUTORIAL_STEPS: WalkthroughStep[] = [
  {
    title: 'Schedule meals on your calendar',
    body: 'See the calendar icon next to each recipe? Tap it to pick a day for that meal. Hit Save to lock it in. If you\'d rather skip scheduling, just head straight to Create Grocery List — no calendar needed!',
  },
];
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
    
    <Circle cx="12" cy="12" r="10" stroke="#D97706" strokeWidth="1" fill="url(#wheelGradient)" />
    
    <Path d="M12 2 A10 10 0 0 1 19.31 6.34 L12 12 Z" fill="url(#redSection)" />
    <Path d="M12 12 L19.31 17.66 A10 10 0 0 1 12 22 Z" fill="url(#redSection)" />
    <Path d="M12 12 L4.69 17.66 A10 10 0 0 1 2 12 Z" fill="url(#redSection)" />
    
    <Path d="M12 12 L19.31 6.34 A10 10 0 0 1 22 12 L12 12 Z" fill="url(#blackSection)" />
    <Path d="M12 12 L12 22 A10 10 0 0 1 4.69 17.66 Z" fill="url(#blackSection)" />
    <Path d="M12 12 L2 12 A10 10 0 0 1 4.69 6.34 Z" fill="url(#blackSection)" />
    <Path d="M12 12 L4.69 6.34 A10 10 0 0 1 12 2 Z" fill="url(#blackSection)" />
    
    <Circle cx="12" cy="5" r="1.5" fill="white" />
    <Circle cx="17" cy="8" r="1.5" fill="white" />
    <Circle cx="17" cy="16" r="1.5" fill="white" />
    <Circle cx="12" cy="19" r="1.5" fill="white" />
    <Circle cx="7" cy="16" r="1.5" fill="white" />
    <Circle cx="7" cy="8" r="1.5" fill="white" />
    
    <Circle cx="12" cy="12" r="2" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
    <Circle cx="12" cy="12" r="1" fill="#FCD34D" />
  </Svg>
);

function formatAssignedLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MealPlanDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    mealPlans,
    deleteMealPlan,
    respinRecipe,
    updateRecipeMultiplier,
    generateGroceryList,
    assignRecipeToDate,
    getRecipeAssignedDate,
  } = useMealPlans();
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingGroceryList, setIsGeneratingGroceryList] = useState(false);
  const hasMeals = mealPlan ? (
    (mealPlan.breakfast?.length ?? 0) +
    mealPlan.mainCourses.length +
    mealPlan.appetizers.length +
    mealPlan.saladsAndSoups.length +
    mealPlan.desserts.length
  ) > 0 : false;

  const walkthrough = useWalkthrough('meal-plan-review', MEAL_PLAN_REVIEW_STEPS);
  const calendarTutorial = useWalkthrough('meal-plan-calendar', CALENDAR_TUTORIAL_STEPS, hasMeals && !walkthrough.isVisible);

  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerRecipe, setDatePickerRecipe] = useState<{ recipeId: string; recipeName: string; category: RecipeCategory } | null>(null);

  useEffect(() => {
    if (isDeleting) return;
    if (id) {
      const foundMealPlan = mealPlans.find(p => p.id === id);
      if (foundMealPlan) {
        setMealPlan(foundMealPlan);
      }
    }
  }, [id, mealPlans, isDeleting]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Meal Plan',
      'Are you sure you want to delete this meal plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            if (mealPlan) {
              setIsDeleting(true);
              await deleteMealPlan(mealPlan.id);
              router.back();
              setTimeout(() => {
                Alert.alert('Meal Plan Deleted Successfully');
              }, 500);
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

  const handleOpenDatePicker = useCallback((recipeId: string, recipeName: string, category: RecipeCategory) => {
    setDatePickerRecipe({ recipeId, recipeName, category });
    setDatePickerVisible(true);
  }, []);

  const handleDatePickerSave = useCallback((date: string | null) => {
    if (!mealPlan || !datePickerRecipe) return;
    if (date) {
      const updated = assignRecipeToDate(mealPlan.id, datePickerRecipe.recipeId, datePickerRecipe.recipeName, datePickerRecipe.category, date);
      if (updated) setMealPlan(updated);
    } else {
      const currentDate = getRecipeAssignedDate(mealPlan.id, datePickerRecipe.recipeId);
      if (currentDate) {
        const updated = assignRecipeToDate(mealPlan.id, datePickerRecipe.recipeId, datePickerRecipe.recipeName, datePickerRecipe.category, currentDate);
        if (updated) setMealPlan(updated);
      }
    }
    setDatePickerVisible(false);
    setDatePickerRecipe(null);
  }, [mealPlan, datePickerRecipe, assignRecipeToDate, getRecipeAssignedDate]);

  const handleDatePickerClose = useCallback(() => {
    setDatePickerVisible(false);
    setDatePickerRecipe(null);
  }, []);

  const handleGenerateGroceryList = async () => {
    if (!mealPlan) return;
    setIsGeneratingGroceryList(true);
    try {
      const groceryList = await generateGroceryList(mealPlan);
      if (groceryList) {
        router.push({
          pathname: '/(tabs)/grocery-list',
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

  const renderRecipeItem = (mealPlanRecipe: MealPlanRecipe, category: RecipeCategory, index: number) => {
    const assignedDate = mealPlan ? getRecipeAssignedDate(mealPlan.id, mealPlanRecipe.recipe.id) : null;

    return (
      <View key={`${category}-${index}-${mealPlanRecipe.recipe.id || index}`} style={styles.recipeItem}>
        <TouchableOpacity
          style={styles.recipeContent}
          onPress={() => handleSelectRecipe(mealPlanRecipe)}
        >
          <View style={styles.recipeNameArea}>
            <Text style={styles.recipeName} numberOfLines={2}>{mealPlanRecipe.recipe.name}</Text>
            {assignedDate && (
              <View style={styles.assignedBadge}>
                <CalendarDays size={10} color={Colors.primary} />
                <Text style={styles.assignedBadgeText}>{formatAssignedLabel(assignedDate)}</Text>
              </View>
            )}
          </View>
          <ChevronRight size={20} color={Colors.primary} />
        </TouchableOpacity>
        
        <View style={styles.recipeControls}>
          <MultiplierDropdown
            value={mealPlanRecipe.multiplier}
            onValueChange={(multiplier) => handleMultiplierChange(category, index, multiplier)}
          />
          <View style={styles.iconRow}>
            <TouchableOpacity
              style={styles.respinButton}
              onPress={() => handleRespinRecipe(category, index)}
            >
              <RouletteWheelIcon size={20} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.calendarButton, assignedDate ? styles.calendarButtonActive : null]}
              onPress={() => handleOpenDatePicker(mealPlanRecipe.recipe.id, mealPlanRecipe.recipe.name, category)}
            >
              <CalendarDays size={18} color={assignedDate ? Colors.primary : Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

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

  const currentAssignedDate = datePickerRecipe && mealPlan
    ? getRecipeAssignedDate(mealPlan.id, datePickerRecipe.recipeId)
    : null;

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

      <DatePickerModal
        visible={datePickerVisible}
        recipeName={datePickerRecipe?.recipeName ?? ''}
        currentAssignedDate={currentAssignedDate}
        onSave={handleDatePickerSave}
        onClose={handleDatePickerClose}
      />

      <WalkthroughModal
        visible={walkthrough.isVisible}
        step={walkthrough.currentStep}
        stepIndex={walkthrough.stepIndex}
        totalSteps={walkthrough.totalSteps}
        onNext={walkthrough.next}
        onSkip={walkthrough.skip}
      />

      <WalkthroughModal
        visible={calendarTutorial.isVisible}
        step={calendarTutorial.currentStep}
        stepIndex={calendarTutorial.stepIndex}
        totalSteps={calendarTutorial.totalSteps}
        onNext={calendarTutorial.next}
        onSkip={calendarTutorial.skip}
      />
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
    marginBottom: 20,
  },
  date: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
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
  recipeNameArea: {
    flex: 1,
    marginRight: 8,
  },
  recipeName: {
    fontSize: 16,
    color: Colors.text,
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: `${Colors.primary}12`,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  assignedBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  recipeControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  respinButton: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 8,
    padding: 8,
  },
  calendarButton: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 8,
    padding: 8,
  },
  calendarButtonActive: {
    backgroundColor: `${Colors.primary}15`,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
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
