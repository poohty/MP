export function redirectSystemPath({
  path,
}: { path: string; initial: boolean }) {
  if (path.includes('auth-callback')) {
    const url = path.startsWith('http') ? new URL(path) : null;
    const params = url ? url.searchParams : null;
    const access_token = params?.get('access_token') || '';
    const refresh_token = params?.get('refresh_token') || '';
    const token_hash = params?.get('token_hash') || '';
    const type = params?.get('type') || '';
    const error = params?.get('error') || '';
    const error_description = params?.get('error_description') || '';

    const queryParts: string[] = [];
    if (access_token) queryParts.push(`access_token=${access_token}`);
    if (refresh_token) queryParts.push(`refresh_token=${refresh_token}`);
    if (token_hash) queryParts.push(`token_hash=${token_hash}`);
    if (type) queryParts.push(`type=${type}`);
    if (error) queryParts.push(`error=${encodeURIComponent(error)}`);
    if (error_description) queryParts.push(`error_description=${encodeURIComponent(error_description)}`);

    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return `/auth-callback${query}`;
  }

  if (path.includes('reset-password')) {
    const url = path.startsWith('http') ? new URL(path) : null;
    const params = url ? url.searchParams : null;
    const access_token = params?.get('access_token') || '';
    const refresh_token = params?.get('refresh_token') || '';
    if (access_token) {
      return `/reset-password?access_token=${access_token}&refresh_token=${refresh_token}`;
    }
    return '/reset-password';
  }

  return '/';
}
