import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type TutorialStep = { title: string; body: string };

export const TUTORIAL_PENDING = 'mealplanner_tutorial_pending';
export const TUTORIAL_DONE_MAP = 'mealplanner_tutorial_done_map';

type DoneMap = Record<string, true>;

const MAIN_SCREEN_KEYS = ['home', 'recipe-book', 'meal-plans', 'friends', 'profile'] as const;

type UseTutorialReturn = {
  visible: boolean;
  title: string;
  body: string;
  onOk: () => void;
  onClose: () => void;
};

export function useTutorial(screenKey: string, steps: TutorialStep[]): UseTutorialReturn {
  const [eligible, setEligible] = useState<boolean>(false);
  const [doneMap, setDoneMap] = useState<DoneMap>({});
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  const safeSteps = useMemo(() => steps ?? [], [steps]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const pending = await AsyncStorage.getItem(TUTORIAL_PENDING);
        const pendingOn = pending === '1';

        const raw = await AsyncStorage.getItem(TUTORIAL_DONE_MAP);
        let parsed: DoneMap = {};
        if (raw) {
          try {
            parsed = JSON.parse(raw) as DoneMap;
          } catch (e) {
            console.error('❌ Failed to parse tutorial done map, resetting:', e);
            parsed = {};
          }
        }

        if (cancelled) return;
        setEligible(pendingOn);
        setDoneMap(parsed);
        setStepIndex(0);
        setHasLoaded(true);
      } catch (e) {
        console.error('❌ Tutorial load error:', e);
        if (cancelled) return;
        setEligible(false);
        setDoneMap({});
        setStepIndex(0);
        setHasLoaded(true);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [screenKey]);

  const persistDoneMap = useCallback(async (nextMap: DoneMap) => {
    try {
      await AsyncStorage.setItem(TUTORIAL_DONE_MAP, JSON.stringify(nextMap));
    } catch (e) {
      console.error('❌ Failed to persist tutorial done map:', e);
    }
  }, []);

  const clearPendingIfComplete = useCallback(async (nextMap: DoneMap) => {
    try {
      const allDone = MAIN_SCREEN_KEYS.every((k) => nextMap[k] === true);
      if (allDone) {
        await AsyncStorage.setItem(TUTORIAL_PENDING, '0');
        setEligible(false);
      }
    } catch (e) {
      console.error('❌ Failed to clear tutorial pending flag:', e);
    }
  }, []);

  const markScreenDone = useCallback(async () => {
    const nextMap: DoneMap = { ...doneMap, [screenKey]: true };
    setDoneMap(nextMap);
    await persistDoneMap(nextMap);
    await clearPendingIfComplete(nextMap);
  }, [clearPendingIfComplete, doneMap, persistDoneMap, screenKey]);

  const visible = useMemo(() => {
    if (!hasLoaded) return false;
    if (!eligible) return false;
    if (doneMap[screenKey]) return false;
    if (safeSteps.length === 0) return false;
    return true;
  }, [doneMap, eligible, hasLoaded, safeSteps.length, screenKey]);

  const current = useMemo(() => {
    const s = safeSteps[stepIndex];
    return s ?? { title: '', body: '' };
  }, [safeSteps, stepIndex]);

  const onOk = useCallback(() => {
    if (!visible) return;

    const nextIndex = stepIndex + 1;
    if (nextIndex >= safeSteps.length) {
      setStepIndex(0);
      void markScreenDone();
      return;
    }

    setStepIndex(nextIndex);
  }, [markScreenDone, safeSteps.length, stepIndex, visible]);

  const onClose = useCallback(() => {
    onOk();
  }, [onOk]);

  return {
    visible,
    title: current.title,
    body: current.body,
    onOk,
    onClose,
  };
}
