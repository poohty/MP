import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/auth-store';

export type WalkthroughStep = {
  title: string;
  body: string;
};

function getStorageKey(userId: string, screenKey: string): string {
  return `walkthrough_done_${userId}_${screenKey}`;
}

export function useWalkthrough(screenKey: string, steps: WalkthroughStep[]) {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? 'anon';

  const [isVisible, setIsVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    (async () => {
      try {
        const key = getStorageKey(userId, screenKey);
        const done = await AsyncStorage.getItem(key);
        if (!cancelled) {
          setChecked(true);
          if (done !== 'true') {
            setStepIndex(0);
            setIsVisible(true);
          } else {
            setIsVisible(false);
          }
        }
      } catch (e) {
        console.log('Walkthrough storage read error:', e);
        if (!cancelled) setChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, screenKey]);

  const markDone = useCallback(async () => {
    try {
      const key = getStorageKey(userId, screenKey);
      await AsyncStorage.setItem(key, 'true');
    } catch (e) {
      console.log('Walkthrough storage write error:', e);
    }
  }, [userId, screenKey]);

  const next = useCallback(() => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      setIsVisible(false);
      markDone();
    }
  }, [stepIndex, steps.length, markDone]);

  const skip = useCallback(() => {
    setIsVisible(false);
    markDone();
  }, [markDone]);

  const resetForDebug = useCallback(async () => {
    try {
      const key = getStorageKey(userId, screenKey);
      await AsyncStorage.removeItem(key);
      setStepIndex(0);
      setIsVisible(true);
    } catch (e) {
      console.log('Walkthrough reset error:', e);
    }
  }, [userId, screenKey]);

  const currentStep = steps[stepIndex] ?? null;

  return {
    isVisible: isVisible && checked,
    currentStep,
    stepIndex,
    totalSteps: steps.length,
    next,
    skip,
    resetForDebug,
  };
}
