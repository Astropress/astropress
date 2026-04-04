import { getCmsConfig } from "./config";
import { isPublishedTranslationState } from "./translation-state";

interface TranslationStatusRecord {
  route: string;
  locale: string;
  englishSourceUrl: string;
  translationState: string;
}

interface AlternateLink {
  href: string;
  hreflang: string;
}

export function getAlternateLinksForEnglishRoute(legacyUrl: string) {
  const translationStatus = getCmsConfig().translationStatus as TranslationStatusRecord[];
  const translation = translationStatus.find(
    (entry) => entry.locale === "es" && isPublishedTranslationState(entry.translationState) && entry.englishSourceUrl === legacyUrl,
  );

  if (!translation) {
    return [];
  }

  return [
    { hreflang: "en", href: canonicalUrlForRoute(legacyUrl) },
    { hreflang: "es", href: canonicalUrlForRoute(translation.route) },
  ];
}

export function canonicalUrlForRoute(route: string) {
  const siteUrl = getCmsConfig().siteUrl.replace(/\/$/, "");
  return `${siteUrl}${route === "/" ? "/" : `${route}/`}`;
}

export function sanitizeCanonicalUrl(value: string | undefined, fallbackRoute: string) {
  if (!value) {
    return canonicalUrlForRoute(fallbackRoute);
  }

  const parsed = new URL(value);
  parsed.search = "";
  parsed.hash = "";

  const normalizedPath = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/?$/, "/");
  parsed.pathname = normalizedPath;

  return parsed.toString();
}

function pathFromHref(value: string) {
  try {
    const parsed = new URL(value);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return value;
  }
}

function isLocalePath(path: string, locale: "en" | "es") {
  if (locale === "es") {
    return path === "/es" || path.startsWith("/es/");
  }

  return !path.startsWith("/es/");
}

export function getLocaleSwitchTargets(input: {
  lang: "en" | "es";
  currentPath?: string;
  alternateLinks?: AlternateLink[];
}) {
  const targets = {
    en: "/en",
    es: "/es",
  };

  if (input.currentPath && isLocalePath(input.currentPath, input.lang)) {
    targets[input.lang] = input.currentPath;
  }

  for (const link of input.alternateLinks ?? []) {
    if (link.hreflang !== "en" && link.hreflang !== "es") {
      continue;
    }

    const path = pathFromHref(link.href);
    targets[link.hreflang] = link.hreflang === "en" && path === "/" && input.lang === "es" ? "/en" : path;
  }

  return targets;
}
