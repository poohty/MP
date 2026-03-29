import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { ChefHat, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useTheme } from '@/hooks/theme-store';
import { ONBOARDING_OPTIONS } from '@/mocks/starter-recipes';

interface OnboardingQuestionnaireProps {
  visible: boolean;
  onComplete: (selectedOptionIds: string[]) => Promise<void>;
}

const MAX_SELECTIONS = 3;

export default function OnboardingQuestionnaire({ visible, onComplete }: OnboardingQuestionnaireProps) {
  const { isDark } = useTheme();
  const theme = isDark ? Colors.dark : Colors.light;
  const [selected, setSelected] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const cuisineOptions = ONBOARDING_OPTIONS.filter(o => o.group === 'cuisine');
  const dietaryOptions = ONBOARDING_OPTIONS.filter(o => o.group === 'dietary');

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const toggleOption = useCallback((id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) {
        return prev.filter(s => s !== id);
      }
      if (prev.length >= MAX_SELECTIONS) {
        triggerShake();
        return prev;
      }
      return [...prev, id];
    });
  }, [triggerShake]);

  const handleSubmit = useCallback(async () => {
    if (selected.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onComplete(selected);
    } catch (e) {
      console.error('[Onboarding] Submit error:', e);
      Alert.alert('Error', 'Something went wrong adding your starter recipes. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [selected, isSubmitting, onComplete]);

  const renderChip = (option: { id: string; label: string }) => {
    const isSelected = selected.includes(option.id);
    return (
      <TouchableOpacity
        key={option.id}
        testID={`onboarding-chip-${option.id}`}
        activeOpacity={0.7}
        onPress={() => toggleOption(option.id)}
        style={[
          styles.chip,
          {
            backgroundColor: isSelected ? theme.primary : theme.surface,
            borderColor: isSelected ? theme.primary : theme.border,
          },
        ]}
      >
        <Text
          style={[
            styles.chipText,
            { color: isSelected ? theme.primaryForeground : theme.text },
          ]}
        >
          {option.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const canSubmit = selected.length > 0 && !isSubmitting;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      testID="onboarding-questionnaire-modal"
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.iconRow}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primary + '18' }]}>
              <ChefHat size={32} color={theme.primary} />
            </View>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>
            Pick what cuisines or dietary styles you enjoy
          </Text>

          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <Text style={[styles.helper, { color: theme.textSecondary }]}>
              Select up to {MAX_SELECTIONS} options
            </Text>
          </Animated.View>

          <Text style={[styles.counterText, { color: theme.textSecondary }]}>
            {selected.length} / {MAX_SELECTIONS} selected
          </Text>

          <Text style={[styles.sectionLabel, { color: theme.text }]}>Cuisines</Text>
          <View style={styles.chipGrid}>
            {cuisineOptions.map(renderChip)}
          </View>

          <Text style={[styles.sectionLabel, { color: theme.text }]}>Dietary Styles</Text>
          <View style={styles.chipGrid}>
            {dietaryOptions.map(renderChip)}
          </View>

          <View style={styles.footerSpacer} />
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <Text style={[styles.footerHelper, { color: theme.textSecondary }]}>
            We'll add a few recipes you can try right away.
          </Text>
          <TouchableOpacity
            testID="onboarding-submit-button"
            activeOpacity={0.8}
            disabled={!canSubmit}
            onPress={handleSubmit}
            style={[
              styles.submitButton,
              { backgroundColor: theme.primary },
              !canSubmit && styles.disabledButton,
            ]}
          >
            {isSubmitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color={theme.primaryForeground} size="small" />
                <Text style={[styles.submitText, { color: theme.primaryForeground }]}>
                  Adding Recipes...
                </Text>
              </View>
            ) : (
              <View style={styles.submitRow}>
                <Sparkles size={18} color={theme.primaryForeground} />
                <Text style={[styles.submitText, { color: theme.primaryForeground }]}>
                  Add Starter Recipes
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 180,
  },
  iconRow: {
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    marginBottom: 8,
    lineHeight: 30,
  },
  helper: {
    fontSize: 15,
    textAlign: 'center' as const,
    marginBottom: 4,
  },
  counterText: {
    fontSize: 13,
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 8,
  },
  chipGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  footerSpacer: {
    height: 20,
  },
  footer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
  },
  footerHelper: {
    fontSize: 13,
    textAlign: 'center' as const,
    marginBottom: 12,
  },
  submitButton: {
    height: 54,
    borderRadius: Colors.radius,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...Colors.shadow,
  },
  submitRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  submitText: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  disabledButton: {
    opacity: 0.4,
  },
});
