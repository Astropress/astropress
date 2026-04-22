function parseUrl(value: string | null | undefined, baseUrl: URL): URL | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, baseUrl);
  } catch {
    return null;
  }
}

export function resolveSafeAdminHref(
  baseUrl: URL,
  value: string | null | undefined,
  allowedPaths: string[],
): string | null {
  const parsed = parseUrl(value, baseUrl);
  if (!parsed || parsed.origin !== baseUrl.origin) return null;
  if (!allowedPaths.includes(parsed.pathname)) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
