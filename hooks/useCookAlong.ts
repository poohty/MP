import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';

function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ?? '';
  return url.trim();
}
const DEFAULT_VOICE_ID = 'Cz0K1kOv9tD8l0b5Qu53';
const RECORD_DURATION_MS = 3000;

type VoiceCommand = 'STEP_COMPLETE' | 'REPEAT_STEP' | 'NONE';

interface CookAlongState {
  cookAlongActive: boolean;
  currentStepIndex: number;
  isListening: boolean;
  isSpeaking: boolean;
  lastTranscript: string;
}

async function speakText(text: string, soundRef: React.MutableRefObject<Audio.Sound | null>, voiceId: string): Promise<void> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    console.log('[CookAlong] TTS: no API base URL found');
    throw new Error('Backend not configured');
  }

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    playThroughEarpieceAndroid: false,
    shouldDuckAndroid: false,
  });

  console.log('[CookAlong] Calling TTS at:', `${apiBase}/api/voice/tts`);
  const response = await fetch(`${apiBase}/api/voice/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.log('[CookAlong] TTS error:', response.status, errText);
    throw new Error(`TTS failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  const uri = `data:audio/mpeg;base64,${base64}`;

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
  const apiBase = getApiBaseUrl();
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

export function useCookAlong(instructions: string[], userVoiceId?: string | null) {
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
  const resolvedVoiceId = userVoiceId || DEFAULT_VOICE_ID;

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
  }, [resolvedVoiceId]);

  const runCookAlongLoop = useCallback(async (startIndex: number) => {
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;

    let stepIdx = startIndex;
    const reminderLine = "Say 'Step Complete' for the next step, or 'Repeat Step' to hear this step again.";

    try {
      await safeSpeakText(
        "So you're ready to start making this recipe? Let's start with step one."
      );

      if (!activeRef.current) return;

      await safeSpeakText(instructions[stepIdx] || 'No instruction available.');
      if (!activeRef.current) return;

      await safeSpeakText(reminderLine);

      while (activeRef.current && stepIdx < instructions.length) {
        if (!activeRef.current) break;

        const { command } = await safeListenForCommand();

        if (!activeRef.current) break;

        if (command === 'REPEAT_STEP') {
          await safeSpeakText(instructions[stepIdx] || '');
          if (!activeRef.current) break;
          await safeSpeakText(reminderLine);
        } else if (command === 'STEP_COMPLETE') {
          setState((prev) => ({ ...prev, currentStepIndex: stepIdx }));

          if (stepIdx >= instructions.length - 1) {
            await safeSpeakText("Awesome, hope you enjoy your meal.");
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
            await safeSpeakText(`Step ${stepIdx + 1}. ${instructions[stepIdx] || ''}`);
            if (!activeRef.current) break;
            await safeSpeakText(reminderLine);
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
  }, [instructions, safeSpeakText, safeListenForCommand]);

  const startCookAlong = useCallback(async () => {
    const apiBase = getApiBaseUrl();
    console.log('[CookAlong] startCookAlong called. API base URL:', JSON.stringify(apiBase));
    if (!apiBase) {
      Alert.alert('Voice feature unavailable', 'Please try again later.');
      return;
    }

    try {
      const healthCheck = await fetch(`${apiBase}/api/voice/health`, { method: 'GET' });
      console.log('[CookAlong] Health check status:', healthCheck.status);
      if (!healthCheck.ok) {
        Alert.alert('Voice feature unavailable', 'Voice server is not responding. Please try again later.');
        return;
      }
    } catch (e) {
      console.log('[CookAlong] Health check failed:', e);
      Alert.alert('Voice feature unavailable', 'Cannot reach voice server. Please try again later.');
      return;
    }

    if (instructions.length === 0) {
      Alert.alert('No Instructions', 'This recipe has no instructions to read aloud.');
      return;
    }

    if (Platform.OS !== 'web') {
      const permResult = await Audio.requestPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permission Required', 'Microphone access is needed for hands-free cooking.');
        return;
      }
    }

    activeRef.current = true;
    setState({
      cookAlongActive: true,
      currentStepIndex: 0,
      isListening: false,
      isSpeaking: false,
      lastTranscript: '',
    });

    runCookAlongLoop(0);
  }, [instructions, runCookAlongLoop]);

  const stopCookAlong = useCallback(async () => {
    await cleanup();
  }, [cleanup]);

  return {
    ...state,
    startCookAlong,
    stopCookAlong,
  };
}
