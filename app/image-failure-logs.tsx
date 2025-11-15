import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Share } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRecipes } from '@/hooks/recipe-store';
import Colors from '@/constants/colors';
import { Download, Trash2, RefreshCw } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

interface ImageFetchFailure {
  recipeUrl: string;
  imageUrl: string;
  httpStatus?: number;
  responseHeaders?: Record<string, string>;
  timeUtc: string;
  userAgentUsed: string;
  refererUsed?: string;
  retryCount: number;
  errorMessage: string;
}

export default function ImageFailureLogsScreen() {
  const insets = useSafeAreaInsets();
  const { getImageFailures, clearImageFailures } = useRecipes();
  const [failures, setFailures] = useState<ImageFetchFailure[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFailures = useCallback(async () => {
    setIsLoading(true);
    try {
      const logs = await getImageFailures();
      setFailures(logs);
      console.log(`📊 Loaded ${logs.length} failure logs`);
    } catch (error) {
      console.error('Failed to load failures:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getImageFailures]);

  useEffect(() => {
    loadFailures();
  }, [loadFailures]);

  const handleDownload = async () => {
    if (failures.length === 0) {
      Alert.alert('No Logs', 'There are no failure logs to download.');
      return;
    }

    const jsonString = JSON.stringify(failures, null, 2);
    
    if (Platform.OS === 'web') {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `image-fetch-failures-${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      Alert.alert('Success', 'Failure logs downloaded successfully.');
    } else {
      try {
        await Share.share({
          message: jsonString,
          title: 'Image Fetch Failure Logs',
        });
      } catch (error) {
        console.error('Share error:', error);
        await Clipboard.setStringAsync(jsonString);
        Alert.alert('Copied to Clipboard', 'Failure logs have been copied to clipboard.');
      }
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all failure logs? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearImageFailures();
            setFailures([]);
            Alert.alert('Success', 'All failure logs cleared.');
          },
        },
      ]
    );
  };

  const getStatusColor = (status?: number) => {
    if (!status) return Colors.textSecondary;
    if (status >= 500) return '#EF4444';
    if (status >= 400) return '#F59E0B';
    if (status >= 300) return '#3B82F6';
    return '#10B981';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen 
        options={{ 
          title: 'Image Failure Logs',
          headerStyle: {
            backgroundColor: Colors.surface,
          },
          headerTintColor: Colors.text,
        }} 
      />
      
      <View style={styles.header}>
        <View style={styles.statsContainer}>
          <Text style={styles.statsLabel}>Total Failures:</Text>
          <Text style={styles.statsValue}>{failures.length}</Text>
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.refreshButton]}
            onPress={loadFailures}
          >
            <RefreshCw size={18} color={Colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.actionButton,
              styles.downloadButton,
              failures.length === 0 && styles.disabledButton,
            ]}
            onPress={handleDownload}
            disabled={failures.length === 0}
          >
            <Download size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Export</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.actionButton,
              styles.clearButton,
              failures.length === 0 && styles.disabledButton,
            ]}
            onPress={handleClear}
            disabled={failures.length === 0}
          >
            <Trash2 size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading logs...</Text>
        </View>
      ) : failures.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No failure logs found.</Text>
          <Text style={styles.emptySubtext}>
            Image fetch failures will be logged here for debugging.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {failures.map((failure, index) => (
            <View key={index} style={styles.failureCard}>
              <View style={styles.failureHeader}>
                <Text style={styles.failureIndex}>#{failures.length - index}</Text>
                <View style={styles.statusBadge}>
                  <Text style={[styles.statusText, { color: getStatusColor(failure.httpStatus) }]}>
                    {failure.httpStatus ? `HTTP ${failure.httpStatus}` : 'Network Error'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.failureRow}>
                <Text style={styles.failureLabel}>Time:</Text>
                <Text style={styles.failureValue}>
                  {new Date(failure.timeUtc).toLocaleString()}
                </Text>
              </View>
              
              <View style={styles.failureRow}>
                <Text style={styles.failureLabel}>Recipe URL:</Text>
                <Text style={styles.failureValue} numberOfLines={1}>
                  {failure.recipeUrl}
                </Text>
              </View>
              
              <View style={styles.failureRow}>
                <Text style={styles.failureLabel}>Image URL:</Text>
                <Text style={styles.failureValue} numberOfLines={2}>
                  {failure.imageUrl}
                </Text>
              </View>
              
              <View style={styles.failureRow}>
                <Text style={styles.failureLabel}>Retries:</Text>
                <Text style={styles.failureValue}>{failure.retryCount}</Text>
              </View>
              
              <View style={styles.failureRow}>
                <Text style={styles.failureLabel}>User-Agent:</Text>
                <Text style={styles.failureValue} numberOfLines={2}>
                  {failure.userAgentUsed}
                </Text>
              </View>
              
              {failure.refererUsed && (
                <View style={styles.failureRow}>
                  <Text style={styles.failureLabel}>Referer:</Text>
                  <Text style={styles.failureValue} numberOfLines={1}>
                    {failure.refererUsed}
                  </Text>
                </View>
              )}
              
              <View style={styles.failureRow}>
                <Text style={styles.failureLabel}>Error:</Text>
                <Text style={styles.errorText}>{failure.errorMessage}</Text>
              </View>
              
              {failure.responseHeaders && Object.keys(failure.responseHeaders).length > 0 && (
                <View style={styles.headersSection}>
                  <Text style={styles.headersTitle}>Response Headers:</Text>
                  {Object.entries(failure.responseHeaders).slice(0, 5).map(([key, value]) => (
                    <Text key={key} style={styles.headerText} numberOfLines={1}>
                      {key}: {value}
                    </Text>
                  ))}
                  {Object.keys(failure.responseHeaders).length > 5 && (
                    <Text style={styles.headerText}>
                      ... and {Object.keys(failure.responseHeaders).length - 5} more
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginRight: 8,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  refreshButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  downloadButton: {
    backgroundColor: Colors.primary,
    flex: 1,
  },
  clearButton: {
    backgroundColor: '#EF4444',
    flex: 1,
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  failureCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  failureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  failureIndex: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.background,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  failureRow: {
    marginBottom: 8,
  },
  failureLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontWeight: '600' as const,
  },
  failureValue: {
    fontSize: 14,
    color: Colors.text,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500' as const,
  },
  headersSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  headersTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  headerText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    marginBottom: 2,
  },
});
