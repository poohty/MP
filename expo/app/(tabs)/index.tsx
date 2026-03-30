import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import { useAuth } from '@/hooks/auth-store';
import { useRecipes } from '@/hooks/recipe-store';
import { useTheme } from '@/hooks/theme-store';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { Camera, Link, FolderOpen } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useWalkthrough, WalkthroughStep } from '@/hooks/useWalkthrough';
import WalkthroughModal from '@/components/WalkthroughModal';
import OnboardingQuestionnaire from '@/components/OnboardingQuestionnaire';
import { getStarterRecipesForOption, StarterRecipeData } from '@/mocks/starter-recipes';

const HOME_WALKTHROUGH_STEPS: WalkthroughStep[] = [
  { title: 'Add recipes', body: 'You can add recipes in three ways. Let\'s go over them.' },
  { title: 'Upload a photo', body: 'Use the Photo option to scan a recipe from an image.' },
  { title: 'Paste a link', body: 'Use the Link option to paste any recipe URL and import it.' },
  { title: 'Import a folder', body: 'Use Folder/Bookmark import to upload multiple recipe links at once.' },
  { title: 'Fastest way to start', body: 'If you already have a lot of recipe URLs saved, place them all into a folder and upload the whole folder at once. This is much quicker than adding recipes one by one and is the best way to build a large cookbook when you\'re first starting.' },
];

const ONBOARDING_KEY_PREFIX = 'onboarding-completed-';
const RECIPES_PER_OPTION = 3;

