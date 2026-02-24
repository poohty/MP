import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import { WalkthroughStep } from '@/hooks/useWalkthrough';
import Colors from '@/constants/colors';
import { useTheme } from '@/hooks/theme-store';
import { Lightbulb } from 'lucide-react-native';

interface WalkthroughModalProps {
  visible: boolean;
  step: WalkthroughStep | null;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

export default function WalkthroughModal({
  visible,
  step,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
}: WalkthroughModalProps) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  if (!step) return null;

  const isLastStep = stepIndex === totalSteps - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      testID="walkthrough-modal"
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.iconRow]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
              <Lightbulb size={22} color={colors.primary} />
            </View>
            <Text style={[styles.stepIndicator, { color: colors.textSecondary }]}>
              {stepIndex + 1} of {totalSteps}
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{step.title}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{step.body}</Text>

          <View style={styles.progressRow}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i <= stepIndex ? colors.primary : colors.border,
                    width: i === stepIndex ? 20 : 8,
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onSkip} style={styles.skipButton} testID="walkthrough-skip">
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onNext}
              style={[styles.nextButton, { backgroundColor: colors.primary }]}
              testID="walkthrough-next"
              activeOpacity={0.8}
            >
              <Text style={[styles.nextText, { color: colors.primaryForeground }]}>
                {isLastStep ? 'Got it!' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicator: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  nextButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  nextText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
