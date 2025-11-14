import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert } from 'react-native';
import { Recipe } from '@/types';
import Colors from '@/constants/colors';
import { Link, ExternalLink, Trash2, Heart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface RecipeCardProps {
  recipe: Recipe;
  onPress: (recipe: Recipe) => void;
  onDelete?: (recipe: Recipe) => Promise<boolean>;
  onToggleFavorite?: (recipe: Recipe) => Promise<boolean>;
}

export default function RecipeCard({ recipe, onPress, onDelete, onToggleFavorite }: RecipeCardProps) {
  const [imageSource, setImageSource] = React.useState<string>('');
  const [imageKey, setImageKey] = React.useState(0);
  
  const getStableFallbackImage = React.useCallback(() => {
    const cleanName = recipe.name
      .replace(/recipe/gi, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(' ')
      .slice(0, 3)
      .join(' ');
    
    const stableId = recipe.id.slice(-6);
    const searchTerm = encodeURIComponent(cleanName);
    return `https://source.unsplash.com/featured/400x300/?${searchTerm},food,recipe&sig=${stableId}`;
  }, [recipe.id, recipe.name]);
  
  React.useEffect(() => {
    const loadImage = async () => {
      console.log(`🔍 [RecipeCard] Loading image for "${recipe.name}"`);
      console.log(`   imageUri value: ${recipe.imageUri}`);
      console.log(`   imageUri type: ${typeof recipe.imageUri}`);
      console.log(`   imageUri length: ${recipe.imageUri?.length || 0}`);
      
      // STRICT validation - must be a valid HTTP/HTTPS URL
      if (recipe.imageUri && 
          typeof recipe.imageUri === 'string' && 
          recipe.imageUri.trim().length > 10) {
        const trimmedUri = recipe.imageUri.trim();
        
        // Additional validation for common invalid values
        if (trimmedUri === 'null' || 
            trimmedUri === 'undefined' || 
            trimmedUri === '[object Object]' ||
            trimmedUri.startsWith('data:') === false && 
            trimmedUri.startsWith('http://') === false && 
            trimmedUri.startsWith('https://') === false) {
          console.log(`⚠️ Recipe "${recipe.name}" has INVALID imageUri format: ${trimmedUri.substring(0, 50)}`);
          const fallback = getStableFallbackImage();
          setImageSource(fallback);
          return;
        }
        
        if (trimmedUri.startsWith('http://') || trimmedUri.startsWith('https://')) {
          console.log(`✅ Recipe "${recipe.name}" HAS VALID imageUri: ${trimmedUri.substring(0, 100)}...`);
          setImageSource(trimmedUri);
          setImageKey(prev => prev + 1); // Force re-render
          return;
        } else {
          console.log(`⚠️ Recipe "${recipe.name}" has imageUri but not HTTP/HTTPS: ${trimmedUri.substring(0, 50)}`);
        }
      } else {
        console.log(`⚠️ Recipe "${recipe.name}" has NO valid imageUri (empty, null, or too short)`);
      }
      
      const fallback = getStableFallbackImage();
      console.log(`📸 Using fallback image for "${recipe.name}": ${fallback.substring(0, 80)}...`);
      setImageSource(fallback);
      setImageKey(prev => prev + 1); // Force re-render
    };
    
    loadImage();
  }, [recipe.id, recipe.name, recipe.imageUri, getStableFallbackImage]);
  
  const handleImageLoad = () => {
    console.log(`✅ Image loaded successfully for: ${recipe.name}`);
  };
  
  const handleImageError = (e: any) => {
    console.log(`❌ Image failed to load for recipe: ${recipe.name}`);
    console.log(`   Image URI: ${imageSource}`);
    console.log(`   Error details:`, e?.nativeEvent);
    console.log(`   Original recipe.imageUri: ${recipe.imageUri}`);
    console.log(`   Switching to fallback image`);
    
    const fallback = getStableFallbackImage();
    console.log(`📸 Using fallback after error for "${recipe.name}": ${fallback.substring(0, 80)}...`);
    
    if (imageSource !== fallback) {
      setImageSource(fallback);
      setImageKey(prev => prev + 1);
    } else {
      console.log(`⚠️ Already using fallback, forcing re-render with new key`);
      setImageKey(prev => prev + 1);
    }
  };
  

  
  const getCategoryColor = () => {
    switch (recipe.category) {
      case 'Appetizer':
        return Colors.success;
      case 'Salads & Soups':
        return Colors.primary;
      case 'Main Course':
        return Colors.secondary;
      case 'Desserts':
        return Colors.accent;
      default:
        return Colors.primary;
    }
  };

  const handleDelete = async (event: any) => {
    event.stopPropagation();
    
    if (!onDelete) {
      Alert.alert('Error', 'Delete function not available');
      return;
    }

    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${recipe.name}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              const success = await onDelete(recipe);
              
              if (success) {
                Alert.alert(
                  'Recipe Deleted! ✅',
                  `"${recipe.name}" has been deleted successfully!`,
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert(
                  'Delete Failed',
                  'Failed to delete the recipe. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Error during delete operation:', error);
              Alert.alert(
                'Delete Error',
                'An error occurred while deleting the recipe.',
                [{ text: 'OK' }]
              );
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleToggleFavorite = async (event: any) => {
    event.stopPropagation();
    
    if (!onToggleFavorite) {
      return;
    }

    try {
      await onToggleFavorite(recipe);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(recipe)}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        {imageSource && imageSource.length > 10 ? (
          <Image
            key={`${recipe.id}-${imageKey}`}
            source={{ 
              uri: imageSource, 
              cache: 'reload' 
            }}
            style={styles.image}
            resizeMode="cover"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <View style={[styles.image, { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>No Image</Text>
          </View>
        )}
        

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.gradient}
        />
        <View style={styles.actionButtons}>
          {onToggleFavorite && (
            <TouchableOpacity
              style={[styles.actionButton, styles.favoriteButton, recipe.isFavorite && styles.favoriteButtonActive]}
              onPress={handleToggleFavorite}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              activeOpacity={0.7}
              testID={`favorite-recipe-${recipe.id}`}
            >
              <Heart 
                size={18} 
                color={recipe.isFavorite ? Colors.error : "#FFFFFF"} 
                fill={recipe.isFavorite ? Colors.error : "transparent"}
              />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              activeOpacity={0.7}
              testID={`delete-recipe-${recipe.id}`}
            >
              <Trash2 size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {recipe.name}
        </Text>
        
        <View style={styles.footer}>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor() }]}>
            <Text style={styles.categoryText}>{recipe.category}</Text>
          </View>
          
          {recipe.url && (
            <View style={styles.iconContainer}>
              <ExternalLink size={16} color={Colors.textSecondary} />
            </View>
          )}
          
          {recipe.content && (
            <View style={styles.iconContainer}>
              <Link size={16} color={Colors.textSecondary} />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  imageContainer: {
    height: 160,
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  categoryText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  iconContainer: {
    marginRight: 8,
  },
  actionButtons: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  favoriteButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  favoriteButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
});