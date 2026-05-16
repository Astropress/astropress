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

	it("filters out non-'es' locale entries (pins L21 locale === 'es' check)", () => {
		registerCms({
			siteUrl: "https://example.com",
			templateKeys: [],
			seedPages: [],
			archives: [],
			translationStatus: [
				{
					route: "/fr/impact",
					locale: "fr",
					englishSourceUrl: "/impact",
					translationState: "published",
				},
			],
		});
		const links = getAlternateLinksForEnglishRoute("/impact");
		expect(links).toHaveLength(0);
	});

	it("filters out non-published translation states (pins L22 isPublished check)", () => {
		registerCms({
			siteUrl: "https://example.com",
			templateKeys: [],
			seedPages: [],
			archives: [],
			translationStatus: [
				{
					route: "/es/impacto-draft",
					locale: "es",
					englishSourceUrl: "/impact",
					translationState: "draft",
				},
			],
		});
		const links = getAlternateLinksForEnglishRoute("/impact");
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
		const url = sanitizeCanonicalUrl("https://example.com/en/impact", "/en/impact");
		expect(url).toMatch(/\/en\/impact\/$/);
	});

	it("preserves '/' without adding extra slash when override URL is the site root", () => {
		// Covers the `parsed.pathname === "/"` ternary true branch on line 46
		const url = sanitizeCanonicalUrl("https://example.com/", "/");
		expect(url).toBe("https://example.com/");
	});

	it("returns fallback canonical when value is undefined (pins L42 !value check)", () => {
		const url = sanitizeCanonicalUrl(undefined, "/fallback-route");
		expect(url).toContain("/fallback-route");
	});

	it("returns fallback canonical when value is empty string (pins L42 !value check)", () => {
		const url = sanitizeCanonicalUrl("", "/fallback-route");
		expect(url).toContain("/fallback-route");
	});
});

describe("getLocaleSwitchTargets isLocalePath survivors", () => {
	it("uses currentPath when lang='es' and path is exactly '/es' (pins L66 path === '/es')", () => {
		const targets = getLocaleSwitchTargets({
			lang: "es",
			currentPath: "/es",
		});
		expect(targets.es).toBe("/es");
	});

	it("uses currentPath when lang='es' and path starts with '/es/' (pins L66 startsWith)", () => {
		const targets = getLocaleSwitchTargets({
			lang: "es",
			currentPath: "/es/sobre/",
		});
		expect(targets.es).toBe("/es/sobre/");
	});

	it("does NOT use currentPath when lang='es' but path is in EN-space (e.g. '/about')", () => {
		const targets = getLocaleSwitchTargets({
			lang: "es",
			currentPath: "/about",
		});
		// Default fallback to /es because /about is not an es-prefixed path.
		expect(targets.es).toBe("/es");
	});

	it("does NOT use currentPath when lang='es' and path is '/es-mx' (similar prefix but not '/es' or '/es/')", () => {
		const targets = getLocaleSwitchTargets({
			lang: "es",
			currentPath: "/es-mx/about",
		});
		expect(targets.es).toBe("/es");
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

	it("preserves a non-empty override URL distinct from the fallback (pins L42 !value → true)", () => {
		// Mutating `if (!value)` to `if (true)` would discard the override URL
		// and always return the fallback canonical. With value="/override" and
		// fallback="/fallback", the original keeps the override.
		const url = sanitizeCanonicalUrl("https://example.com/override", "/fallback");
		expect(url).toContain("/override");
		expect(url).not.toContain("/fallback");
	});

	it("keeps targets.en at /en when lang='en' and currentPath is an es-prefixed path (pins L69 startsWith→endsWith)", () => {
		// For path "/es/foo": startsWith("/es/") is true → isLocalePath("/es/foo", "en")
		// returns false → currentPath is NOT used for targets.en. Mutating
		// startsWith to endsWith inverts the check ("/es/foo" doesn't end with "/es/")
		// so isLocalePath would wrongly return true and assign /es/foo to targets.en.
		const targets = getLocaleSwitchTargets({
			lang: "en",
			currentPath: "/es/foo",
		});
		expect(targets.en).toBe("/en");
	});

	it("does not rewrite targets.en to /en when hreflang='en' but path is not '/' (pins L93 path === '/' clause)", () => {
		// path === "/" replaced with `true` would make any en alternate href rewrite
		// to "/en" regardless of path. The original keeps the actual path "/en/contact/".
		const targets = getLocaleSwitchTargets({
			lang: "es",
			alternateLinks: [{ hreflang: "en", href: "https://example.com/en/contact/" }],
		});
		expect(targets.en).toBe("/en/contact/");
	});

	it("does not rewrite targets.en to /en when lang='en' (pins L93 input.lang === 'es' clause)", () => {
		// input.lang === "es" replaced with `true` would fire the rewrite even on
		// an EN page viewing root. Original keeps targets.en as the raw path "/".
		const targets = getLocaleSwitchTargets({
			lang: "en",
			alternateLinks: [{ hreflang: "en", href: "https://example.com/" }],
		});
		expect(targets.en).toBe("/");
	});

	it("does not rewrite targets.es to /en when hreflang='es' and lang='es' (pins L93 hreflang === 'en' clause + first &&)", () => {
		// Mutating `hreflang === "en"` to `true` would fire the /en rewrite even
		// for an ES alternate link, and mutating the first `&&` to `||` would
		// short-circuit to /en when hreflang is "en" regardless of path/lang.
		// With hreflang="es", path="/", lang="es": original target.es is "/"; the
		// mutants would set target.es to "/en".
		const targets = getLocaleSwitchTargets({
			lang: "es",
			alternateLinks: [{ hreflang: "es", href: "https://example.com/" }],
		});
		expect(targets.es).toBe("/");
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
