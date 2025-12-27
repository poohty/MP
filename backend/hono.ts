import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

export const BACKEND_INSTANCE_ID = Math.random().toString(36).slice(2);
export const BACKEND_START_TIME = new Date().toISOString();

console.log('🚀🚀🚀 ======== BACKEND INSTANCE STARTING ======== ');
console.log('🚀 Backend Instance ID:', BACKEND_INSTANCE_ID);
console.log('🚀 Backend Start Time:', BACKEND_START_TIME);
console.log('🚀 Process PID:', process.pid);
console.log('🚀🚀🚀 ============================================= ');

const app = new Hono();

app.use("*", cors());

app.post("/voice/tts", async (c) => {
  // Requires OPENAI_API_KEY env var in Rork environment variables.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return c.json({ error: "Missing OPENAI_API_KEY" }, 500);
  }

  try {
    const body = (await c.req.json()) as {
      text?: unknown;
      variant?: unknown;
    };

    const text = typeof body.text === "string" ? body.text : "";
    const variant = body.variant;

    if (!text.trim()) {
      return c.json({ error: "Missing text" }, 400);
    }

    const variantStr =
      variant === "female" || variant === "male" || variant === "neutral"
        ? variant
        : "neutral";

    const voice =
      variantStr === "female"
        ? "shimmer"
        : variantStr === "male"
          ? "onyx"
          : "alloy";

    console.log("🔊 /voice/tts request", {
      textLength: text.length,
      variant: variantStr,
      voice,
    });

    const openAiRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice,
        response_format: "mp3",
        input: text,
      }),
    });

    if (!openAiRes.ok) {
      const errText = await openAiRes.text().catch(() => "");
      console.error("🔊 /voice/tts OpenAI error", {
        status: openAiRes.status,
        statusText: openAiRes.statusText,
        bodyPreview: errText.slice(0, 300),
      });
      return c.json({ error: "OpenAI TTS failed" }, 502);
    }

    const arrayBuffer = await openAiRes.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");

    return c.json({ audioBase64, mime: "audio/mpeg" });
  } catch (error) {
    console.error("🔊 /voice/tts route error", error);
    return c.json({ error: "Failed to generate audio" }, 500);
  }
});

app.get("/api/trpc/health", (c) => {
  return c.json({ 
    status: "ok", 
    message: "tRPC is mounted at /api/trpc",
    instanceId: BACKEND_INSTANCE_ID,
    startTime: BACKEND_START_TIME,
    pid: process.pid,
  });
});

app.use(
  "/api/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
    endpoint: "/api/trpc",
  })
);

app.get("/", (c) => {
  return c.json({ 
    status: "ok", 
    message: "API is running",
    instanceId: BACKEND_INSTANCE_ID,
    startTime: BACKEND_START_TIME,
    pid: process.pid,
  });
});

export default app;
