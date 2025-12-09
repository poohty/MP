import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useUser } from '@/hooks/user-store';
import { useRecipes } from '@/hooks/recipe-store';
import { useAuth } from '@/hooks/auth-store';
import { Recipe } from '@/types';
import Colors from '@/constants/colors';
import GradientBackground from '@/components/GradientBackground';
import RecipeCard from '@/components/RecipeCard';
import { Download, Plus } from 'lucide-react-native';

export default function FriendCookbookScreen() {
  const { friendUserId } = useLocalSearchParams<{ friendUserId: string }>();
  const { getUserProfile } = useUser();
  const { getRecipesForUser, importRecipeFromFriend, debugSupabaseRecipesForUser } = useRecipes();
  const { user } = useAuth();
  
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

      await debugSupabaseRecipesForUser(friendUserId);
    } catch (error) {
      console.error('Failed to load friend cookbook:', error);
      Alert.alert('Error', 'Failed to load cookbook');
    } finally {
      setIsLoading(false);
    }
  }, [friendUserId, getUserProfile, getRecipesForUser, debugSupabaseRecipesForUser]);

  useEffect(() => {
    loadFriendCookbook();
  }, [loadFriendCookbook]);

  const handleRecipePress = (recipe: Recipe) => {
    router.push({
      pathname: '../recipe-details' as any,
      params: { id: recipe.id, friendUserId },
    });
  };

  const handleImportRecipe = async (recipe: Recipe) => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to import recipes');
      return;
    }

    try {
      const success = await importRecipeFromFriend(recipe, user.id);
      if (success) {
        Alert.alert('Success', `"${recipe.name}" has been added to your cookbook`);
      } else {
        Alert.alert('Info', 'This recipe may already be in your cookbook');
      }
    } catch (error) {
      console.error('Failed to import recipe:', error);
      Alert.alert('Error', 'Failed to import recipe');
    }
  };

  const handleImportAllRecipes = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to import recipes');
      return;
    }

    if (recipes.length === 0) {
      Alert.alert('Info', 'No recipes to import');
      return;
    }

    Alert.alert(
      'Import All Recipes',
      `Import all ${recipes.length} recipes from ${friendProfile?.displayName}'s cookbook?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            let successCount = 0;
            let failCount = 0;

            for (const recipe of recipes) {
              try {
                const success = await importRecipeFromFriend(recipe, user.id);
                if (success) {
                  successCount++;
                } else {
                  failCount++;
                }
              } catch (error) {
                console.error('Failed to import recipe:', error);
                failCount++;
              }
            }

            Alert.alert(
              'Import Complete',
              `Successfully imported ${successCount} recipes${failCount > 0 ? ` (${failCount} skipped)` : ''}`
            );
          },
        },
      ]
    );
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

          {recipes.length > 0 && (
            <TouchableOpacity
              style={styles.importAllButton}
              onPress={handleImportAllRecipes}
            >
              <Download size={20} color={Colors.text} />
              <Text style={styles.importAllButtonText}>Import All Recipes</Text>
            </TouchableOpacity>
          )}
        </View>

        {recipes.length === 0 ? (
          <Text style={styles.emptyText}>
            {friendProfile.displayName} hasn&apos;t added any recipes yet.
          </Text>
        ) : (
          recipes.map((recipe) => (
            <View key={recipe.id} style={styles.recipeContainer}>
              <View style={styles.recipeCardWrapper}>
                <RecipeCard
                  recipe={recipe}
                  onPress={handleRecipePress}
                />
              </View>
              <TouchableOpacity
                style={styles.importButton}
                onPress={() => handleImportRecipe(recipe)}
              >
                <Plus size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>
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
  importAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
  },
  importAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  recipeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  recipeCardWrapper: {
    flex: 1,
  },
  importButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
