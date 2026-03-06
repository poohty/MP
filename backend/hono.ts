import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { voiceRoutes } from "./trpc/routes/voice";

export const BACKEND_INSTANCE_ID = Math.random().toString(36).slice(2);
export const BACKEND_START_TIME = new Date().toISOString();

console.log('🚀🚀🚀 ======== BACKEND INSTANCE STARTING ======== ');
console.log('🚀 Backend Instance ID:', BACKEND_INSTANCE_ID);
console.log('🚀 Backend Start Time:', BACKEND_START_TIME);
console.log('🚀 Process PID:', process.pid);
console.log('🚀🚀🚀 ============================================= ');

const app = new Hono();

app.use("*", cors());

app.get("/trpc/health", (c) => {
  return c.json({ 
    status: "ok", 
    message: "tRPC is mounted at /api/trpc",
    instanceId: BACKEND_INSTANCE_ID,
    startTime: BACKEND_START_TIME,
    pid: process.pid,
  });
});

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
    endpoint: "/api/trpc",
  })
);

app.get("/_debug/ping", (c) => {
  return c.json({ ok: true, source: "backend/hono.ts", time: new Date().toISOString() });
});

app.route("/voice", voiceRoutes);
console.log("✅ voice routes mounted at /voice (served at /api/voice)");

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
