import React, { useCallback } from 'react';
import { StyleSheet, View, Text, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useMealPlans } from '@/hooks/meal-plan-store';
import MealPlanCard from '@/components/MealPlanCard';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { MealPlan } from '@/types';
import { useWalkthrough, WalkthroughStep } from '@/hooks/useWalkthrough';
import WalkthroughModal from '@/components/WalkthroughModal';

const MEAL_PLANS_STEPS: WalkthroughStep[] = [
  { title: 'Create a meal plan', body: 'Tap Create Meal Plan to answer a few questions so we can build your plan.' },
  { title: 'Review plans', body: 'Your saved meal plans appear here. Tap one to open it.' },
];

export default function MealPlansScreen() {
  const { mealPlans, isLoading, refreshMealPlans } = useMealPlans();
  const walkthrough = useWalkthrough('meal-plans', MEAL_PLANS_STEPS);

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
        onPress={() => router.push('../create-meal-plan')}
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