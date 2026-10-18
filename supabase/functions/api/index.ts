// Voice proxy — mirrors backend/trpc/routes/voice.ts, ported to run as a
// Supabase Edge Function (Deno) instead of the Hono/Bun server.
// Supabase strips "/functions/v1" but keeps the function-name segment, so
// the app's `${apiBase}/api/voice/tts` calls need basePath("/api") here,
// with apiBase = https://<project-ref>.supabase.co/functions/v1
import { Hono } from "npm:hono@4";
import { cors } from "npm:hono@4/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const ELEVENLABS_API_KEY = () => Deno.env.get("ELEVENLABS_API_KEY");

function detectCommand(transcript: string): "STEP_COMPLETE" | "REPEAT_STEP" | "NONE" {
  const lower = transcript.toLowerCase();
  if (lower.includes("step complete")) return "STEP_COMPLETE";
  if (lower.includes("repeat step")) return "REPEAT_STEP";
  return "NONE";
}

const app = new Hono().basePath("/api");

app.use("*", cors());

app.get("/voice/health", (c) => c.json({ ok: true }));

app.post("/voice/stt", async (c) => {
  const apiKey = ELEVENLABS_API_KEY();
  if (!apiKey) {
    return c.json({ error: "ELEVENLABS_API_KEY not set" }, 500);
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
    elevenLabsForm.append("model_id", "scribe_v2");

    for (const term of mergedKeyterms) {
      elevenLabsForm.append("keyterms", term);
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
      let parsedError: string = errorText;
      let param: string | undefined;
      try {
        const errJson = JSON.parse(errorText);
        parsedError = errJson?.detail?.message || errJson?.detail || errorText;
        param = errJson?.detail?.param;
      } catch {
        // errorText wasn't JSON — keep the raw text as parsedError.
      }
      return c.json({ error: `ElevenLabs STT error: ${parsedError}`, param, raw: errorText }, 502);
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

app.post("/voice/tts", async (c) => {
  const apiKey = ELEVENLABS_API_KEY();
  if (!apiKey) {
    console.error("[voice/tts] ELEVENLABS_API_KEY not set");
    return c.json({ error: "ELEVENLABS_API_KEY not set" }, 500);
  }

  try {
    const body = await c.req.json<{ text?: string; voiceId?: string }>();
    const { text, voiceId } = body;

    if (!text || !voiceId) {
      console.log("[voice/tts] Missing fields - text:", !!text, "voiceId:", !!voiceId);
      return c.json({ error: "Missing 'text' or 'voiceId' in request body" }, 400);
    }

    console.log("[voice/tts] Calling ElevenLabs TTS for voice:", voiceId, "| text length:", text.length);

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
          model_id: "eleven_turbo_v2_5",
          output_format: "mp3_22050_32",
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

// Gmail strips custom-scheme links (mealplannerroulette://) out of emails, so the password-reset
// email links here over https and this bounces into the app, like Supabase's own /verify redirect.
// The token is passed through unused — the app verifies it. Destination is fixed: no open redirect.
app.get("/auth/reset-password", (c) => {
  const tokenHash = c.req.query("token_hash") ?? "";
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(tokenHash)) return c.text("This reset link is invalid.", 400);
  return c.redirect(
    `mealplannerroulette://reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`,
    302,
  );
});

// One free 7-day week per account, granted as a RevenueCat promotional entitlement. It never touches the
// App Store / Google Play, so no payment method is attached and nothing is charged when it ends.
// "Used before" is read from RevenueCat itself (paid, store trial or an earlier free week all leave a
// record there), keyed by the same Supabase user id the app logs into RevenueCat with.
const RC_API = "https://api.revenuecat.com/v1";
const PRO_ENTITLEMENT = "Meal Planner Roulette Pro";
const DEFAULT_TRIAL_MINUTES = 7 * 24 * 60;

// Test builds can shorten the free week with the TRIAL_DURATION_MINUTES secret; unset = 7 days.
// Read per request so changing the secret needs no redeploy or app rebuild.
function trialMinutes(): number {
  const minutes = Number(Deno.env.get("TRIAL_DURATION_MINUTES"));
  return Number.isFinite(minutes) && minutes >= 1 ? minutes : DEFAULT_TRIAL_MINUTES;
}

app.post("/trial/start", async (c) => {
  const token = (c.req.header("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return c.json({ error: "Missing bearer token" }, 401);

  const rcKey = Deno.env.get("REVENUECAT_SECRET_KEY");
  if (!rcKey) {
    console.error("[trial/start] REVENUECAT_SECRET_KEY not set");
    return c.json({ error: "Free trial is unavailable right now" }, 500);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return c.json({ error: "Invalid session" }, 401);

  const headers = { Authorization: `Bearer ${rcKey}`, "Content-Type": "application/json" };
  const customerUrl = `${RC_API}/subscribers/${encodeURIComponent(data.user.id)}`;

  try {
    const lookup = await fetch(customerUrl, { headers, signal: AbortSignal.timeout(10000) });
    if (!lookup.ok) {
      console.error("[trial/start] RevenueCat lookup failed:", lookup.status);
      return c.json({ error: "Could not start your free trial. Please try again." }, 502);
    }
    const { subscriber } = await lookup.json() as {
      subscriber?: { entitlements?: object; subscriptions?: object; non_subscriptions?: object };
    };
    const everHadAccess = [subscriber?.entitlements, subscriber?.subscriptions, subscriber?.non_subscriptions]
      .some((record) => Object.keys(record ?? {}).length > 0);
    if (everHadAccess) return c.json({ error: "Free trial already used" }, 409);

    const minutes = trialMinutes();
    const endsAt = Date.now() + minutes * 60 * 1000;
    const grant = await fetch(
      `${customerUrl}/entitlements/${encodeURIComponent(PRO_ENTITLEMENT)}/promotional`,
      { method: "POST", headers, body: JSON.stringify({ end_time_ms: endsAt }), signal: AbortSignal.timeout(10000) },
    );
    if (!grant.ok) {
      console.error("[trial/start] RevenueCat grant failed:", grant.status, await grant.text());
      return c.json({ error: "Could not start your free trial. Please try again." }, 502);
    }

    console.log("[trial/start] granted", minutes, "minutes to", data.user.id);
    return c.json({ ok: true, endsAt });
  } catch (err) {
    console.error("[trial/start] unexpected error:", err instanceof Error ? err.message : String(err));
    return c.json({ error: "Could not start your free trial. Please try again." }, 502);
  }
});

// Permanent account deletion (Apple guideline 5.1.1(v)). The client can't delete an auth user, so this
// verifies the caller's own JWT and removes them with the service role. Recipes, profile and outgoing
// friend links cascade from auth.users; incoming links (friend_user_id has no FK) are removed explicitly.
app.post("/account/delete", async (c) => {
  const token = (c.req.header("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return c.json({ error: "Missing bearer token" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return c.json({ error: "Invalid session" }, 401);
  const userId = data.user.id;

  const { error: linkErr } = await admin.from("friend_links").delete().eq("friend_user_id", userId);
  if (linkErr) {
    console.error("[account/delete] friend_links cleanup failed:", linkErr.message);
    return c.json({ error: "Could not remove friend links" }, 500);
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error("[account/delete] deleteUser failed:", delErr.message);
    return c.json({ error: "Could not delete account" }, 500);
  }

  console.log("[account/delete] deleted user", userId);
  return c.json({ ok: true });
});

Deno.serve(app.fetch);
