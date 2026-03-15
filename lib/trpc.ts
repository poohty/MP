import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import { Platform } from "react-native";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

export function getBackendBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  const envUrl = (process.env.EXPO_PUBLIC_RORK_API_BASE_URL ?? '').trim();
  if (envUrl) {
    return envUrl;
  }

  console.warn('[getBackendBaseUrl] EXPO_PUBLIC_RORK_API_BASE_URL is not set');
  return '';
}

const TRPC_PLACEHOLDER_URL = 'http://localhost:3000/api/trpc';

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: TRPC_PLACEHOLDER_URL,
      transformer: superjson,
      fetch: async (input, options) => {
        const base = getBackendBaseUrl();
        if (!base) {
          console.warn('Backend is not configured. tRPC calls will fail gracefully.');
          return new Response(
            JSON.stringify({ error: 'Backend not configured' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const originalUrl = typeof input === 'string' ? input : (input as Request).url;
        const resolvedUrl = originalUrl.replace(TRPC_PLACEHOLDER_URL, `${base}/api/trpc`);

        try {
          const response = await fetch(resolvedUrl, options);
          return response;
        } catch (error) {
          console.error('tRPC fetch error:', error);
          return new Response(
            JSON.stringify({ error: 'Backend unavailable' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        }
      },
    }),
  ],
});
