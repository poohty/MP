import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { AudioModule, RecordingPresets, createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer, AudioRecorder } from 'expo-audio';
import * as Speech from 'expo-speech';
import { getBackendBaseUrl } from '@/lib/trpc';
import { resolveVoiceId, type VoicePreference } from '@/constants/voice';

const RECORD_DURATION_MS = 3000;
const INTRO_TEXT = "Let's start with step one.";
const introTextFor = (stepIndex: number): string =>
  stepIndex > 0 ? `Let's continue with step ${stepIndex + 1}.` : INTRO_TEXT;
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

const PLAYBACK_SAFETY_TIMEOUT_MS = 35000;

async function playAudioUri(uri: string, soundRef: React.MutableRefObject<AudioPlayer | null>): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
  });

  const player = createAudioPlayer(uri, { updateInterval: 250 });
  soundRef.current = player;

  console.log('[CookAlong] playAudioUri: player created, playing now');

  const playPromise = new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      subscription.remove();
      player.remove();
      if (soundRef.current === player) soundRef.current = null;
      resolve();
    };

    const timeout = setTimeout(() => {
      console.log('[CookAlong] playAudioUri: safety timeout reached');
      finish();
    }, PLAYBACK_SAFETY_TIMEOUT_MS);

    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        console.log('[CookAlong] playAudioUri: playback finished normally');
        finish();
      }
    });
  });

  try {
    player.play();
    console.log('[CookAlong] playAudioUri: play() called successfully');
  } catch (e) {
    console.log('[CookAlong] playAudioUri: play() error:', e);
    player.remove();
    if (soundRef.current === player) soundRef.current = null;
    return;
  }

  return playPromise;
}

async function speakText(text: string, soundRef: React.MutableRefObject<AudioPlayer | null>, voiceId: string, requestId: string | undefined, isCurrent: () => boolean): Promise<void> {
  try {
    const uri = await fetchTTSAudio(text, voiceId, requestId);
    if (!isCurrent()) return;
    await playAudioUri(uri, soundRef);
  } catch (error) {
    if (!isCurrent()) return;
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

// Expo's fetch (SDK 58+) rejects React Native's { uri, type, name } file part ("Unsupported FormDataPart
// implementation"), so the recording never reached the server. XMLHttpRequest still uploads local files.
function uploadRecording(url: string, uri: string): Promise<{ transcript: string; command: VoiceCommand }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('audio', { uri, type: 'audio/m4a', name: 'recording.m4a' } as any);
    formData.append('keyterms', 'step complete,repeat step');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = 20000;
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        console.log('[CookAlong] STT error:', xhr.status, xhr.responseText);
        reject(new Error(`STT failed: ${xhr.status}`));
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new Error('STT returned an unreadable response'));
      }
    };
    xhr.onerror = () => reject(new Error('STT network error'));
    xhr.ontimeout = () => reject(new Error('STT timed out'));
    xhr.send(formData);
  });
}

