export function parseTimeout(value: string | undefined): number {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isNaN(parsed) || parsed < 1000) {
    return 30000;
  }
  if (parsed > 120000) {
    return 120000;
  }
  return parsed;
}

export function normalizeApiBaseUrl(
  rawBaseUrl: string | undefined,
  fallbackOrigin: string
): string {
  const configured = (rawBaseUrl || '').trim();
  if (!configured) {
    return `${fallbackOrigin.replace(/\/+$/, '')}/api`;
  }

  const withoutTrailingSlash = configured.replace(/\/+$/, '');
  if (withoutTrailingSlash.endsWith('/api')) {
    return withoutTrailingSlash;
  }
  return `${withoutTrailingSlash}/api`;
}
