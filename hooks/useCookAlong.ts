import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { getBackendBaseUrl } from '@/lib/trpc';
import { resolveVoiceId, type VoicePreference } from '@/constants/voice';

const RECORD_DURATION_MS = 3000;
const INTRO_TEXT = "Let's start with step one.";
const TTS_MAX_RETRIES = 1;
const TTS_RETRY_DELAY_MS = 400;
const TTS_SHORT_TEXT_LIMIT = 80;
const TTS_REQUEST_STAGGER_MS = 350;

const ttsAudioCache = new Map<string, string>();

function normalizeStepText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

function shortenStepText(text: string): string {
  let shortened = normalizeStepText(text);
  if (shortened.length > TTS_SHORT_TEXT_LIMIT) {
    const sentenceEnd = shortened.indexOf('. ', 40);
    if (sentenceEnd > 0 && sentenceEnd < shortened.length - 5) {
      shortened = shortened.substring(0, sentenceEnd + 1);
    }
  }
  if (shortened.length > TTS_SHORT_TEXT_LIMIT) {
    const commaIdx = shortened.lastIndexOf(',', TTS_SHORT_TEXT_LIMIT);
    if (commaIdx > 30) {
      shortened = shortened.substring(0, commaIdx) + '.';
    } else {
      shortened = shortened.substring(0, TTS_SHORT_TEXT_LIMIT).replace(/\s+\S*$/, '') + '.';
    }
  }
  return shortened;
}

function isInsideParentheses(text: string, index: number): boolean {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth = Math.max(0, depth - 1);
  }
  return depth > 0;
}

function splitStepText(text: string): string[] {
  const normalized = normalizeStepText(text);
  const splitPoints: number[] = [];
  const sentenceEndRegex = /[.!?]\s+/g;
  let match: RegExpExecArray | null;
  while ((match = sentenceEndRegex.exec(normalized)) !== null) {
    const idx = match.index + 1;
    if (!isInsideParentheses(normalized, idx)) {
      splitPoints.push(idx);
    }
  }

  if (splitPoints.length >= 1) {
    const mid = splitPoints[Math.floor(splitPoints.length / 2)];
    const part1 = normalized.substring(0, mid).trim();
    const part2 = normalized.substring(mid).trim();
    if (part1.length > 0 && part2.length > 0) {
      console.log(`[CookAlong] splitStepText: split at ${mid}, part1=${part1.length}, part2=${part2.length}`);
      return [part1, part2];
    }
  }

  const commaIdx = normalized.indexOf(',', Math.floor(normalized.length / 3));
  if (commaIdx > 0 && commaIdx < normalized.length - 10 && !isInsideParentheses(normalized, commaIdx)) {
    return [
      normalized.substring(0, commaIdx + 1).trim(),
      normalized.substring(commaIdx + 1).trim(),
    ];
  }
  return [normalized];
}

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

