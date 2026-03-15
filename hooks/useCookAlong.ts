import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { getBackendBaseUrl } from '@/lib/trpc';
import { resolveVoiceId, type VoicePreference } from '@/constants/voice';

const RECORD_DURATION_MS = 3000;
const INTRO_TEXT = "Let's start with step one.";

type VoiceCommand = 'STEP_COMPLETE' | 'REPEAT_STEP' | 'NONE';

interface CookAlongState {
  cookAlongActive: boolean;
  currentStepIndex: number;
  isListening: boolean;
  isSpeaking: boolean;
  lastTranscript: string;
}

async function fetchTTSAudio(text: string, voiceId: string): Promise<string> {
  const apiBase = getBackendBaseUrl();
  if (!apiBase) {
    console.log('[CookAlong] TTS: no API base URL found. EXPO_PUBLIC_RORK_API_BASE_URL may not be set.');
    throw new Error('Backend not configured');
  }

  const ttsUrl = `${apiBase}/voice/tts`;
  console.log('[CookAlong] TTS request ->', ttsUrl, '| voiceId:', voiceId, '| text length:', text.length);

  const response = await fetch(ttsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const errText = await response.text();
    const isHtml = contentType.includes('text/html') || errText.trimStart().startsWith('<');
    if (isHtml) {
      console.log('[CookAlong] TTS returned HTML (not JSON) - likely wrong URL or backend not deployed. Status:', response.status);
      console.log('[CookAlong] TTS URL was:', ttsUrl);
      throw new Error('Voice server unreachable. The backend URL may be incorrect.');
    }
    console.log('[CookAlong] TTS error:', response.status, errText.substring(0, 500));
    throw new Error(`TTS failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  return `data:audio/mpeg;base64,${base64}`;
}

async function playAudioUri(uri: string, soundRef: React.MutableRefObject<Audio.Sound | null>): Promise<void> {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    playThroughEarpieceAndroid: false,
    shouldDuckAndroid: false,
  });

  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true, volume: 1.0 }
  );
  soundRef.current = sound;

  return new Promise<void>((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (soundRef.current === sound) {
          soundRef.current = null;
        }
        resolve();
      }
    });
  });
}

async function speakText(text: string, soundRef: React.MutableRefObject<Audio.Sound | null>, voiceId: string): Promise<void> {
  const uri = await fetchTTSAudio(text, voiceId);
  await playAudioUri(uri, soundRef);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function listenForCommand(
  recordingRef: React.MutableRefObject<Audio.Recording | null>,
  activeRef: React.MutableRefObject<boolean>
): Promise<{ command: VoiceCommand; transcript: string }> {
  const apiBase = getBackendBaseUrl();
  if (!apiBase) {
    console.log('[CookAlong] STT: no API base URL found');
    throw new Error('Backend not configured');
  }

  if (Platform.OS !== 'web') {
    const permResult = await Audio.requestPermissionsAsync();
    if (!permResult.granted) {
      throw new Error('Microphone permission denied');
    }
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  recordingRef.current = recording;

  console.log('[CookAlong] Recording started...');

  await new Promise<void>((resolve) => setTimeout(resolve, RECORD_DURATION_MS));

  if (!activeRef.current) {
    try {
      await recording.stopAndUnloadAsync();
    } catch {}
    recordingRef.current = null;
    return { command: 'NONE', transcript: '' };
  }

  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  const uri = recording.getURI();
  recordingRef.current = null;

  if (!uri) {
    console.log('[CookAlong] No recording URI');
    return { command: 'NONE', transcript: '' };
  }

  console.log('[CookAlong] Recording stopped, URI:', uri);

  const formData = new FormData();

  if (Platform.OS === 'web') {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    formData.append('audio', blob, 'recording.webm');
  } else {
    formData.append('audio', {
      uri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);
  }

  formData.append('keyterms', 'step complete,repeat step');

  const response = await fetch(`${apiBase}/voice/stt`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.log('[CookAlong] STT error:', response.status, errText);
    throw new Error(`STT failed: ${response.status}`);
  }

  const result = await response.json() as { transcript: string; command: VoiceCommand };
  console.log('[CookAlong] STT result:', result);
  return { command: result.command, transcript: result.transcript };
}

export function useCookAlong(instructions: string[], voicePreference?: VoicePreference | null, onAllStepsComplete?: () => void) {
  const onAllStepsCompleteRef = useRef(onAllStepsComplete);
  onAllStepsCompleteRef.current = onAllStepsComplete;
  const [state, setState] = useState<CookAlongState>({
    cookAlongActive: false,
    currentStepIndex: 0,
    isListening: false,
    isSpeaking: false,
    lastTranscript: '',
  });

  const activeRef = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const loopRunningRef = useRef(false);
  const resolvedVoiceId = resolveVoiceId(voicePreference);

  const cleanup = useCallback(async () => {
    activeRef.current = false;
    loopRunningRef.current = false;

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }

    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      cookAlongActive: false,
      isListening: false,
      isSpeaking: false,
    }));
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      loopRunningRef.current = false;
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  const safeSpeakText = useCallback(async (text: string) => {
    if (!activeRef.current) return;
    setState((prev) => ({ ...prev, isSpeaking: true }));
    try {
      await speakText(text, soundRef, resolvedVoiceId);
    } catch (e) {
      console.log('[CookAlong] Speak error:', e);
    } finally {
      setState((prev) => ({ ...prev, isSpeaking: false }));
    }
  }, [resolvedVoiceId]);

  const safeListenForCommand = useCallback(async (): Promise<{ command: VoiceCommand; transcript: string }> => {
    if (!activeRef.current) return { command: 'NONE', transcript: '' };
    setState((prev) => ({ ...prev, isListening: true }));
    try {
      const result = await listenForCommand(recordingRef, activeRef);
      setState((prev) => ({ ...prev, lastTranscript: result.transcript }));
      return result;
    } catch (e) {
      console.log('[CookAlong] Listen error:', e);
      return { command: 'NONE', transcript: '' };
    } finally {
      setState((prev) => ({ ...prev, isListening: false }));
    }
  }, []);

  const runCookAlongLoop = useCallback(async (startIndex: number, preloadedIntroUri?: string, preloadedStep1Uri?: string) => {
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;

    let stepIdx = startIndex;
    const reminderLine = "Say 'Step Complete' for the next step, or 'Repeat Step' to hear this step again.";
    const finalStepReminder = "Say 'Step Complete' once you are done and I will clear the check marks of this recipe. Or say 'Repeat Step' to hear this step again.";

    try {
      const loopStartTime = Date.now();
      let introUri = preloadedIntroUri;
      let step1Uri = preloadedStep1Uri;

      if (!introUri || !step1Uri) {
        console.log('[CookAlong] Loop: fetching missing audio (intro:', !introUri, 'step1:', !step1Uri, ')');
        const fetches: Promise<string>[] = [];
        const fetchKeys: string[] = [];
        if (!introUri) { fetches.push(fetchTTSAudio(INTRO_TEXT, resolvedVoiceId)); fetchKeys.push('intro'); }
        if (!step1Uri) { fetches.push(fetchTTSAudio(instructions[stepIdx] || 'No instruction available.', resolvedVoiceId)); fetchKeys.push('step1'); }
        const results = await Promise.all(fetches);
        fetchKeys.forEach((key, i) => {
          if (key === 'intro') introUri = results[i];
          if (key === 'step1') step1Uri = results[i];
        });
      }

      console.log('[CookAlong] Audio ready, time since loop start:', Date.now() - loopStartTime, 'ms');

      if (!activeRef.current) return;

      setState((prev) => ({ ...prev, isSpeaking: true }));
      console.log('[CookAlong] Starting intro playback at', Date.now() - loopStartTime, 'ms');
      try {
        await playAudioUri(introUri!, soundRef);
      } catch (e) {
        console.log('[CookAlong] Intro speak error:', e);
      }
      setState((prev) => ({ ...prev, isSpeaking: false }));

      if (!activeRef.current) return;

      console.log('[CookAlong] Intro finished, starting step 1 after brief pause');

      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      if (!activeRef.current) return;

      setState((prev) => ({ ...prev, isSpeaking: true }));
      try {
        await playAudioUri(step1Uri!, soundRef);
      } catch (e) {
        console.log('[CookAlong] Step 1 speak error:', e);
      }
      setState((prev) => ({ ...prev, isSpeaking: false }));

      console.log('[CookAlong] Step 1 playback done, total from loop start:', Date.now() - loopStartTime, 'ms');

      if (!activeRef.current) return;

      await safeSpeakText(reminderLine);

      while (activeRef.current && stepIdx < instructions.length) {
        if (!activeRef.current) break;

        const { command } = await safeListenForCommand();

        if (!activeRef.current) break;

        if (command === 'REPEAT_STEP') {
          await safeSpeakText(instructions[stepIdx] || '');
          if (!activeRef.current) break;
          if (stepIdx >= instructions.length - 1) {
            await safeSpeakText(finalStepReminder);
          } else {
            await safeSpeakText(reminderLine);
          }
        } else if (command === 'STEP_COMPLETE') {
          setState((prev) => ({ ...prev, currentStepIndex: stepIdx }));

          if (stepIdx >= instructions.length - 1) {
            console.log('[CookAlong] Final step complete, clearing checkmarks');
            if (onAllStepsCompleteRef.current) {
              onAllStepsCompleteRef.current();
            }
            await safeSpeakText("Awesome, all checkmarks cleared. Hope you enjoy your meal!");
            activeRef.current = false;
            setState((prev) => ({
              ...prev,
              cookAlongActive: false,
              isListening: false,
              isSpeaking: false,
            }));
            break;
          } else {
            stepIdx += 1;
            setState((prev) => ({ ...prev, currentStepIndex: stepIdx }));
            if (stepIdx >= instructions.length - 1) {
              await safeSpeakText(`Step ${stepIdx + 1}. ${instructions[stepIdx] || ''}`);
              if (!activeRef.current) break;
              await safeSpeakText(finalStepReminder);
            } else {
              await safeSpeakText(`Step ${stepIdx + 1}. ${instructions[stepIdx] || ''}`);
              if (!activeRef.current) break;
              await safeSpeakText(reminderLine);
            }
          }
        } else {
          await safeSpeakText(
            "I didn't catch that. Please say 'Step Complete' or 'Repeat Step'."
          );
        }
      }
    } catch (e) {
      console.log('[CookAlong] Loop error:', e);
    } finally {
      loopRunningRef.current = false;
    }
  }, [instructions, resolvedVoiceId, safeSpeakText, safeListenForCommand]);

  const startCookAlong = useCallback(async () => {
    const tapTime = Date.now();
    console.log('[CookAlong] === MIC TAP ===', new Date(tapTime).toISOString());

    const apiBase = getBackendBaseUrl();
    console.log('[CookAlong] backend base:', apiBase);
    if (!apiBase) {
      Alert.alert(
        'Voice feature unavailable',
        'Could not determine backend URL. Please check your environment configuration.'
      );
      return;
    }

    if (instructions.length === 0) {
      Alert.alert('No Instructions', 'This recipe has no instructions to read aloud.');
      return;
    }

    const step1Text = instructions[0] || 'No instruction available.';

    console.log('[CookAlong] Starting parallel: health check + permissions + TTS fetch');

    const healthUrl = `${apiBase}/voice/health`;
    console.log('[CookAlong] Health check URL:', healthUrl);
    const healthPromise = fetch(healthUrl, { method: 'GET' })
      .then(async r => {
        console.log('[CookAlong] Health check status:', r.status, 'in', Date.now() - tapTime, 'ms');
        if (!r.ok) {
          const body = await r.text().catch(() => '');
          if (body.trimStart().startsWith('<')) {
            console.error('[CookAlong] Health check returned HTML — wrong backend URL:', healthUrl);
          }
          return false;
        }
        const contentType = r.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          console.error('[CookAlong] Health check returned non-JSON content-type:', contentType, '— wrong backend URL:', healthUrl);
          return false;
        }
        return true;
      })
      .catch((e) => {
        console.error('[CookAlong] Health check failed:', e);
        return false;
      });

    const permPromise = Platform.OS !== 'web'
      ? Audio.requestPermissionsAsync().then(r => {
          console.log('[CookAlong] Permission done in', Date.now() - tapTime, 'ms, granted:', r.granted);
          return r.granted;
        })
      : Promise.resolve(true);

    const introTTSPromise = fetchTTSAudio(INTRO_TEXT, resolvedVoiceId)
      .then(uri => {
        console.log('[CookAlong] Intro TTS done in', Date.now() - tapTime, 'ms');
        return uri;
      })
      .catch((e) => {
        console.log('[CookAlong] Intro TTS failed:', e);
        return null;
      });

    const step1TTSPromise = fetchTTSAudio(step1Text, resolvedVoiceId)
      .then(uri => {
        console.log('[CookAlong] Step1 TTS done in', Date.now() - tapTime, 'ms');
        return uri;
      })
      .catch((e) => {
        console.log('[CookAlong] Step1 TTS failed:', e);
        return null;
      });

    const [healthOk, permGranted, introUri, step1Uri] = await Promise.all([
      healthPromise,
      permPromise,
      introTTSPromise,
      step1TTSPromise,
    ]);

    console.log('[CookAlong] All parallel tasks done in', Date.now() - tapTime, 'ms');

    if (!healthOk) {
      Alert.alert(
        'Voice feature unavailable',
        `Voice server not responding.\nBackend: ${apiBase}\nPlease try again later.`
      );
      return;
    }

    if (!permGranted) {
      Alert.alert('Permission Required', 'Microphone access is needed for hands-free cooking.');
      return;
    }

    if (!introUri || !step1Uri) {
      Alert.alert('Voice feature unavailable', 'Could not generate speech audio. Please try again.');
      return;
    }

    activeRef.current = true;
    setState({
      cookAlongActive: true,
      currentStepIndex: 0,
      isListening: false,
      isSpeaking: false,
      lastTranscript: '',
    });

    console.log('[CookAlong] Launching loop with preloaded audio, total setup:', Date.now() - tapTime, 'ms');
    void runCookAlongLoop(0, introUri, step1Uri);
  }, [instructions, resolvedVoiceId, runCookAlongLoop]);

  const stopCookAlong = useCallback(async () => {
    await cleanup();
  }, [cleanup]);

  return {
    ...state,
    startCookAlong,
    stopCookAlong,
  };
}
