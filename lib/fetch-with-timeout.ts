// On iOS a request can hang indefinitely (no response, no error): seen against toolkit.rork.com on
// the iOS 27 simulator, and against Supabase when the app is brought back from the background by an
// email link. A production network call must never be able to hang forever, so every call gets a
// hard timeout here instead of a bare `fetch`.
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = 20000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  init.signal?.addEventListener('abort', () => controller.abort());
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError' && !init.signal?.aborted) {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
