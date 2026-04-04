import { beforeEach, describe, expect, it } from "vitest";
import {
  canonicalUrlForRoute,
  getAlternateLinksForEnglishRoute,
  getLocaleSwitchTargets,
  registerCms,
  sanitizeCanonicalUrl,
} from "astropress";

beforeEach(() => {
  registerCms({
    siteUrl: "https://example.com",
    templateKeys: [],
    seedPages: [],
    archives: [],
    translationStatus: [
      { route: "/es/impacto", locale: "es", englishSourceUrl: "/impact", translationState: "published" },
      { route: "/es", locale: "es", englishSourceUrl: "/", translationState: "published" },
      { route: "/es/paisajes-comestibles", locale: "es", englishSourceUrl: "/en/edible-landscapes", translationState: "published" },
      { route: "/es/contacto", locale: "es", englishSourceUrl: "/en/contact-fleet-farming", translationState: "published" },
    ],
  });
});

describe("canonicalUrlForRoute()", () => {
  it("returns the full absolute URL for a given route", () => {
    expect(canonicalUrlForRoute("/impact")).toBe("https://example.com/impact/");
  });

  it("handles the root route without double slash", () => {
    expect(canonicalUrlForRoute("/")).toBe("https://example.com/");
  });

  it("appends a trailing slash to non-root routes", () => {
    expect(canonicalUrlForRoute("/en/education")).toBe("https://example.com/en/education/");
  });
});

describe("getAlternateLinksForEnglishRoute()", () => {
  it("returns EN + ES alternates for a known translated route (/impact → /es/impacto)", () => {
    const links = getAlternateLinksForEnglishRoute("/impact");
    expect(links).toHaveLength(2);
    const hreflangs = links.map((l) => l.hreflang);
    expect(hreflangs).toContain("en");
    expect(hreflangs).toContain("es");
    const esLink = links.find((l) => l.hreflang === "es");
    expect(esLink?.href).toContain("/es/impacto");
  });

  it("returns EN + ES alternates for the root route (/ → /es)", () => {
    const links = getAlternateLinksForEnglishRoute("/");
    expect(links).toHaveLength(2);
    const esLink = links.find((l) => l.hreflang === "es");
    expect(esLink?.href).toContain("/es");
  });

  it("returns EN + ES alternates for a core service route", () => {
    const links = getAlternateLinksForEnglishRoute("/en/edible-landscapes");
    expect(links).toHaveLength(2);
    const esLink = links.find((l) => l.hreflang === "es");
    expect(esLink?.href).toContain("/es/paisajes-comestibles");
  });

  it("returns empty array for an unknown route", () => {
    const links = getAlternateLinksForEnglishRoute("/non-existent-page");
    expect(links).toHaveLength(0);
  });
});

describe("sanitizeCanonicalUrl()", () => {
  it("returns absolute URL for a known route when no override is provided", () => {
    const url = sanitizeCanonicalUrl(undefined, "/en/impact");
    expect(url).toBe("https://example.com/en/impact/");
  });

  it("strips query string and hash from an override URL", () => {
    const url = sanitizeCanonicalUrl("https://example.com/en/impact?utm_source=test#section", "/en/impact");
    expect(url).not.toContain("utm_source");
    expect(url).not.toContain("#section");
    expect(url).toContain("example.com/en/impact");
  });

  it("normalizes trailing slash on override URL", () => {
    const url = sanitizeCanonicalUrl("https://example.com/en/impact", "/en/impact");
    expect(url).toMatch(/\/en\/impact\/$/);
  });
});

describe("getLocaleSwitchTargets()", () => {
  it("uses explicit alternate links for reviewed EN/ES route pairs", () => {
    const targets = getLocaleSwitchTargets({
      lang: "en",
      currentPath: "/en/contact-fleet-farming",
      alternateLinks: [
        { hreflang: "en", href: "https://example.com/en/contact-fleet-farming/" },
        { hreflang: "es", href: "https://example.com/es/contacto/" },
      ],
    });

    expect(targets).toEqual({
      en: "/en/contact-fleet-farming/",
      es: "/es/contacto/",
    });
  });

  it("falls back to locale homes when no reviewed alternate exists", () => {
    const targets = getLocaleSwitchTargets({
      lang: "en",
      currentPath: "/en/about",
      alternateLinks: [],
    });

    expect(targets).toEqual({
      en: "/en/about",
      es: "/es",
    });
  });
});
