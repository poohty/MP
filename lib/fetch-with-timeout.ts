// Observed hanging indefinitely (no error, no timeout) against toolkit.rork.com on the
// iOS 27 simulator specifically, while the identical request completed normally on iOS 26.5.
// A production network call must never be able to hang forever regardless of cause, so every
// call to that endpoint gets a hard timeout here instead of a bare `fetch`.
export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number = 20000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s: ${input}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
