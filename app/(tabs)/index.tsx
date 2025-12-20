import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-store';
import { useRecipes } from '@/hooks/recipe-store';
import { useTheme } from '@/hooks/theme-store';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { Camera, Link, FolderOpen } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function HomeScreen() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { recipes } = useRecipes();
  const { isDark } = useTheme();
  const themeColors = isDark ? Colors.dark : Colors.light;

  // Show welcome screen if not authenticated
  if (!isLoading && !isAuthenticated) {
    return <WelcomeScreen />;
  }

  if (isLoading) {
    return null;
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <GradientBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: themeColors.textSecondary }]}>{getGreeting()}</Text>
          <Text style={[styles.name, { color: themeColors.text }]}>{user?.name || 'Chef'}</Text>
        </View>
        
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/gfb0m82wngp62v8dzwiob' }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.heroGradient}
          />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Meal Planning Roulette</Text>
            <Text style={styles.heroSubtitle}>
              Create random meal plans from your recipe collection
            </Text>
          </View>
        </View>
        
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.statNumber, { color: themeColors.text }]}>{recipes.length}</Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Recipes</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.statNumber, { color: themeColors.text }]}>
              {recipes.filter(r => r.category === 'Main Course').length}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Main Courses</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.statNumber, { color: themeColors.text }]}>
              {recipes.filter(r => r.category === 'Desserts').length}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Desserts</Text>
          </View>
        </View>
        
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Quick Actions</Text>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            onPress={() => router.push('../add-recipe-photo')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: themeColors.muted }]}>
              <Camera size={18} color={themeColors.primary} />
            </View>
            <Text style={[styles.actionTitle, { color: themeColors.text }]}>Upload Recipe</Text>
            <Text style={[styles.actionDescription, { color: themeColors.textSecondary }]}>
              Take a photo or upload from gallery
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            onPress={() => router.push('../add-recipe-url')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: themeColors.muted }]}>
              <Link size={18} color={themeColors.primary} />
            </View>
            <Text style={[styles.actionTitle, { color: themeColors.text }]}>Add Recipe URL</Text>
            <Text style={[styles.actionDescription, { color: themeColors.textSecondary }]}>
              Save a recipe from the web
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            onPress={() => router.push('../upload-bookmarks')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: themeColors.muted }]}>
              <FolderOpen size={18} color={themeColors.primary} />
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
        />
      </ScrollView>
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
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold' as const,
  },
  heroContainer: {
    height: 120,
    borderRadius: Colors.radius,
    overflow: 'hidden',
    marginBottom: 12,
    ...Colors.shadowMd,
  },
  heroImage: {
    width: '100%',
    height: '100%',
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
    color: 'rgba(255, 255, 255, 0.9)',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  statCard: {
    borderRadius: Colors.radius,
    padding: 10,
    alignItems: 'center' as const,
    flex: 1,
    borderWidth: 1,
    ...Colors.shadow,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  actionCard: {
    borderRadius: Colors.radius,
    padding: 8,
    flex: 1,
    borderWidth: 1,
    ...Colors.shadow,
  },
  actionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 5,
  },
  actionTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 8,
    lineHeight: 10,
  },
  mealPlanButton: {
    marginBottom: 20,
  },
});

// Welcome Screen Component
function WelcomeScreen() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // User is authenticated, they'll see the main home screen
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return null;
  }

  return (
    <GradientBackground style={welcomeStyles.container}>
      <View style={welcomeStyles.content}>
        <View style={welcomeStyles.logoContainer}>
          <Image
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/3hcmxxxhnr8aykl1w78r1' }}
            style={welcomeStyles.image}
            resizeMode="cover"
          />
        </View>
        
        <View style={welcomeStyles.textContainer}>
          <Text style={welcomeStyles.title}>Meal Planning Roulette</Text>
          <Text style={welcomeStyles.subtitle}>
            Organize your recipes and create meal plans with a spin of randomness
          </Text>
        </View>
        
        <View style={welcomeStyles.buttonContainer}>
          <Button
            title="Log In"
            onPress={() => router.push('/login')}
            style={welcomeStyles.button}
          />
          <Button
            title="Sign Up"
            onPress={() => router.push('/signup')}
            variant="outline"
            style={welcomeStyles.button}
          />
        </View>
      </View>
    </GradientBackground>
  );
}

const welcomeStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  logoContainer: {
    height: 280,
    width: '100%',
    borderRadius: Colors.radius * 1.5,
    overflow: 'hidden',
    marginTop: 60,
    ...Colors.shadowLg,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  textContainer: {
    marginVertical: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    marginBottom: 40,
  },
  button: {
    marginBottom: 14,
  },
});