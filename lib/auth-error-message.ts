import { supabase } from '@/lib/supabase';

// Supabase/native auth errors surface raw strings like
// "The network connection was lost" or ExpoModulesCore/Promise.swift traces —
// meaningless to a user. Map anything network-shaped to one friendly message.
export function isNetworkErrorMessage(raw: string | undefined | null): boolean {
  const msg = (raw ?? '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('connection') ||
    msg.includes('offline') ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('fetch failed')
  );
}

export function friendlyAuthErrorMessage(raw: string | undefined | null, fallback: string): string {
  if (isNetworkErrorMessage(raw)) {
    return 'Network connection issue. Please check your internet connection and try the link again.';
  }
  return raw || fallback;
}

// Auth deep links are opened right at cold app launch (tap email link in Mail/Safari ->
// fresh app process), when iOS's networking stack is sometimes not fully attached yet —
// the request fails with "network connection was lost" even though connectivity is fine
// a second later. Retry that one call a couple of times before surfacing an error.
//
// verifyOtp/exchangeCodeForSession tokens are single-use: if the first attempt actually
// succeeded server-side and only the response was lost on-device, blindly resending it
// would hit an already-used token and wrongly report "link expired". So before each
// retry, check whether a session already got established and short-circuit to success.
export async function withNetworkRetry<T extends { error: { message?: string } | null }>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1200
): Promise<T> {
  let result = await fn();
  let attempt = 1;
  while (result.error && isNetworkErrorMessage(result.error.message) && attempt < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const { data: existing } = await supabase.auth.getSession();
    if (existing?.session) {
      return { ...result, error: null } as T;
    }
    result = await fn();
    attempt += 1;
  }
  return result;
}
