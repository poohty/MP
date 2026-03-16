export function redirectSystemPath({
  path,
}: { path: string; initial: boolean }) {
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