async function fetchStepTTSWithFallbackLadder(
  fullStepText: string,
  voiceId: string,
  stepLabel: string
): Promise<{ uri: string; variant: string }> {
  const normalizedFull = normalizeStepText(fullStepText);
  console.log(`[CookAlong] FallbackLadder[${stepLabel}] original length: ${fullStepText.length}, normalized length: ${normalizedFull.length}`);
  console.log(`[CookAlong] FallbackLadder[${stepLabel}] normalized text: "${normalizedFull}"`);

  try {
    const uri = await fetchTTSAudio(normalizedFull, voiceId, `${stepLabel}-full`);
    console.log(`[CookAlong] FallbackLadder[${stepLabel}] full text succeeded`);
    return { uri, variant: 'full' };
  } catch (e) {
    console.log(`[CookAlong] FallbackLadder[${stepLabel}] full text failed:`, e);
  }

  await new Promise<void>(r => setTimeout(r, TTS_REQUEST_STAGGER_MS));

  const shortened = shortenStepText(normalizedFull);
  if (shortened !== fullStepText && shortened.length < fullStepText.length) {
    console.log(`[CookAlong] FallbackLadder[${stepLabel}] trying shortened text length: ${shortened.length}`);
    try {
      const uri = await fetchTTSAudio(shortened, voiceId, `${stepLabel}-short`);
      console.log(`[CookAlong] FallbackLadder[${stepLabel}] shortened text succeeded`);
      return { uri, variant: 'shortened' };
    } catch (e) {
      console.log(`[CookAlong] FallbackLadder[${stepLabel}] shortened text failed:`, e);
    }
    await new Promise<void>(r => setTimeout(r, TTS_REQUEST_STAGGER_MS));
  }

  const parts = splitStepText(normalizedFull);
  if (parts.length >= 2) {
    console.log(`[CookAlong] FallbackLadder[${stepLabel}] trying split: part1=${parts[0].length} "${parts[0]}", part2=${parts[1].length} "${parts[1]}"`);
    try {
      const uri1 = await fetchTTSAudio(parts[0], voiceId, `${stepLabel}-split1`);
      await new Promise<void>(r => setTimeout(r, TTS_REQUEST_STAGGER_MS));
      await fetchTTSAudio(parts[1], voiceId, `${stepLabel}-split2`);
      console.log(`[CookAlong] FallbackLadder[${stepLabel}] split succeeded`);
      return { uri: uri1, variant: 'split' };
    } catch (e) {
      console.log(`[CookAlong] FallbackLadder[${stepLabel}] split failed:`, e);
    }
    await new Promise<void>(r => setTimeout(r, TTS_REQUEST_STAGGER_MS));
  }

  const minimal = normalizedFull.length > 60
    ? normalizedFull.substring(0, 55).replace(/\s+\S*$/, '') + '.'
    : normalizedFull;
  if (minimal.length < normalizedFull.length) {
    console.log(`[CookAlong] FallbackLadder[${stepLabel}] trying minimal text length: ${minimal.length}`);
    try {
      const uri = await fetchTTSAudio(minimal, voiceId, `${stepLabel}-minimal`);
      console.log(`[CookAlong] FallbackLadder[${stepLabel}] minimal text succeeded`);
      return { uri, variant: 'minimal' };
    } catch (e) {
      console.log(`[CookAlong] FallbackLadder[${stepLabel}] minimal text also failed:`, e);
    }
  }

  throw new Error(`All TTS variants failed for ${stepLabel}`);
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

  const speakStepWithLadder = useCallback(async (stepText: string, stepLabel: string): Promise<boolean> => {
    if (!activeRef.current) return false;
    setState((prev) => ({ ...prev, isSpeaking: true }));
    try {
      const result = await fetchStepTTSWithFallbackLadder(stepText, resolvedVoiceId, stepLabel);
      if (!activeRef.current) return false;

      if (result.variant === 'split') {
        const normalizedStep = normalizeStepText(stepText);
        const parts = splitStepText(normalizedStep);
        console.log(`[CookAlong] speakStepWithLadder[${stepLabel}] playing split: chunk 1 of ${parts.length} (${parts[0]?.length} chars), chunk 2 of ${parts.length} (${parts[1]?.length} chars)`);
        const cacheKey1 = `${resolvedVoiceId}:${parts[0]}`;
        const cacheKey2 = `${resolvedVoiceId}:${parts[1]}`;
        const uri1 = ttsAudioCache.get(cacheKey1);
        const uri2 = ttsAudioCache.get(cacheKey2);
        if (uri1) {
          await playAudioUri(uri1, soundRef);
        }
        if (!activeRef.current) return false;
        if (uri2) {
          await new Promise<void>(r => setTimeout(r, 200));
          await playAudioUri(uri2, soundRef);
        }
      } else {
        await playAudioUri(result.uri, soundRef);
      }

      if (result.variant !== 'full') {
        console.log(`[CookAlong] Step spoken using '${result.variant}' variant for ${stepLabel}`);
      }
      return true;
    } catch (e) {
      console.log(`[CookAlong] speakStepWithLadder failed for ${stepLabel}:`, e);
      return false;
    } finally {
      setState((prev) => ({ ...prev, isSpeaking: false }));
    }
  }, [resolvedVoiceId]);

  const runCookAlongLoop = useCallback(async (startIndex: number, preloadedIntroUri?: string) => {
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;

    let stepIdx = startIndex;
    const reminderLine = "Say 'Step Complete' for the next step, or 'Repeat Step' to hear this step again.";
    const finalStepReminder = "Say 'Step Complete' once you are done and I will clear the check marks of this recipe. Or say 'Repeat Step' to hear this step again.";

    try {
      const loopStartTime = Date.now();

      let introUri = preloadedIntroUri;
      if (!introUri) {
        console.log('[CookAlong] Loop: fetching intro audio');
        try {
          introUri = await fetchTTSAudio(INTRO_TEXT, resolvedVoiceId, 'intro-loop');
        } catch (e) {
          console.log('[CookAlong] Loop: intro fetch failed:', e);
        }
      }

      if (!activeRef.current) return;

      if (!introUri) {
        console.log('[CookAlong] No intro audio available, failing startup');
        setState((prev) => ({ ...prev, cookAlongActive: false, phase: 'failed' }));
        return;
      }

      setState((prev) => ({ ...prev, cookAlongActive: true, phase: 'active', isSpeaking: true }));
      console.log('[CookAlong] Starting intro playback at', Date.now() - loopStartTime, 'ms');
      try {
        await playAudioUri(introUri, soundRef);
      } catch (e) {
        console.log('[CookAlong] Intro speak error:', e);
      }
      setState((prev) => ({ ...prev, isSpeaking: false }));

      if (!activeRef.current) return;

      console.log('[CookAlong] Intro finished, now fetching step 1 via fallback ladder');

      await new Promise<void>((resolve) => setTimeout(resolve, TTS_REQUEST_STAGGER_MS));

      if (!activeRef.current) return;

      const stepText = instructions[stepIdx] || 'No instruction available.';
      const step1Spoken = await speakStepWithLadder(stepText, 'step1');

      if (!activeRef.current) return;

      if (!step1Spoken) {
        console.log('[CookAlong] Step 1 all TTS variants failed, speaking generic fallback');
        await safeSpeakText("Please read step one on your screen. I could not generate the audio for it.");
      } else {
        console.log('[CookAlong] Step 1 playback done, total from loop start:', Date.now() - loopStartTime, 'ms');
      }

      if (!activeRef.current) return;

      await safeSpeakText(reminderLine);

      while (activeRef.current && stepIdx < instructions.length) {
        if (!activeRef.current) break;

        const { command } = await safeListenForCommand();

        if (!activeRef.current) break;

        if (command === 'REPEAT_STEP') {
          const repeatText = instructions[stepIdx] || '';
          const repeatSpoken = await speakStepWithLadder(repeatText, `repeat-step${stepIdx + 1}`);
          if (!repeatSpoken) {
            await safeSpeakText("I could not generate the audio. Please read the step on screen.");
          }
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
              phase: 'idle',
              isListening: false,
              isSpeaking: false,
            }));
            break;
          } else {
            stepIdx += 1;
            setState((prev) => ({ ...prev, currentStepIndex: stepIdx }));
            const nextStepText = instructions[stepIdx] || '';
            console.log(`[CookAlong] Speaking step ${stepIdx + 1}, text length: ${nextStepText.length}`);

            await safeSpeakText(`Step ${stepIdx + 1}.`);
            if (!activeRef.current) break;

            await new Promise<void>(r => setTimeout(r, TTS_REQUEST_STAGGER_MS));
            const nextSpoken = await speakStepWithLadder(nextStepText, `step${stepIdx + 1}`);
            if (!nextSpoken) {
              await safeSpeakText("Please read this step on your screen.");
            }

            if (!activeRef.current) break;
            if (stepIdx >= instructions.length - 1) {
              await safeSpeakText(finalStepReminder);
            } else {
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
  }, [instructions, resolvedVoiceId, safeSpeakText, safeListenForCommand, speakStepWithLadder]);

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
    console.log('[CookAlong] Phase: starting — health check + permissions + intro TTS');

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

    const [healthOk, permGranted, introUri] = await Promise.all([
      healthPromise,
      permPromise,
      introTTSPromise,
    ]);

    console.log('[CookAlong] Startup gates done in', Date.now() - tapTime, 'ms');
    console.log('[CookAlong] Results — health:', healthOk, 'perm:', permGranted, 'intro:', !!introUri);

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

    console.log('[CookAlong] Launching loop with intro ready, step1 will be fetched after intro plays. Total setup:', Date.now() - tapTime, 'ms');
    void runCookAlongLoop(0, introUri);
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
