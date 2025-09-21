import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-store';
import { useRecipes } from '@/hooks/recipe-store';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { Camera, Link, FolderOpen } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function HomeScreen() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { recipes } = useRecipes();

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
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.name}>{user?.name || 'Chef'}</Text>
        </View>
        
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=400&auto=format&fit=crop' }}
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
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{recipes.length}</Text>
            <Text style={styles.statLabel}>Recipes</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {recipes.filter(r => r.category === 'Main Course').length}
            </Text>
            <Text style={styles.statLabel}>Main Courses</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {recipes.filter(r => r.category === 'Desserts').length}
            </Text>
            <Text style={styles.statLabel}>Desserts</Text>
          </View>
        </View>
        
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('../add-recipe-photo')}
          >
            <View style={styles.actionIconContainer}>
              <Camera size={24} color={Colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Upload Recipe</Text>
            <Text style={styles.actionDescription}>
              Take a photo or upload from gallery
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('../add-recipe-url')}
          >
            <View style={styles.actionIconContainer}>
              <Link size={24} color={Colors.secondary} />
            </View>
            <Text style={styles.actionTitle}>Add Recipe URL</Text>
            <Text style={styles.actionDescription}>
              Save a recipe from the web
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('../upload-bookmarks')}
          >
            <View style={styles.actionIconContainer}>
              <FolderOpen size={24} color={Colors.accent} />
            </View>
            <Text style={styles.actionTitle}>Upload Bookmarks</Text>
            <Text style={styles.actionDescription}>
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
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  heroContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
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
    padding: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  actionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    width: '48%',
    marginBottom: 8,
    height: 140,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  mealPlanButton: {
    marginBottom: 16,
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
            source={{ uri: 'https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=400&auto=format&fit=crop' }}
            style={welcomeStyles.image}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={welcomeStyles.imageGradient}
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
    padding: 24,
  },
  logoContainer: {
    height: 300,
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 40,
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
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 16,
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
    marginBottom: 16,
  },
});