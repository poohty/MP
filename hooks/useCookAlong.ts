import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { getBackendBaseUrl } from '@/lib/trpc';
import { resolveVoiceId, type VoicePreference } from '@/constants/voice';

const RECORD_DURATION_MS = 3000;
const INTRO_TEXT = "Let's start with step one.";
const TTS_MAX_RETRIES = 2;
const TTS_RETRY_DELAY_MS = 600;

type VoiceCommand = 'STEP_COMPLETE' | 'REPEAT_STEP' | 'NONE';

interface CookAlongState {
  cookAlongActive: boolean;
  currentStepIndex: number;
  isListening: boolean;
  isSpeaking: boolean;
  lastTranscript: string;
}

async function fetchTTSAudioOnce(text: string, voiceId: string, requestId: string): Promise<{ ok: true; uri: string } | { ok: false; retryable: boolean; error: string }> {
  const apiBase = getBackendBaseUrl();
  if (!apiBase) {
    console.log(`[CookAlong] TTS[${requestId}]: no API base URL found.`);
    return { ok: false, retryable: false, error: 'Backend not configured' };
  }

  const ttsUrl = `${apiBase}/api/voice/tts`;
  console.log(`[CookAlong] TTS[${requestId}] request -> ${ttsUrl} | voiceId: ${voiceId} | text length: ${text.length}`);

  try {
    const response = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg, application/json',
      },
      body: JSON.stringify({ text, voiceId }),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const errText = await response.text();
      const isHtml = contentType.includes('text/html') || errText.trimStart().startsWith('<');

      if (isHtml) {
        const isGatewayError = response.status === 403 || response.status === 429 || response.status >= 500;
        console.log(`[CookAlong] TTS[${requestId}] returned HTML, status: ${response.status}, gateway/transient: ${isGatewayError}`);
        return { ok: false, retryable: isGatewayError, error: `Gateway HTML response (${response.status})` };
      }

      const isServerError = response.status >= 500 || response.status === 429;
      console.log(`[CookAlong] TTS[${requestId}] error: ${response.status} ${errText.substring(0, 300)}`);
      return { ok: false, retryable: isServerError, error: `TTS failed: ${response.status}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    console.log(`[CookAlong] TTS[${requestId}] success, audio size: ${arrayBuffer.byteLength} bytes`);
    return { ok: true, uri: `data:audio/mpeg;base64,${base64}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`[CookAlong] TTS[${requestId}] network error: ${msg}`);
    return { ok: false, retryable: true, error: msg };
  }
}

async function fetchTTSAudio(text: string, voiceId: string, requestId?: string): Promise<string> {
  const id = requestId || Math.random().toString(36).slice(2, 6);

  for (let attempt = 0; attempt <= TTS_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = TTS_RETRY_DELAY_MS * attempt;
      console.log(`[CookAlong] TTS[${id}] retry ${attempt}/${TTS_MAX_RETRIES} after ${delay}ms`);
      await new Promise<void>(r => setTimeout(r, delay));
    }

    const result = await fetchTTSAudioOnce(text, voiceId, `${id}:${attempt}`);

    if (result.ok) {
      return result.uri;
    }

    if (!result.retryable) {
      throw new Error(result.error);
    }

    console.log(`[CookAlong] TTS[${id}] attempt ${attempt} failed (retryable): ${result.error}`);
  }

  throw new Error('TTS failed after retries. The voice server may be temporarily overloaded.');
}

async function playAudioUri(uri: string, soundRef: React.MutableRefObject<Audio.Sound | null>): Promise<void> {
  console.log('[CookAlong] playAudioUri: setting audio mode for playback');
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    playThroughEarpieceAndroid: false,
    shouldDuckAndroid: false,
  });

  console.log('[CookAlong] playAudioUri: creating sound, uri length:', uri?.length ?? 0);
  const { sound, status: initialStatus } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: false, volume: 1.0 }
  );
  soundRef.current = sound;

  if (!initialStatus.isLoaded) {
    console.log('[CookAlong] playAudioUri: sound failed to load initially');
    sound.unloadAsync().catch(() => {});
    if (soundRef.current === sound) soundRef.current = null;
    return;
  }

  console.log('[CookAlong] playAudioUri: sound loaded, duration:', initialStatus.durationMillis, 'ms, playing now');

  let resolved = false;
  const safeResolve = (resolveFn: () => void) => {
    if (resolved) return;
    resolved = true;
    sound.unloadAsync().catch(() => {});
    if (soundRef.current === sound) soundRef.current = null;
    resolveFn();
  };

  const playPromise = new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      console.log('[CookAlong] playAudioUri: safety timeout reached, resolving');
      safeResolve(resolve);
    }, Math.max((initialStatus.durationMillis ?? 30000) + 5000, 10000));

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        if ('error' in status && status.error) {
          console.log('[CookAlong] playAudioUri: playback error:', status.error);
        } else {
          console.log('[CookAlong] playAudioUri: sound unloaded during playback');
        }
        clearTimeout(timeout);
        safeResolve(resolve);
        return;
      }
      if (status.didJustFinish) {
        console.log('[CookAlong] playAudioUri: playback finished normally');
        clearTimeout(timeout);
        safeResolve(resolve);
      }
    });
  });

  try {
    await sound.playAsync();
    console.log('[CookAlong] playAudioUri: playAsync called successfully');
  } catch (e) {
    console.log('[CookAlong] playAudioUri: playAsync error:', e);
    sound.unloadAsync().catch(() => {});
    if (soundRef.current === sound) soundRef.current = null;
    return;
  }

  return playPromise;
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

  const response = await fetch(`${apiBase}/api/voice/stt`, {
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
        if (!introUri) { fetches.push(fetchTTSAudio(INTRO_TEXT, resolvedVoiceId, 'intro-retry')); fetchKeys.push('intro'); }
        if (!step1Uri) { fetches.push(fetchTTSAudio(instructions[stepIdx] || 'No instruction available.', resolvedVoiceId, 'step1-retry')); fetchKeys.push('step1'); }
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

    console.log('[CookAlong] Starting startup: health check + permissions + TTS fetch');

    const healthUrl = `${apiBase}/api/voice/health`;
    console.log('[CookAlong] Health check URL:', healthUrl);
    const healthPromise = fetch(healthUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    })
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

    const introTTSPromise = fetchTTSAudio(INTRO_TEXT, resolvedVoiceId, 'intro')
      .then(uri => {
        console.log('[CookAlong] Intro TTS done in', Date.now() - tapTime, 'ms');
        return uri;
      })
      .catch((e) => {
        console.log('[CookAlong] Intro TTS failed after retries:', e);
        return null;
      });

    const step1TTSPromise = fetchTTSAudio(step1Text, resolvedVoiceId, 'step1')
      .then(uri => {
        console.log('[CookAlong] Step1 TTS done in', Date.now() - tapTime, 'ms');
        return uri;
      })
      .catch((e) => {
        console.log('[CookAlong] Step1 TTS failed after retries:', e);
        return null;
      });

    const [healthOk, permGranted, introUri, step1Uri] = await Promise.all([
      healthPromise,
      permPromise,
      introTTSPromise,
      step1TTSPromise,
    ]);

    console.log('[CookAlong] All parallel tasks done in', Date.now() - tapTime, 'ms');
    console.log('[CookAlong] Results — health:', healthOk, 'perm:', permGranted, 'intro:', !!introUri, 'step1:', !!step1Uri);

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

    if (!introUri && !step1Uri) {
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
    void runCookAlongLoop(0, introUri ?? undefined, step1Uri ?? undefined);
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
