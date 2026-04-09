/** Generic path normalization — ensures a leading slash, trims whitespace. */
export function normalizePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Path normalization for redirect targets.
 * Rejects protocol-relative URLs (//evil.example/…) — open redirect vector.
 */
export function normalizeRedirectPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("//")) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Alias for slugify — used for content post slugs. */
export const slugifyContent = slugify;

export function parseIdList(value: string | null | undefined): number[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry) && entry > 0);
  } catch {
    return [];
  }
}

export function serializeIdList(values: number[]) {
  return JSON.stringify(
    values.filter((entry) => Number.isInteger(entry) && entry > 0).sort((a, b) => a - b),
  );
}
