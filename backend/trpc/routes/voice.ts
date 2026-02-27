// Requires backend env var ElevenLabs_API_Key
import { Hono } from "hono";

const voiceRoutes = new Hono();

const ELEVENLABS_API_KEY = () => process.env.ElevenLabs_API_Key;

function detectCommand(transcript: string): "STEP_COMPLETE" | "REPEAT_STEP" | "NONE" {
  const lower = transcript.toLowerCase();
  if (lower.includes("step complete")) return "STEP_COMPLETE";
  if (lower.includes("repeat step")) return "REPEAT_STEP";
  return "NONE";
}

voiceRoutes.get("/health", (c) => {
  return c.json({ ok: true });
});

voiceRoutes.post("/stt", async (c) => {
  const apiKey = ELEVENLABS_API_KEY();
  if (!apiKey) {
    return c.json({ error: "ElevenLabs_API_Key not set" }, 500);
  }

  try {
    const formData = await c.req.formData();
    const audioFile = formData.get("audio");
    if (!audioFile || !(audioFile instanceof File)) {
      return c.json({ error: "Missing 'audio' file field" }, 400);
    }

    const callerKeyterms = formData.get("keyterms");
    const baseKeyterms = ["step complete", "repeat step"];
    let mergedKeyterms = [...baseKeyterms];

    if (callerKeyterms && typeof callerKeyterms === "string") {
      const extra = callerKeyterms.split(",").map((k) => k.trim()).filter(Boolean);
      mergedKeyterms = [...new Set([...baseKeyterms, ...extra])];
    }

    const elevenLabsForm = new FormData();
    elevenLabsForm.append("file", audioFile, audioFile.name || "audio.webm");
    elevenLabsForm.append("model_id", "scribe_v1");

    if (mergedKeyterms.length > 0) {
      elevenLabsForm.append("keyterms", JSON.stringify(mergedKeyterms));
    }

    console.log("[voice/stt] Calling ElevenLabs Scribe API...");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: elevenLabsForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[voice/stt] ElevenLabs error:", response.status, errorText);
      return c.json({ error: `ElevenLabs STT error: ${errorText}` }, 502);
    }

    const result = await response.json() as { text?: string };
    const transcript = result.text ?? "";
    const command = detectCommand(transcript);

    console.log("[voice/stt] Transcript:", transcript, "| Command:", command);

    return c.json({ transcript, command });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[voice/stt] Unexpected error:", message);
    return c.json({ error: message }, 500);
  }
});

voiceRoutes.post("/tts", async (c) => {
  const apiKey = ELEVENLABS_API_KEY();
  if (!apiKey) {
    return c.json({ error: "ElevenLabs_API_Key not set" }, 500);
  }

  try {
    const body = await c.req.json<{ text?: string; voiceId?: string }>();
    const { text, voiceId } = body;

    if (!text || !voiceId) {
      return c.json({ error: "Missing 'text' or 'voiceId' in request body" }, 400);
    }

    console.log("[voice/tts] Calling ElevenLabs TTS for voice:", voiceId);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          output_format: "mp3_44100_128",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[voice/tts] ElevenLabs error:", response.status, errorText);
      return c.json({ error: `ElevenLabs TTS error: ${errorText}` }, 502);
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[voice/tts] Unexpected error:", message);
    return c.json({ error: message }, 500);
  }
});

export { voiceRoutes };
