import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { getBackendBaseUrl } from '@/lib/trpc';
import { resolveVoiceId, type VoicePreference } from '@/constants/voice';

const RECORD_DURATION_MS = 3000;
const INTRO_TEXT = "Let's start with step one.";
const TTS_MAX_RETRIES = 2;
const TTS_RETRY_DELAY_MS = 600;

const ttsAudioCache = new Map<string, string>();

type VoiceCommand = 'STEP_COMPLETE' | 'REPEAT_STEP' | 'NONE';

type CookAlongPhase = 'idle' | 'starting' | 'active' | 'failed';

interface CookAlongState {
  cookAlongActive: boolean;
  phase: CookAlongPhase;
  currentStepIndex: number;
  isListening: boolean;
  isSpeaking: boolean;
  lastTranscript: string;
}

function lightNormalize(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchTTSAudioOnce(
  text: string,
  voiceId: string,
  requestId: string
): Promise<{ ok: true; uri: string } | { ok: false; retryable: boolean; error: string }> {
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
  const cacheKey = `${voiceId}:${text}`;
  const cached = ttsAudioCache.get(cacheKey);
  if (cached) {
    console.log(`[CookAlong] TTS[${id}] cache hit, text length: ${text.length}`);
    return cached;
  }

  for (let attempt = 0; attempt <= TTS_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = TTS_RETRY_DELAY_MS * attempt;
      console.log(`[CookAlong] TTS[${id}] retry ${attempt}/${TTS_MAX_RETRIES} after ${delay}ms`);
      await new Promise<void>(r => setTimeout(r, delay));
    }

    const result = await fetchTTSAudioOnce(text, voiceId, `${id}:${attempt}`);

    if (result.ok) {
      ttsAudioCache.set(cacheKey, result.uri);
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
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    playThroughEarpieceAndroid: false,
    shouldDuckAndroid: false,
  });

  const { sound, status: initialStatus } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: false, volume: 1.0 }
  );
  soundRef.current = sound;

  if (!initialStatus.isLoaded) {
    console.log('[CookAlong] playAudioUri: sound failed to load');
    sound.unloadAsync().catch(() => {});
    if (soundRef.current === sound) soundRef.current = null;
    return;
  }

  const durationMs = initialStatus.durationMillis ?? 30000;
  console.log('[CookAlong] playAudioUri: sound loaded, duration:', durationMs, 'ms, playing now');

  const playPromise = new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      sound.setOnPlaybackStatusUpdate(null);
      sound.unloadAsync().catch(() => {});
      if (soundRef.current === sound) soundRef.current = null;
      resolve();
    };

    const timeout = setTimeout(() => {
      console.log('[CookAlong] playAudioUri: safety timeout reached');
      finish();
    }, durationMs + 5000);

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        console.log('[CookAlong] playAudioUri: sound unloaded during playback');
        finish();
        return;
      }
      if (status.didJustFinish) {
        console.log('[CookAlong] playAudioUri: playback finished normally');
        finish();
      }
    });
  });

  try {
    await sound.playAsync();
    console.log('[CookAlong] playAudioUri: playAsync called successfully');
  } catch (e) {
    console.log('[CookAlong] playAudioUri: playAsync error:', e);
    sound.setOnPlaybackStatusUpdate(null);
    sound.unloadAsync().catch(() => {});
    if (soundRef.current === sound) soundRef.current = null;
    return;
  }

  return playPromise;
}

