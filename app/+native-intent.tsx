function extractParams(path: string): URLSearchParams {
  try {
    if (path.startsWith('http')) {
      const url = new URL(path);
      const combined = new URLSearchParams(url.search);
      if (url.hash) {
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
        hashParams.forEach((v, k) => { if (!combined.has(k)) combined.set(k, v); });
      }
      return combined;
    }

    const hashIdx = path.indexOf('#');
    const qIdx = path.indexOf('?');

    const combined = new URLSearchParams();

    if (qIdx !== -1) {
      const end = hashIdx !== -1 && hashIdx > qIdx ? hashIdx : undefined;
      const qs = path.substring(qIdx + 1, end);
      new URLSearchParams(qs).forEach((v, k) => combined.set(k, v));
    }

    if (hashIdx !== -1) {
      const fragment = path.substring(hashIdx + 1);
      new URLSearchParams(fragment).forEach((v, k) => { if (!combined.has(k)) combined.set(k, v); });
    }

    return combined;
  } catch (e) {
    console.warn('⚠️ native-intent extractParams error:', e);
    return new URLSearchParams();
  }
}

export function redirectSystemPath({
  path,
}: { path: string; initial: boolean }) {
  console.log('🔗 native-intent received path:', path);

  if (path.includes('auth-callback')) {
    const params = extractParams(path);
    const access_token = params.get('access_token') || '';
    const refresh_token = params.get('refresh_token') || '';
    const token_hash = params.get('token_hash') || '';
    const type = params.get('type') || '';
    const error = params.get('error') || '';
    const error_description = params.get('error_description') || '';
    const code = params.get('code') || '';

    const queryParts: string[] = [];
    if (access_token) queryParts.push(`access_token=${access_token}`);
    if (refresh_token) queryParts.push(`refresh_token=${refresh_token}`);
    if (token_hash) queryParts.push(`token_hash=${token_hash}`);
    if (type) queryParts.push(`type=${type}`);
    if (code) queryParts.push(`code=${code}`);
    if (error) queryParts.push(`error=${encodeURIComponent(error)}`);
    if (error_description) queryParts.push(`error_description=${encodeURIComponent(error_description)}`);

    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    console.log('🔗 native-intent routing to /auth-callback', query);
    return `/auth-callback${query}`;
  }

  if (path.includes('reset-password')) {
    const params = extractParams(path);
    const access_token = params.get('access_token') || '';
    const refresh_token = params.get('refresh_token') || '';
    const code = params.get('code') || '';

    const queryParts: string[] = [];
    if (access_token) queryParts.push(`access_token=${access_token}`);
    if (refresh_token) queryParts.push(`refresh_token=${refresh_token}`);
    if (code) queryParts.push(`code=${code}`);

    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    console.log('🔗 native-intent routing to /reset-password', query);
    return `/reset-password${query}`;
  }

  return path;
}
