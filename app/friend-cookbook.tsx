import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useUser } from '@/hooks/user-store';
import { useRecipes } from '@/hooks/recipe-store';
import { Recipe } from '@/types';
import Colors from '@/constants/colors';
import GradientBackground from '@/components/GradientBackground';
import RecipeCard from '@/components/RecipeCard';

export default function FriendCookbookScreen() {
  const { friendUserId } = useLocalSearchParams<{ friendUserId: string }>();
  const { getUserProfile } = useUser();
  const { getRecipesForUser } = useRecipes();
  
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFriendCookbook = useCallback(async () => {
    if (!friendUserId) {
      Alert.alert('Error', 'Friend not specified');
      router.back();
      return;
    }

    setIsLoading(true);
    try {
      const profile = await getUserProfile(friendUserId);
      if (!profile) {
        Alert.alert('Error', 'Friend not found');
        router.back();
        return;
      }

      setFriendProfile(profile);

      if (!profile.shareCookbookWithFriends) {
        setRecipes([]);
        return;
      }

      const friendRecipes = await getRecipesForUser(friendUserId);
      setRecipes(friendRecipes);
    } catch (error) {
      console.error('Failed to load friend cookbook:', error);
      Alert.alert('Error', 'Failed to load cookbook');
    } finally {
      setIsLoading(false);
    }
  }, [friendUserId, getUserProfile, getRecipesForUser]);

  useEffect(() => {
    loadFriendCookbook();
  }, [loadFriendCookbook]);

  const handleRecipePress = (recipe: Recipe) => {
    router.push({
      pathname: '../recipe-details' as any,
      params: { id: recipe.id, friendUserId },
    });
  };

  if (isLoading) {
    return (
      <GradientBackground>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </GradientBackground>
    );
  }

  if (!friendProfile) {
    return (
      <GradientBackground>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Friend not found</Text>
        </View>
      </GradientBackground>
    );
  }

  if (!friendProfile.shareCookbookWithFriends) {
    return (
      <GradientBackground>
        <View style={styles.centerContainer}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {friendProfile.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.friendName}>{friendProfile.displayName}</Text>
          <Text style={styles.emptyText}>
            This user does not share their cookbook with friends.
          </Text>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {friendProfile.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.friendName}>{friendProfile.displayName}&apos;s Cookbook</Text>
          <Text style={styles.recipeCount}>{recipes.length} recipes</Text>
        </View>

        {recipes.length === 0 ? (
          <Text style={styles.emptyText}>
            {friendProfile.displayName} hasn&apos;t added any recipes yet.
          </Text>
        ) : (
          recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onPress={handleRecipePress}
            />
          ))
        )}
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
  },
  friendName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  recipeCount: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    padding: 24,
  },
});
