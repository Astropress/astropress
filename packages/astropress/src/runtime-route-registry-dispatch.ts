import { loadLocalCmsRegistry } from "./local-runtime-modules";
import { getCmsConfig } from "./config";

export interface RuntimeSystemRouteRecord {
  path: string;
  title: string;
  summary?: string;
  bodyHtml?: string;
  renderStrategy: "structured_sections" | "generated_text" | "generated_xml";
  settings: Record<string, unknown> | null;
  updatedAt?: string;
}

export interface RuntimeArchiveRouteRecord {
  path: string;
  title: string;
  summary?: string;
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrlOverride?: string;
  robotsDirective?: string;
  updatedAt?: string;
}

export interface RuntimeStructuredPageRouteRecord {
  path: string;
  title: string;
  summary?: string;
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrlOverride?: string;
  robotsDirective?: string;
  ogImage?: string;
  templateKey: string;
  alternateLinks: Array<{ hreflang: string; href: string }>;
  sections: Record<string, unknown> | null;
  updatedAt?: string;
}

export async function loadSafeLocalCmsRegistry() {
  try {
    return await loadLocalCmsRegistry();
  } catch {
    return null;
  }
}

export async function withSafeRouteRegistryFallback<T>(
  fallback: (local: NonNullable<Awaited<ReturnType<typeof loadSafeLocalCmsRegistry>>>) => Promise<T> | T,
  defaultValue: T,
  operation: () => Promise<T>,
) {
  try {
    return await operation();
  /* v8 ignore start */
  } catch {
    const local = await loadSafeLocalCmsRegistry();
    if (local) {
      return await fallback(local);
    }

    return defaultValue;
  }
  /* v8 ignore stop */
}

export function parseSettings(value: string | null) {
  if (!value) {
    return null;
  }

  /* v8 ignore start */
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
  /* v8 ignore stop */
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
  return locales[0] ?? "en";
}