export default function HomeScreen() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { seedStarterRecipes } = useRecipes();
  const { isDark } = useTheme();
  const themeColors = isDark ? Colors.dark : Colors.light;
  const { height: windowHeight } = useWindowDimensions();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  const walkthroughEnabled = onboardingChecked && !showOnboarding;
  const walkthrough = useWalkthrough('home', HOME_WALKTHROUGH_STEPS, walkthroughEnabled);

  useEffect(() => {
    if (isLoading) return;

    if (!user?.id || !isAuthenticated) {
      console.log('[Onboarding] No authenticated user, skipping questionnaire');
      setShowOnboarding(false);
      setOnboardingChecked(true);
      return;
    }

    const checkOnboarding = async () => {
      try {
        if (isSupabaseEnabled) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData?.session?.user) {
            console.log('[Onboarding] No real Supabase session, skipping questionnaire');
            setShowOnboarding(false);
            setOnboardingChecked(true);
            return;
          }
        }

        const key = `${ONBOARDING_KEY_PREFIX}${user.id}`;
        const completed = await AsyncStorage.getItem(key);
        console.log(`[Onboarding] Check for user ${user.id}: completed=${!!completed}`);
        if (!completed) {
          setShowOnboarding(true);
        }
      } catch (e) {
        console.warn('[Onboarding] Error checking onboarding state:', e);
      } finally {
        setOnboardingChecked(true);
      }
    };

    void checkOnboarding();
  }, [user?.id, isAuthenticated, isLoading]);

  const handleOnboardingComplete = useCallback(async (selectedOptionIds: string[]) => {
    if (!user?.id) return;

    console.log(`[Onboarding] User selected: ${selectedOptionIds.join(', ')}`);

    const allStarterRecipes: StarterRecipeData[] = [];
    for (const optionId of selectedOptionIds) {
      const recipesForOption = getStarterRecipesForOption(optionId);
      const subset = recipesForOption.slice(0, RECIPES_PER_OPTION);
      allStarterRecipes.push(...subset);
    }

    console.log(`[Onboarding] Seeding ${allStarterRecipes.length} recipes...`);
    const addedCount = await seedStarterRecipes(allStarterRecipes);
    console.log(`[Onboarding] Seeded ${addedCount} recipes`);

    const key = `${ONBOARDING_KEY_PREFIX}${user.id}`;
    const completionData = JSON.stringify({
      completedAt: new Date().toISOString(),
      selectedOptions: selectedOptionIds,
    });
    await AsyncStorage.setItem(key, completionData);
    console.log('[Onboarding] Marked as complete');

    setShowOnboarding(false);
  }, [user?.id, seedStarterRecipes]);

  const layout = useMemo(() => {
    const heroHeight = Math.max(112, Math.min(140, Math.round(windowHeight * 0.17)));
    const actionCardMinHeight = Math.max(112, Math.min(142, Math.round(windowHeight * 0.17)));

    return {
      heroHeight,
      actionCardMinHeight,
    };
  }, [windowHeight]);

  if (isLoading) {
    return null;
  }

  return (
    <GradientBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.name, { color: themeColors.text }]}>Meal Planner Roulette</Text>
        </View>
        
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/jrg902x4tvh7qfksxqiol' }}
            style={styles.heroImage}
            resizeMode="cover"
            testID="home-hero-image"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.heroGradient}
          />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Meal Planner Roulette</Text>
            <Text style={styles.heroSubtitle}>
              Create random meal plans from your recipe collection
            </Text>
          </View>
        </View>
        
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Quick Actions</Text>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[
              styles.actionCard,
              { backgroundColor: themeColors.card, borderColor: themeColors.border, minHeight: layout.actionCardMinHeight },
            ]}
            onPress={() => router.push('../add-recipe-photo')}
            testID="home-action-upload-photo"
          >
            <View style={[styles.actionIconContainer, { backgroundColor: themeColors.muted }]}>
              <Camera size={16} color={themeColors.primary} />
            </View>
            <Text style={[styles.actionTitle, { color: themeColors.text }]}>Upload Recipe</Text>
            <Text style={[styles.actionDescription, { color: themeColors.textSecondary }]}>
              Take a photo or upload from gallery
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.actionCard,
              { backgroundColor: themeColors.card, borderColor: themeColors.border, minHeight: layout.actionCardMinHeight },
            ]}
            onPress={() => router.push('../add-recipe-url')}
            testID="home-action-add-url"
          >
            <View style={[styles.actionIconContainer, { backgroundColor: themeColors.muted }]}>
              <Link size={16} color={themeColors.primary} />
            </View>
            <Text style={[styles.actionTitle, { color: themeColors.text }]}>Add Recipe URL</Text>
            <Text style={[styles.actionDescription, { color: themeColors.textSecondary }]}>
              Save a recipe from the web
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.actionCard,
              { backgroundColor: themeColors.card, borderColor: themeColors.border, minHeight: layout.actionCardMinHeight },
            ]}
            onPress={() => router.push('../upload-bookmarks')}
            testID="home-action-upload-bookmarks"
          >
            <View style={[styles.actionIconContainer, { backgroundColor: themeColors.muted }]}>
              <FolderOpen size={16} color={themeColors.primary} />
            </View>
            <Text style={[styles.actionTitle, { color: themeColors.text }]}>Upload Bookmarks</Text>
            <Text style={[styles.actionDescription, { color: themeColors.textSecondary }]}>
              Import recipes from browser bookmarks
            </Text>
          </TouchableOpacity>
        </View>
        
        <Button
          title="Create This Week's Meal Plan"
          onPress={() => router.push('../create-meal-plan')}
          style={styles.mealPlanButton}
          size="large"
          testID="home-create-meal-plan"
        />
      </ScrollView>
      <WalkthroughModal
        visible={walkthrough.isVisible}
        step={walkthrough.currentStep}
        stepIndex={walkthrough.stepIndex}
        totalSteps={walkthrough.totalSteps}
        onNext={walkthrough.next}
      />
      {onboardingChecked && (
        <OnboardingQuestionnaire
          visible={showOnboarding}
          onComplete={handleOnboardingComplete}
        />
      )}
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 16,
    paddingBottom: 26,
  },
  header: {
    marginBottom: 10,
    alignItems: 'center' as const,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
  },
  heroContainer: {
    width: 358,
    height: 230,
    borderRadius: Colors.radius,
    overflow: 'hidden',
    marginBottom: 10,
    alignSelf: 'center',
    ...Colors.shadowMd,
  },
  heroImage: {
    width: 358,
    height: 230,
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  actionCard: {
    borderRadius: Colors.radius,
    padding: 12,
    flex: 1,
    borderWidth: 1,
    ...Colors.shadow,
  },
  actionIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 6,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 10,
    lineHeight: 13,
  },
  mealPlanButton: {
    marginTop: 2,
    marginBottom: 20,
  },
});

