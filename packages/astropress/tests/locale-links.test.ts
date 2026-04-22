import {
	canonicalUrlForRoute,
	getAlternateLinksForEnglishRoute,
	getLocaleSwitchTargets,
	registerCms,
	sanitizeCanonicalUrl,
} from "@astropress-diy/astropress";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
	registerCms({
		siteUrl: "https://example.com",
		templateKeys: [],
		seedPages: [],
		archives: [],
		translationStatus: [
			{
				route: "/es/impacto",
				locale: "es",
				englishSourceUrl: "/impact",
				translationState: "published",
			},
			{
				route: "/es",
				locale: "es",
				englishSourceUrl: "/",
				translationState: "published",
			},
			{
				route: "/es/paisajes-comestibles",
				locale: "es",
				englishSourceUrl: "/en/edible-landscapes",
				translationState: "published",
			},
			{
				route: "/es/contacto",
				locale: "es",
				englishSourceUrl: "/en/contact",
				translationState: "published",
			},
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
		expect(canonicalUrlForRoute("/en/education")).toBe(
			"https://example.com/en/education/",
		);
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
		const url = sanitizeCanonicalUrl(
			"https://example.com/en/impact?utm_source=test#section",
			"/en/impact",
		);
		expect(url).not.toContain("utm_source");
		expect(url).not.toContain("#section");
		expect(url).toContain("example.com/en/impact");
	});

	it("normalizes trailing slash on override URL", () => {
		const url = sanitizeCanonicalUrl(
			"https://example.com/en/impact",
			"/en/impact",
		);
		expect(url).toMatch(/\/en\/impact\/$/);
	});

	it("preserves '/' without adding extra slash when override URL is the site root", () => {
		// Covers the `parsed.pathname === "/"` ternary true branch on line 46
		const url = sanitizeCanonicalUrl("https://example.com/", "/");
		expect(url).toBe("https://example.com/");
	});
});

describe("getLocaleSwitchTargets()", () => {
	it("uses explicit alternate links for reviewed EN/ES route pairs", () => {
		const targets = getLocaleSwitchTargets({
			lang: "en",
			currentPath: "/en/contact",
			alternateLinks: [
				{ hreflang: "en", href: "https://example.com/en/contact/" },
				{ hreflang: "es", href: "https://example.com/es/contacto/" },
			],
		});

		expect(targets).toEqual({
			en: "/en/contact/",
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

	it("sets the current path for the es locale when on an es route (isLocalePath es branch)", () => {
		const targets = getLocaleSwitchTargets({
			lang: "es",
			currentPath: "/es/impacto",
			alternateLinks: [],
		});
		expect(targets.es).toBe("/es/impacto");
		expect(targets.en).toBe("/en");
	});

	it("uses empty array fallback when alternateLinks is omitted (?? [] branch)", () => {
		const targets = getLocaleSwitchTargets({ lang: "en" });
		expect(targets).toEqual({ en: "/en", es: "/es" });
	});

	it("redirects root path '/' to '/en' when viewed from es locale", () => {
		const targets = getLocaleSwitchTargets({
			lang: "es",
			currentPath: "/es/inicio",
			alternateLinks: [{ hreflang: "en", href: "https://example.com/" }],
		});
		expect(targets.en).toBe("/en");
	});

	it("skips alternate links with non-standard hreflang (fr is ignored)", () => {
		const targets = getLocaleSwitchTargets({
			lang: "en",
			currentPath: "/en/about",
			alternateLinks: [
				{ hreflang: "fr", href: "https://example.com/fr/about/" },
				{ hreflang: "es", href: "https://example.com/es/sobre/" },
			],
		});
		// fr link ignored; es link used
		expect(targets.es).toBe("/es/sobre/");
		expect(targets).not.toHaveProperty("fr");
	});

	it("falls back to returning href as-is when URL parse fails (pathFromHref catch branch)", () => {
		const badHref = "http://[invalid-host]/path/";
		const targets = getLocaleSwitchTargets({
			lang: "en",
			currentPath: "/en/about",
			alternateLinks: [{ hreflang: "es", href: badHref }],
		});
		// The catch branch returns the raw href string as the path
		expect(targets.es).toBe(badHref);
	});
});
