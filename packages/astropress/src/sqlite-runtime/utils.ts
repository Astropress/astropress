import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { getCmsConfig } from "../config";

type ContentStatus = "draft" | "review" | "published" | "archived";

interface SqliteStatementLike {
  run(...params: unknown[]): { changes?: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface AstropressSqliteDatabaseLike {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatementLike;
}

export interface PageRecord {
  slug: string;
  legacyUrl: string;
  title: string;
  templateKey: string;
  listingItems: Array<{
    title: string;
    href: string;
    excerpt: string;
    imageSrc: string;
    imageAlt: string;
  }>;
  paginationLinks: Array<{
    label: string;
    href: string;
    current: boolean;
  }>;
  sourceHtmlPath: string;
  updatedAt: string;
  body?: string;
  summary?: string;
  seoTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrlOverride?: string;
  robotsDirective?: string;
  kind?: string;
  status?: ContentStatus;
}

export function normalizeStructuredTemplateKey(value: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }
  try {
    return getCmsConfig().templateKeys.includes(value) ? value : null;
  } catch {
    return null;
  }
}

export function localeFromPath(pathname: string): string {
  let locales: readonly string[];
  try {
    locales = getCmsConfig().locales ?? ["en", "es"];
  } catch {
    locales = ["en", "es"];
  }
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`)) return locale;
  }
  // Default to the first locale (usually "en"), or "en" if the list is empty.
  return locales[0] ?? "en";
}

/**
 * Negotiate a locale from an `Accept-Language` request header against the
 * configured `locales` list (or the default `["en", "es"]` fallback).
 *
 * Returns the best-matching locale string, or the first configured locale when
 * no match is found.
 *
 * @example
 * ```ts
 * // Accept-Language: fr-CH, fr;q=0.9, en;q=0.8
 * localeFromAcceptLanguage("fr-CH, fr;q=0.9, en;q=0.8"); // "en" (if locales = ["en","es"])
 * localeFromAcceptLanguage("es;q=0.9, en;q=0.8");          // "es" (if locales = ["en","es"])
 * ```
 */
export function localeFromAcceptLanguage(acceptLanguage: string | null | undefined): string {
  let locales: readonly string[];
  try {
    locales = getCmsConfig().locales ?? ["en", "es"];
  } catch {
    locales = ["en", "es"];
  }

  if (!acceptLanguage) return locales[0] ?? "en";

  // Parse "lang-region;q=weight" entries, sorted by weight descending.
  const entries = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, qPart] = part.trim().split(";");
      const q = qPart ? Number(qPart.trim().replace("q=", "")) : 1;
      return { tag: (tag ?? "").trim().toLowerCase(), q: Number.isFinite(q) ? q : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of entries) {
    // Match exact locale or language prefix (e.g. "fr-CH" matches "fr")
    const matched = locales.find(
      (l) => l.toLowerCase() === tag || tag.startsWith(`${l.toLowerCase()}-`),
    );
    if (matched) return matched;
  }

  return locales[0] ?? "en";
}

export function getSeedPageRecords(): PageRecord[] {
  try {
    return getCmsConfig().seedPages as unknown as PageRecord[];
  } catch {
    return [];
  }
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPasswordSync(password: string, iterations = 100_000) {
  const salt = randomBytes(32);
  const derived = pbkdf2Sync(password, salt, iterations, 64, "sha256");
  return `${iterations}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPasswordSync(password: string, storedHash: string) {
  const [iterationsText, saltText, hashText] = storedHash.split("$");
  const iterations = Number.parseInt(iterationsText, 10);

  if (!iterations || !saltText || !hashText) {
    return false;
  }

  const salt = Buffer.from(saltText, "base64");
  const expected = Buffer.from(hashText, "base64");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, "sha256");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function normalizePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function slugifyTerm(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeContentStatus(input?: string | null): ContentStatus {
  if (input === "draft" || input === "review" || input === "archived" || input === "published") {
    return input;
  }
  return "published";
}

export function parseIdList(value: string | null | undefined) {
  if (!value) {
    return [] as number[];
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

export function serializeIdList(values: number[] | undefined) {
  return JSON.stringify(
    (values ?? []).filter((entry) => Number.isInteger(entry) && entry > 0).sort((a, b) => a - b),
  );
}

export function parseSystemSettings(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function normalizeSystemRoutePath(pathname: string) {
  const trimmed = pathname.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
