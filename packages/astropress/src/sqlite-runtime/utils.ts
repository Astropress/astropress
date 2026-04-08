import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { getCmsConfig } from "../config";

type ContentStatus = "draft" | "review" | "published" | "archived";

interface SqliteStatementLike {
  run(...params: unknown[]): { changes?: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface AstropressSqliteDatabaseLike {
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

export function localeFromPath(pathname: string) {
  return pathname.startsWith("/es/") ? "es" : "en";
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
