import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
    console.log('🌐🌐🌐 ========================================');
    console.log('🌐 tRPC CONFIGURATION');
    console.log('🌐 Base URL:', url);
    console.log('🌐 Full tRPC URL:', `${url}/api/trpc`);
    console.log('🌐🌐🌐 ========================================');
    return url;
  }
  console.warn('⚠️⚠️⚠️ EXPO_PUBLIC_RORK_API_BASE_URL is NOT set. tRPC backend may be unavailable.');
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
          url: String(url), 
          method: options?.method,
          body: options?.body ? String(options.body).substring(0, 200) : 'none'
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
