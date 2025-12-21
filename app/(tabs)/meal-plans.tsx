import React, { useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useMealPlans } from '@/hooks/meal-plan-store';
import { useRecipes } from '@/hooks/recipe-store';
import MealPlanCard from '@/components/MealPlanCard';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { MealPlan } from '@/types';
import TutorialCoachmarkModal from '@/components/TutorialCoachmarkModal';
import { useTutorial } from '@/hooks/tutorial-store';

export default function MealPlansScreen() {
  const t = useTutorial('meal-plans', [
    { title: 'Meal Plans', body: 'Create weekly meal plans from your recipes.' },
    { title: 'Create a Plan', body: 'Tap “Create New Meal Plan” to generate a plan.' },
    { title: 'Grocery List', body: 'Open a plan to see ingredients and your grocery list.' },
  ]);

  const { mealPlans, refreshMealPlans } = useMealPlans();
  const { recipes } = useRecipes();

  useFocusEffect(
    useCallback(() => {
      refreshMealPlans();
    }, [refreshMealPlans])
  );

  const handleSelectMealPlan = (mealPlan: MealPlan) => {
    router.push({
      pathname: '/meal-plan-details',
      params: { id: mealPlan.id }
    });
  };

  return (
    <GradientBackground>
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meal Plans</Text>
      </View>
      
      <Button
        title="Create New Meal Plan"
        onPress={() => {
          if (recipes.length === 0) {
            Alert.alert(
              'No recipes yet',
              'You need to upload recipes before you can create a meal plan.',
              [{ text: 'OK' }]
            );
            return;
          }

          router.push('../create-meal-plan');
        }}
        style={styles.createButton}
      />
      
      {mealPlans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            You haven&apos;t created any meal plans yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={mealPlans}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MealPlanCard
              mealPlan={item}
              onPress={handleSelectMealPlan}
            />
          )}
          contentContainerStyle={styles.listContainer}
        />
      )}
      </View>
      <TutorialCoachmarkModal
        visible={t.visible}
        title={t.title}
        body={t.body}
        onOk={t.onOk}
        onClose={t.onClose}
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  createButton: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
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