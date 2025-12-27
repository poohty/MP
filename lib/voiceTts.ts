import * as FileSystem from "expo-file-system";

export type VoiceVariant = "female" | "male" | "neutral";

export function getBackendBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (url) {
    console.log("🔊 voiceTts backend baseUrl", { url });
    return url;
  }

  console.warn(
    "🔊 voiceTts EXPO_PUBLIC_RORK_API_BASE_URL is not set. Falling back to localhost."
  );
  return "http://localhost:3000";
}

function normalizeTextForTts(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function fetchTtsAudioFile(
  text: string,
  variant: VoiceVariant
): Promise<string> {
  const baseUrl = getBackendBaseUrl();
  const cleanText = normalizeTextForTts(text);

  console.log("🔊 fetchTtsAudioFile", {
    variant,
    textLength: cleanText.length,
  });

  const res = await fetch(`${baseUrl}/voice/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: cleanText,
      variant,
    }),
  });

  if (!res.ok) {
    let errText = "";
    let errJson: any = null;
    
    try {
      errText = await res.text();
      try {
        errJson = JSON.parse(errText);
      } catch {}
    } catch {}
    
    const errorMsg = errJson?.error || errText || res.statusText;
    
    console.error("❌ fetchTtsAudioFile backend error", {
      status: res.status,
      statusText: res.statusText,
      errorMsg,
      url: `${baseUrl}/voice/tts`,
    });
    
    throw new Error(`TTS request failed (${res.status}): ${errorMsg}`);
  }

  const json = (await res.json()) as {
    audioBase64?: unknown;
    mime?: unknown;
  };

  const audioBase64 =
    typeof json.audioBase64 === "string" ? json.audioBase64 : "";

  if (!audioBase64) {
    console.error("❌ fetchTtsAudioFile invalid response", {
      hasAudioBase64: !!json.audioBase64,
      mime: json.mime,
      responseKeys: Object.keys(json),
    });
    throw new Error("TTS_INVALID_RESPONSE");
  }

  const cacheDir = (FileSystem as unknown as { cacheDirectory?: string | null })
    .cacheDirectory;
  const docDir = (FileSystem as unknown as { documentDirectory?: string | null })
    .documentDirectory;

  const dir = cacheDir ?? docDir;
  if (!dir) {
    throw new Error("NO_FILE_SYSTEM_DIR");
  }

  const fileUri = `${dir}tts_${Date.now()}.mp3`;

  await FileSystem.writeAsStringAsync(fileUri, audioBase64, {
    encoding: "base64" as any,
  });

  console.log("🔊 fetchTtsAudioFile wrote file", { fileUri });

  return fileUri;
}
