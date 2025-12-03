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
