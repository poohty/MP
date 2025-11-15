import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { useRecipes } from '@/hooks/recipe-store';
import Colors from '@/constants/colors';
import GradientBackground from '@/components/GradientBackground';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react-native';
import { Recipe } from '@/types';

type ImageStatus = 'loading' | 'success' | 'failed' | 'invalid';

interface RecipeImageInfo {
  recipe: Recipe;
  status: ImageStatus;
  imageUri?: string;
  errorMessage?: string;
}

export default function ImageDiagnosticsScreen() {
  const { recipes } = useRecipes();
  const [recipeImageInfos, setRecipeImageInfos] = useState<RecipeImageInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const testImageLoad = async (uri: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(uri, { 
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
          return { success: true };
        } else {
          return { 
            success: false, 
            error: `Invalid content-type: ${contentType || 'missing'}` 
          };
        }
      }
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request timeout (3s)' };
      }
      if (error.message?.includes('CORS')) {
        return { success: false, error: 'CORS policy blocked' };
      }
      if (error.message?.includes('Network')) {
        return { success: false, error: 'Network connection failed' };
      }
      return { 
        success: false, 
        error: error.message || 'Unknown error' 
      };
    }
  };

  const scanRecipes = async () => {
    setIsScanning(true);
    const infos: RecipeImageInfo[] = [];

    for (const recipe of recipes) {
      console.log(`🔍 Scanning recipe: "${recipe.name}"`);
      
      if (!recipe.imageUri) {
        infos.push({
          recipe,
          status: 'invalid',
          errorMessage: 'No imageUri property'
        });
        continue;
      }

      const trimmedUri = recipe.imageUri.trim();
      
      if (trimmedUri === 'null' || trimmedUri === 'undefined' || trimmedUri === '[object Object]') {
        infos.push({
          recipe,
          status: 'invalid',
          imageUri: recipe.imageUri,
          errorMessage: `Invalid string value: "${trimmedUri}"`
        });
        continue;
      }

      if (trimmedUri.length < 10) {
        infos.push({
          recipe,
          status: 'invalid',
          imageUri: recipe.imageUri,
          errorMessage: `String too short: ${trimmedUri.length} chars`
        });
        continue;
      }

      if (!trimmedUri.startsWith('http://') && !trimmedUri.startsWith('https://') && !trimmedUri.startsWith('data:')) {
        infos.push({
          recipe,
          status: 'invalid',
          imageUri: recipe.imageUri,
          errorMessage: `Not a valid URL (missing http:// or https://)`
        });
        continue;
      }

      // Try to load the image
      const result = await testImageLoad(trimmedUri);
      
      if (result.success) {
        infos.push({
          recipe,
          status: 'success',
          imageUri: trimmedUri
        });
      } else {
        infos.push({
          recipe,
          status: 'failed',
          imageUri: trimmedUri,
          errorMessage: result.error || 'Unknown error loading image'
        });
      }
    }

    setRecipeImageInfos(infos);
    setIsScanning(false);
  };

  useEffect(() => {
    scanRecipes();
  }, [recipes]);

  const handleReExtract = (recipe: Recipe) => {
    Alert.alert(
      'Re-Extract Image',
      `Do you want to force re-extract the image for "${recipe.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-Extract',
          onPress: () => {
            Alert.alert('Coming Soon', 'Individual recipe re-extraction will be available soon. For now, use the "Force Re-Extract ALL" button in the Debug menu on the Cook Book screen.');
          }
        }
      ]
    );
  };

  const successCount = recipeImageInfos.filter(info => info.status === 'success').length;
  const failedCount = recipeImageInfos.filter(info => info.status === 'failed').length;
  const invalidCount = recipeImageInfos.filter(info => info.status === 'invalid').length;

  const getStatusIcon = (status: ImageStatus) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={20} color={Colors.success} />;
      case 'failed':
        return <XCircle size={20} color={Colors.error} />;
      case 'invalid':
        return <AlertCircle size={20} color={Colors.accent} />;
      default:
        return <RefreshCw size={20} color={Colors.textSecondary} />;
    }
  };

  const getStatusColor = (status: ImageStatus) => {
    switch (status) {
      case 'success':
        return Colors.success;
      case 'failed':
        return Colors.error;
      case 'invalid':
        return Colors.accent;
      default:
        return Colors.textSecondary;
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Image Diagnostics', headerBackTitle: 'Back' }} />
      <GradientBackground>
        <ScrollView style={styles.container}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Image Status Summary</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <CheckCircle size={24} color={Colors.success} />
                <Text style={styles.summaryLabel}>Working</Text>
                <Text style={styles.summaryValue}>{successCount}</Text>
              </View>
              <View style={styles.summaryItem}>
                <XCircle size={24} color={Colors.error} />
                <Text style={styles.summaryLabel}>Failed</Text>
                <Text style={styles.summaryValue}>{failedCount}</Text>
              </View>
              <View style={styles.summaryItem}>
                <AlertCircle size={24} color={Colors.accent} />
                <Text style={styles.summaryLabel}>Invalid</Text>
                <Text style={styles.summaryValue}>{invalidCount}</Text>
              </View>
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.refreshButton, styles.halfButton]}
                onPress={scanRecipes}
                disabled={isScanning}
              >
                <RefreshCw size={16} color={Colors.text} />
                <Text style={styles.refreshButtonText}>
                  {isScanning ? 'Scanning...' : 'Re-Scan'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.logsButton, styles.halfButton]}
                onPress={() => router.push('/image-failure-logs')}
              >
                <FileText size={16} color="#fff" />
                <Text style={styles.logsButtonText}>View Logs</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Recipe Details</Text>

          {recipeImageInfos.map((info, index) => (
            <View key={info.recipe.id} style={styles.recipeCard}>
              <View style={styles.recipeHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipeName} numberOfLines={1}>
                    {index + 1}. {info.recipe.name}
                  </Text>
                  <Text style={styles.recipeCategory}>{info.recipe.category}</Text>
                </View>
                {getStatusIcon(info.status)}
              </View>

              {info.imageUri && (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: info.imageUri }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                    onError={() => console.log(`Preview failed for ${info.recipe.name}`)}
                  />
                </View>
              )}

              <View style={styles.detailsContainer}>
                <Text style={[styles.statusText, { color: getStatusColor(info.status) }]}>
                  Status: {info.status.toUpperCase()}
                </Text>
                
                {info.imageUri && (
                  <View style={styles.uriContainer}>
                    <Text style={styles.uriLabel}>Image URI:</Text>
                    <Text style={styles.uriText} numberOfLines={3} ellipsizeMode="tail">
                      {info.imageUri}
                    </Text>
                  </View>
                )}

                {info.errorMessage && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorLabel}>Error:</Text>
                    <Text style={styles.errorText}>{info.errorMessage}</Text>
                  </View>
                )}

                {info.status !== 'success' && (
                  <TouchableOpacity
                    style={styles.reExtractButton}
                    onPress={() => handleReExtract(info.recipe)}
                  >
                    <Text style={styles.reExtractButtonText}>Re-Extract Image</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      </GradientBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  summaryCard: {
    margin: 16,
    padding: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfButton: {
    flex: 1,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  logsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  logsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  refreshButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  recipeCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  recipeCategory: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  imagePreviewContainer: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: Colors.cardBackground,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  detailsContainer: {
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  uriContainer: {
    backgroundColor: Colors.cardBackground,
    padding: 8,
    borderRadius: 6,
  },
  uriLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  uriText: {
    fontSize: 10,
    color: Colors.text,
    fontFamily: 'monospace',
  },
  errorContainer: {
    backgroundColor: Colors.error + '20',
    padding: 8,
    borderRadius: 6,
  },
  errorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
  },
  reExtractButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  reExtractButtonText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
