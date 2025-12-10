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

const FALLBACK_THUMBNAIL_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="; // 1x1 transparent PNG

export default function RecipeCard({ recipe, onPress, onDelete, onToggleFavorite }: RecipeCardProps) {
  const [imageSource, setImageSource] = React.useState<string | null>(null);

  // Always derive the displayed image from recipe.imageUri, with a fallback
  React.useEffect(() => {
    const uri = (recipe.imageUri ?? '').toString().trim();

    console.log(`[RecipeCard] init image for "${recipe.name}" ->`, uri.slice(0, 80));

    if (uri.length > 0) {
      setImageSource(uri);
    } else {
      setImageSource(FALLBACK_THUMBNAIL_DATA_URI);
    }
  }, [recipe.id, recipe.imageUri, recipe.name]);

  const handleImageLoad = () => {
    console.log(`✅ Image loaded for recipe: ${recipe.name}`);
  };

  const handleImageError = (e: any) => {
    console.log(`❌ Image failed for recipe: ${recipe.name}`);
    console.log('   error:', e?.nativeEvent);
    console.log('   original imageSource:', imageSource);
    // If whatever we tried failed, fall back to the built-in thumbnail
    if (imageSource !== FALLBACK_THUMBNAIL_DATA_URI) {
      setImageSource(FALLBACK_THUMBNAIL_DATA_URI);
    }
  };

  const getCategoryColor = () => {
    switch (recipe.category) {
      case 'Appetizer':
        return Colors.success;
      case 'Breakfast':
        return Colors.primary;
      case 'Salads & Soups':
        return Colors.accent;
      case 'Main Course':
        return Colors.warning;
      case 'Desserts':
        return Colors.error;
      default:
        return Colors.textSecondary;
    }
  };

  const handleDeletePress = async (event: any) => {
    event.stopPropagation();
    if (!onDelete) return;

    Alert.alert(
      'Delete Recipe?',
      `Are you sure you want to delete "${recipe.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await onDelete(recipe);
              if (success) {
                Alert.alert('Recipe Deleted', `"${recipe.name}" has been deleted.`);
              }
            } catch (err) {
              console.error('Error deleting recipe:', err);
              Alert.alert('Error', 'Failed to delete recipe. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleToggleFavorite = async (event: any) => {
    event.stopPropagation();
    if (!onToggleFavorite) return;

    try {
      await onToggleFavorite(recipe);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(recipe)}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageSource || FALLBACK_THUMBNAIL_DATA_URI }}
          style={styles.image}
          resizeMode="cover"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.gradient}
        />

        <View style={styles.actionButtons}>
          {onToggleFavorite && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.favoriteButton,
                recipe.isFavorite && styles.favoriteButtonActive,
              ]}
              onPress={handleToggleFavorite}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              activeOpacity={0.7}
            >
              <Heart
                size={18}
                color={recipe.isFavorite ? Colors.error : '#FFFFFF'}
                fill={recipe.isFavorite ? Colors.error : 'transparent'}
              />
            </TouchableOpacity>
          )}

          {recipe.url && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(event) => {
                event.stopPropagation();
                console.log('Open URL for recipe:', recipe.url);
              }}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              activeOpacity={0.7}
            >
              <ExternalLink size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {onDelete && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDeletePress}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              activeOpacity={0.7}
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
    backgroundColor: '#FFFFFF',
    borderRadius: Colors.radius,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadowMd,
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
  actionButtons: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  favoriteButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  contentContainer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  iconContainer: {
    marginLeft: 8,
  },
});