async function speakText(text: string, soundRef: React.MutableRefObject<Audio.Sound | null>, voiceId: string, requestId?: string): Promise<void> {
  try {
    const uri = await fetchTTSAudio(text, voiceId, requestId);
    await playAudioUri(uri, soundRef);
  } catch (error) {
    console.log('[CookAlong] TTS failed or not configured, falling back to expo-speech:', error);
    return new Promise((resolve) => {
      Speech.speak(text, {
        onDone: () => resolve(),
        onError: () => resolve(),
        onStopped: () => resolve(),
      });
    });
  }
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
    phase: 'idle',
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

  const cleanup = useCallback(async (reason?: string) => {
    console.log('[CookAlong] cleanup called', reason ? `reason: ${reason}` : '');
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
      phase: 'idle',
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

  const safeSpeakText = useCallback(async (text: string, requestId?: string) => {
    if (!activeRef.current) return;
    setState((prev) => ({ ...prev, isSpeaking: true }));
    try {
      await speakText(text, soundRef, resolvedVoiceId, requestId);
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

  const speakStep = useCallback(async (stepText: string, label: string): Promise<boolean> => {
    if (!activeRef.current) return false;
    const normalized = lightNormalize(stepText);
    console.log(`[CookAlong] speakStep[${label}] text (${normalized.length} chars): "${normalized.substring(0, 120)}${normalized.length > 120 ? '...' : ''}"`);

    setState((prev) => ({ ...prev, isSpeaking: true }));
    try {
      const uri = await fetchTTSAudio(normalized, resolvedVoiceId, label);
      if (!activeRef.current) return false;
      await playAudioUri(uri, soundRef);
      console.log(`[CookAlong] speakStep[${label}] finished`);
      return true;
    } catch (e) {
      console.log(`[CookAlong] speakStep[${label}] failed:`, e);
      return false;
    } finally {
      setState((prev) => ({ ...prev, isSpeaking: false }));
    }
  }, [resolvedVoiceId]);

  const runCookAlongLoop = useCallback(async (startIndex: number, preloadedIntroUri?: string, _preloadedStep1Uri?: string) => {
    if (loopRunningRef.current) {
      console.log('[CookAlong] Loop already running, ignoring');
      return;
    }
    loopRunningRef.current = true;

    let stepIdx = startIndex;
    const reminderLine = "Say 'Step Complete' for the next step, or 'Repeat Step' to hear this step again.";
    const finalStepReminder = "Say 'Step Complete' once you are done and I will clear the check marks of this recipe. Or say 'Repeat Step' to hear this step again.";

    try {
      console.log(`[CookAlong] Loop start, ${instructions.length} steps, startIndex: ${startIndex}`);

      let introUri = preloadedIntroUri;
      if (!introUri) {
        console.log('[CookAlong] Fetching intro TTS');
        try {
          introUri = await fetchTTSAudio(INTRO_TEXT, resolvedVoiceId, 'intro-loop');
        } catch (e) {
          console.log('[CookAlong] Intro fetch failed:', e);
        }
      }

      if (!activeRef.current) { console.log('[CookAlong] Cancelled before intro play'); return; }

      if (!introUri) {
        console.log('[CookAlong] No intro audio, failing');
        setState((prev) => ({ ...prev, cookAlongActive: false, phase: 'failed' }));
        return;
      }

      setState((prev) => ({ ...prev, cookAlongActive: true, phase: 'active', isSpeaking: true }));
      console.log('[CookAlong] Playing intro');
      await playAudioUri(introUri, soundRef);
      setState((prev) => ({ ...prev, isSpeaking: false }));
      console.log('[CookAlong] Intro finished');

      if (!activeRef.current) { console.log('[CookAlong] Cancelled after intro'); return; }

      const stepText = instructions[stepIdx];
      if (stepText && stepText.length > 0) {
        console.log('[CookAlong] Requesting step 1 TTS sequentially');
        const spoken = await speakStep(stepText, 'step1');
        if (!activeRef.current) { console.log('[CookAlong] Cancelled after step1 speech'); return; }

        if (spoken) {
          console.log('[CookAlong] Step 1 TTS ready');
        } else {
          console.log('[CookAlong] Step 1 TTS failed, speaking fallback');
          await safeSpeakText("I could not read step one. Please read step one on your screen.", 'step1-fallback');
        }
      } else {
        console.log('[CookAlong] Step 1 has no text');
      }

      if (!activeRef.current) { console.log('[CookAlong] Cancelled after step1'); return; }

      console.log('[CookAlong] Speaking reminder');
      await safeSpeakText(reminderLine, 'reminder');

      if (!activeRef.current) { console.log('[CookAlong] Cancelled after reminder'); return; }

      console.log('[CookAlong] Entering listen loop');

      while (activeRef.current && stepIdx < instructions.length) {
        console.log(`[CookAlong] Listening (step ${stepIdx + 1})`);
        const { command } = await safeListenForCommand();

        if (!activeRef.current) break;
        console.log(`[CookAlong] Command: ${command}`);

        if (command === 'REPEAT_STEP') {
          const repeatText = instructions[stepIdx] || '';
          if (repeatText) {
            const repeatSpoken = await speakStep(repeatText, `repeat-step${stepIdx + 1}`);
            if (!repeatSpoken) {
              await safeSpeakText("I could not generate the audio. Please read the step on screen.", 'repeat-fallback');
            }
          } else {
            await safeSpeakText("Please read the step on screen.", 'repeat-empty');
          }
          if (!activeRef.current) break;
          if (stepIdx >= instructions.length - 1) {
            await safeSpeakText(finalStepReminder, 'final-reminder');
          } else {
            await safeSpeakText(reminderLine, 'reminder');
          }
        } else if (command === 'STEP_COMPLETE') {
          setState((prev) => ({ ...prev, currentStepIndex: stepIdx }));

          if (stepIdx >= instructions.length - 1) {
            console.log('[CookAlong] Final step complete');
            if (onAllStepsCompleteRef.current) {
              onAllStepsCompleteRef.current();
            }
            await safeSpeakText("Awesome, all checkmarks cleared. Hope you enjoy your meal!", 'done');
            activeRef.current = false;
            setState((prev) => ({
              ...prev,
              cookAlongActive: false,
              phase: 'idle',
              isListening: false,
              isSpeaking: false,
            }));
            break;
          } else {
            stepIdx += 1;
            setState((prev) => ({ ...prev, currentStepIndex: stepIdx }));
            const nextStepText = instructions[stepIdx] || '';
            console.log(`[CookAlong] Moving to step ${stepIdx + 1}, text length: ${nextStepText.length}`);

            await safeSpeakText(`Step ${stepIdx + 1}.`, `step${stepIdx + 1}-announce`);
            if (!activeRef.current) break;

            if (nextStepText) {
              const nextSpoken = await speakStep(nextStepText, `step${stepIdx + 1}`);
              if (!nextSpoken) {
                await safeSpeakText("Please read this step on your screen.", `step${stepIdx + 1}-fallback`);
              }
            } else {
              await safeSpeakText("Please read this step on your screen.", `step${stepIdx + 1}-empty`);
            }

            if (!activeRef.current) break;
            if (stepIdx >= instructions.length - 1) {
              await safeSpeakText(finalStepReminder, 'final-reminder');
            } else {
              await safeSpeakText(reminderLine, 'reminder');
            }
          }
        } else {
          await safeSpeakText(
            "I didn't catch that. Please say 'Step Complete' or 'Repeat Step'.",
            'not-understood'
          );
        }
      }
    } catch (e) {
      console.log('[CookAlong] Loop error:', e);
    } finally {
      console.log('[CookAlong] Loop exiting');
      loopRunningRef.current = false;
    }
  }, [instructions, resolvedVoiceId, safeSpeakText, safeListenForCommand, speakStep]);

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

    setState((prev) => ({ ...prev, phase: 'starting' }));
    console.log('[CookAlong] Starting: health + permissions + intro TTS');

    const healthUrl = `${apiBase}/api/voice/health`;
    const healthPromise = fetch(healthUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    })
      .then(async r => {
        console.log('[CookAlong] Health check status:', r.status, 'in', Date.now() - tapTime, 'ms');
        if (!r.ok) {
          const body = await r.text().catch(() => '');
          if (body.trimStart().startsWith('<')) {
            console.log('[CookAlong] Health returned HTML — wrong backend URL');
          }
          return false;
        }
        const contentType = r.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          console.log('[CookAlong] Health returned non-JSON content-type:', contentType);
          return false;
        }
        return true;
      })
      .catch((e) => {
        console.log('[CookAlong] Health check failed:', e);
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
        console.log('[CookAlong] Intro TTS failed:', e);
        return null;
      });

    const [healthOk, permGranted, introUri] = await Promise.all([
      healthPromise,
      permPromise,
      introTTSPromise,
    ]);

    console.log('[CookAlong] Startup done in', Date.now() - tapTime, 'ms — health:', healthOk, 'perm:', permGranted, 'intro:', !!introUri);

    if (!healthOk) {
      setState((prev) => ({ ...prev, phase: 'idle' }));
      Alert.alert(
        'Voice feature unavailable',
        `Voice server not responding.\nBackend: ${apiBase}\nPlease try again later.`
      );
      return;
    }

    if (!permGranted) {
      setState((prev) => ({ ...prev, phase: 'idle' }));
      Alert.alert('Permission Required', 'Microphone access is needed for hands-free cooking.');
      return;
    }

    if (!introUri) {
      setState((prev) => ({ ...prev, phase: 'failed' }));
      Alert.alert('Voice feature unavailable', 'Could not generate speech audio. Please try again.');
      return;
    }

    activeRef.current = true;
    setState({
      cookAlongActive: false,
      phase: 'starting',
      currentStepIndex: 0,
      isListening: false,
      isSpeaking: false,
      lastTranscript: '',
    });

    console.log('[CookAlong] Launching loop, setup took', Date.now() - tapTime, 'ms');
    void runCookAlongLoop(0, introUri);
  }, [instructions, resolvedVoiceId, runCookAlongLoop]);

  const stopCookAlong = useCallback(async () => {
    console.log('[CookAlong] stopCookAlong called by user');
    await cleanup('user-stop');
  }, [cleanup]);

  return {
    ...state,
    startCookAlong,
    stopCookAlong,
  };
}