async function listenForCommand(
  recordingRef: React.MutableRefObject<AudioRecorder | null>,
  isCurrent: () => boolean
): Promise<{ command: VoiceCommand; transcript: string }> {
  const apiBase = getBackendBaseUrl();
  if (!apiBase) {
    console.log('[CookAlong] STT: no API base URL found');
    throw new Error('Backend not configured');
  }

  if (Platform.OS !== 'web') {
    const permResult = await requestRecordingPermissionsAsync();
    if (!permResult.granted) {
      throw new Error('Microphone permission denied');
    }
  }

  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });

  const recording = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
  await recording.prepareToRecordAsync();
  recording.record();
  recordingRef.current = recording;

  console.log('[CookAlong] Recording started...');

  await new Promise<void>((resolve) => setTimeout(resolve, RECORD_DURATION_MS));

  if (!isCurrent()) {
    try {
      await recording.stop();
    } catch {}
    recordingRef.current = null;
    return { command: 'NONE', transcript: '' };
  }

  await recording.stop();
  await setAudioModeAsync({ allowsRecording: false });

  const uri = recording.uri;
  recordingRef.current = null;

  if (!uri) {
    console.log('[CookAlong] No recording URI');
    return { command: 'NONE', transcript: '' };
  }

  console.log('[CookAlong] Recording stopped, URI:', uri);

  let result: { transcript: string; command: VoiceCommand };
  if (Platform.OS === 'web') {
    const formData = new FormData();
    const resp = await fetch(uri);
    const blob = await resp.blob();
    formData.append('audio', blob, 'recording.webm');
    formData.append('keyterms', 'step complete,repeat step');
    const response = await fetch(`${apiBase}/api/voice/stt`, { method: 'POST', body: formData });
    if (!response.ok) {
      console.log('[CookAlong] STT error:', response.status, await response.text());
      throw new Error(`STT failed: ${response.status}`);
    }
    result = await response.json() as { transcript: string; command: VoiceCommand };
  } else {
    result = await uploadRecording(`${apiBase}/api/voice/stt`, uri);
  }

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
  const soundRef = useRef<AudioPlayer | null>(null);
  const recordingRef = useRef<AudioRecorder | null>(null);
  const loopRunningRef = useRef(false);
  // Every start and every stop gets a new run id. A loop from an earlier run can still be waiting on audio
  // or the network when the user stops and starts again; without this it woke up and talked over the new one.
  const runRef = useRef(0);
  const resolvedVoiceId = resolveVoiceId(voicePreference);

  const cleanup = useCallback(async (reason?: string) => {
    console.log('[CookAlong] cleanup called', reason ? `reason: ${reason}` : '');
    runRef.current += 1;
    activeRef.current = false;
    loopRunningRef.current = false;
    Speech.stop();

    if (recordingRef.current) {
      try {
        await recordingRef.current.stop();
      } catch {}
      recordingRef.current = null;
    }

    if (soundRef.current) {
      try {
        soundRef.current.pause();
        soundRef.current.remove();
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
      runRef.current += 1;
      activeRef.current = false;
      loopRunningRef.current = false;
      Speech.stop();
      if (recordingRef.current) {
        recordingRef.current.stop().catch(() => {});
        recordingRef.current = null;
      }
      if (soundRef.current) {
        try {
          soundRef.current.pause();
          soundRef.current.remove();
        } catch {}
        soundRef.current = null;
      }
    };
  }, []);

  const safeSpeakText = useCallback(async (text: string, requestId: string | undefined, run: number) => {
    const isCurrent = () => activeRef.current && runRef.current === run;
    if (!isCurrent()) return;
    setState((prev) => ({ ...prev, isSpeaking: true }));
    try {
      await speakText(text, soundRef, resolvedVoiceId, requestId, isCurrent);
    } catch (e) {
      console.log('[CookAlong] Speak error:', e);
    } finally {
      setState((prev) => ({ ...prev, isSpeaking: false }));
    }
  }, [resolvedVoiceId]);

  const safeListenForCommand = useCallback(async (run: number): Promise<{ command: VoiceCommand; transcript: string }> => {
    const isCurrent = () => activeRef.current && runRef.current === run;
    if (!isCurrent()) return { command: 'NONE', transcript: '' };
    setState((prev) => ({ ...prev, isListening: true }));
    try {
      const result = await listenForCommand(recordingRef, isCurrent);
      setState((prev) => ({ ...prev, lastTranscript: result.transcript }));
      return result;
    } catch (e) {
      console.log('[CookAlong] Listen error:', e);
      return { command: 'NONE', transcript: '' };
    } finally {
      setState((prev) => ({ ...prev, isListening: false }));
    }
  }, []);

  const speakStep = useCallback(async (stepText: string, label: string, run: number): Promise<boolean> => {
    const isCurrent = () => activeRef.current && runRef.current === run;
    if (!isCurrent()) return false;
    const normalized = lightNormalize(stepText);
    console.log(`[CookAlong] speakStep[${label}] text (${normalized.length} chars): "${normalized.substring(0, 120)}${normalized.length > 120 ? '...' : ''}"`);

    setState((prev) => ({ ...prev, isSpeaking: true }));
    try {
      const uri = await fetchTTSAudio(normalized, resolvedVoiceId, label);
      if (!isCurrent()) return false;
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

  const runCookAlongLoop = useCallback(async (startIndex: number, preloadedIntroUri: string | undefined, run: number) => {
    const alive = () => activeRef.current && runRef.current === run;
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
          introUri = await fetchTTSAudio(introTextFor(startIndex), resolvedVoiceId, 'intro-loop');
        } catch (e) {
          console.log('[CookAlong] Intro fetch failed:', e);
        }
      }

      if (!alive()) { console.log('[CookAlong] Cancelled before intro play'); return; }

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

      if (!alive()) { console.log('[CookAlong] Cancelled after intro'); return; }

      const stepText = instructions[stepIdx];
      if (stepText && stepText.length > 0) {
        console.log('[CookAlong] Requesting step 1 TTS sequentially');
        const spoken = await speakStep(stepText, 'step1', run);
        if (!alive()) { console.log('[CookAlong] Cancelled after step1 speech'); return; }

        if (spoken) {
          console.log('[CookAlong] Step 1 TTS ready');
        } else {
          console.log('[CookAlong] Step 1 TTS failed, speaking fallback');
          await safeSpeakText("I could not read step one. Please read step one on your screen.", 'step1-fallback', run);
        }
      } else {
        console.log('[CookAlong] Step 1 has no text');
      }

      if (!alive()) { console.log('[CookAlong] Cancelled after step1'); return; }

      console.log('[CookAlong] Speaking reminder');
      await safeSpeakText(reminderLine, 'reminder', run);

      if (!alive()) { console.log('[CookAlong] Cancelled after reminder'); return; }

      console.log('[CookAlong] Entering listen loop');

      while (alive() && stepIdx < instructions.length) {
            console.log(`[CookAlong] Listening (step ${stepIdx + 1})`);
        const { command } = await safeListenForCommand(run);

        if (!alive()) break;
        console.log(`[CookAlong] Command: ${command}`);

        if (command === 'REPEAT_STEP') {
          const repeatText = instructions[stepIdx] || '';
          if (repeatText) {
            const repeatSpoken = await speakStep(repeatText, `repeat-step${stepIdx + 1}`, run);
            if (!repeatSpoken) {
              await safeSpeakText("I could not generate the audio. Please read the step on screen.", 'repeat-fallback', run);
            }
          } else {
            await safeSpeakText("Please read the step on screen.", 'repeat-empty', run);
          }
          if (!alive()) break;
          if (stepIdx >= instructions.length - 1) {
            await safeSpeakText(finalStepReminder, 'final-reminder', run);
          } else {
            await safeSpeakText(reminderLine, 'reminder', run);
          }
        } else if (command === 'STEP_COMPLETE') {
          setState((prev) => ({ ...prev, currentStepIndex: stepIdx }));

          if (stepIdx >= instructions.length - 1) {
            console.log('[CookAlong] Final step complete');
            if (onAllStepsCompleteRef.current) {
              onAllStepsCompleteRef.current();
            }
            await safeSpeakText("Awesome, all checkmarks cleared. Hope you enjoy your meal!", 'done', run);
            activeRef.current = false;
            runRef.current += 1;
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

            await safeSpeakText(`Step ${stepIdx + 1}.`, `step${stepIdx + 1}-announce`, run);
            if (!alive()) break;

            if (nextStepText) {
              const nextSpoken = await speakStep(nextStepText, `step${stepIdx + 1}`, run);
              if (!nextSpoken) {
                await safeSpeakText("Please read this step on your screen.", `step${stepIdx + 1}-fallback`, run);
              }
            } else {
              await safeSpeakText("Please read this step on your screen.", `step${stepIdx + 1}-empty`, run);
            }

            if (!alive()) break;
            if (stepIdx >= instructions.length - 1) {
              await safeSpeakText(finalStepReminder, 'final-reminder', run);
            } else {
              await safeSpeakText(reminderLine, 'reminder', run);
            }
          }
        } else {
          await safeSpeakText(
            "I didn't catch that. Please say 'Step Complete' or 'Repeat Step'.",
            'not-understood',
            run
          );
        }
      }
    } catch (e) {
      console.log('[CookAlong] Loop error:', e);
    } finally {
      console.log('[CookAlong] Loop exiting');
      if (runRef.current === run) loopRunningRef.current = false;
    }
  }, [instructions, resolvedVoiceId, safeSpeakText, safeListenForCommand, speakStep]);

  // fromStep is the first step not yet checked off on screen, so starting again continues where you left off.
  const startCookAlong = useCallback(async (fromStep: number = 0) => {
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
      ? requestRecordingPermissionsAsync().then(r => {
          console.log('[CookAlong] Permission done in', Date.now() - tapTime, 'ms, granted:', r.granted);
          return r.granted;
        })
      : Promise.resolve(true);

    const startIndex = Number.isInteger(fromStep) && fromStep > 0 && fromStep < instructions.length ? fromStep : 0;
    const introTTSPromise = fetchTTSAudio(introTextFor(startIndex), resolvedVoiceId, 'intro')
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

    runRef.current += 1;
    const run = runRef.current;
    activeRef.current = true;
    setState({
      cookAlongActive: false,
      phase: 'starting',
      currentStepIndex: startIndex,
      isListening: false,
      isSpeaking: false,
      lastTranscript: '',
    });

    console.log('[CookAlong] Launching loop, setup took', Date.now() - tapTime, 'ms');
    void runCookAlongLoop(startIndex, introUri, run);
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
