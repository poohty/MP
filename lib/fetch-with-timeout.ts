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

// toolkit.rork.com answers the same request in anywhere from ~7s to 60s+ (and sometimes not at all), so a
// single short attempt fails often. Two patient attempts before giving up fixes most of those failures.
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = 45000,
  attempts: number = 2
): Promise<Response> {
  let lastError: unknown = new Error('Request failed');
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchWithTimeout(input, init, timeoutMs);
      if (response.status < 500) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    console.log(`[fetchWithRetry] attempt ${attempt}/${attempts} failed:`, lastError);
  }
  throw lastError;
}
