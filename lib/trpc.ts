import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import { Platform } from "react-native";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

export function getBackendBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    console.log('[getBackendBaseUrl] Web: using window.location.origin:', origin);
    return origin;
  }

  const envUrl = (process.env.EXPO_PUBLIC_RORK_API_BASE_URL ?? '').trim();
  if (envUrl) {
    if (envUrl.includes('rorktest.dev')) {
      console.warn('[getBackendBaseUrl] Rejecting stale rorktest.dev URL:', envUrl);
    } else {
      console.log('[getBackendBaseUrl] Native: using EXPO_PUBLIC_RORK_API_BASE_URL:', envUrl);
      return envUrl;
    }
  }

  console.warn('[getBackendBaseUrl] No valid backend URL available. EXPO_PUBLIC_RORK_API_BASE_URL:', envUrl || '(empty)');
  return '';
}

const getBaseUrl = () => {
  const url = getBackendBaseUrl();
  if (url) {
    console.log('🌐 tRPC Base URL:', url);
    return url;
  }
  console.warn('⚠️ Backend base URL not resolved. tRPC backend may be unavailable.');
  return null;
};

const baseUrl = getBaseUrl();

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: baseUrl ? `${baseUrl}/api/trpc` : 'http://localhost:3000/api/trpc',
      transformer: superjson,
      fetch: async (url, options) => {
        if (!baseUrl) {
          console.warn('Backend is not configured. tRPC calls will fail gracefully.');
          return new Response(
            JSON.stringify({ error: 'Backend not configured' }),
            { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }

        console.log('🌐 tRPC fetch request:', { 
          url: typeof url === 'string' ? url : String(url as unknown as string), 
          method: options?.method,
        });

        try {
          const response = await fetch(url, options);
          
          const clonedResponse = response.clone();
          const responseText = await clonedResponse.text();
          
          console.log('🌐 tRPC fetch response:', { 
            status: response.status, 
            statusText: response.statusText,
            contentType: response.headers.get('content-type'),
            bodyPreview: responseText.substring(0, 200)
          });
          
          return response;
        } catch (error) {
          console.error('🌐 tRPC fetch error:', error);
          return new Response(
            JSON.stringify({ error: 'Backend unavailable' }),
            { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      },
    }),
  ],
});
