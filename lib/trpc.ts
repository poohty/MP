import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import { Platform } from "react-native";
import Constants from "expo-constants";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

function resolveNativeHostUrl(): string {
  try {
    const debuggerHost =
      Constants.expoGoConfig?.debuggerHost ??
      (Constants as any).manifest?.debuggerHost ??
      null;
    if (debuggerHost) {
      const host = debuggerHost.split(':')[0];
      console.log('[getBackendBaseUrl] Native: resolved debuggerHost ->', debuggerHost, '-> host:', host);
      return `http://${host}:8081`;
    }

    const hostUri =
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
      (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
      (Constants.expoConfig as any)?.hostUri ??
      null;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      console.log('[getBackendBaseUrl] Native: resolved hostUri ->', hostUri, '-> host:', host);
      return `http://${host}:8081`;
    }
  } catch (e) {
    console.warn('[getBackendBaseUrl] Error reading Expo Constants:', e);
  }
  return '';
}

export function getBackendBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    console.log('[getBackendBaseUrl] Web: using window.location.origin:', origin);
    return origin;
  }

  const envUrl = (process.env.EXPO_PUBLIC_RORK_API_BASE_URL ?? '').trim();
  if (envUrl && !envUrl.includes('rorktest.dev')) {
    console.log('[getBackendBaseUrl] Native: using EXPO_PUBLIC_RORK_API_BASE_URL:', envUrl);
    return envUrl;
  }

  if (envUrl) {
    console.warn('[getBackendBaseUrl] Rejecting stale env URL:', envUrl);
  }

  const nativeHost = resolveNativeHostUrl();
  if (nativeHost) {
    console.log('[getBackendBaseUrl] Native: using Expo Constants host:', nativeHost);
    return nativeHost;
  }

  console.warn('[getBackendBaseUrl] No valid backend URL available.');
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
