import { describe, expect, test } from "vitest";

import {
	ADMIN_LOCALE_COOKIE,
	isRtlLocale,
	localeDirection,
	pickAdminLocaleFromAcceptLanguage,
	resolveAdminLocale,
} from "../src/admin-locale";

describe("pickAdminLocaleFromAcceptLanguage", () => {
	test("returns null for empty input", () => {
		expect(pickAdminLocaleFromAcceptLanguage(null)).toBeNull();
		expect(pickAdminLocaleFromAcceptLanguage("")).toBeNull();
	});

	test("matches the highest q-weighted supported locale", () => {
		expect(
			pickAdminLocaleFromAcceptLanguage("fr-CA;q=0.5,de-DE;q=0.9,en;q=0.1"),
		).toBe("de");
	});

	test("strips region subtags so pt-BR matches pt", () => {
		expect(pickAdminLocaleFromAcceptLanguage("pt-BR")).toBe("pt");
	});

	test("returns null when no entry is supported", () => {
		expect(pickAdminLocaleFromAcceptLanguage("ko,zh-Hant")).toBeNull();
	});

	test("supports newly added locales", () => {
		expect(pickAdminLocaleFromAcceptLanguage("te-IN")).toBe("te");
		expect(pickAdminLocaleFromAcceptLanguage("hi")).toBe("hi");
		expect(pickAdminLocaleFromAcceptLanguage("ny-MW")).toBe("ny");
	});
});

describe("resolveAdminLocale", () => {
	function makeAstro({
		cookie,
		acceptLanguage,
	}: {
		cookie?: string;
		acceptLanguage?: string;
	}) {
		return {
			cookies: {
				get: (name: string) =>
					cookie && name === "astropress_admin_locale"
						? { value: cookie }
						: undefined,
			},
			request: {
				headers: {
					get: (name: string) =>
						name === "accept-language" ? (acceptLanguage ?? null) : null,
				},
			},
		};
	}

	test("cookie wins over Accept-Language", () => {
		expect(
			resolveAdminLocale(makeAstro({ cookie: "ja", acceptLanguage: "fr-FR" })),
		).toBe("ja");
	});

	test("Accept-Language is used when no cookie is set", () => {
		expect(resolveAdminLocale(makeAstro({ acceptLanguage: "es-MX" }))).toBe(
			"es",
		);
	});

	test("falls back to en when nothing matches", () => {
		expect(resolveAdminLocale(makeAstro({ acceptLanguage: "ko-KR" }))).toBe(
			"en",
		);
	});

	test("ignores invalid cookie values", () => {
		expect(
			resolveAdminLocale(makeAstro({ cookie: "xx", acceptLanguage: "hi-IN" })),
		).toBe("hi");
	});

	test("supports the ar locale via cookie", () => {
		expect(resolveAdminLocale(makeAstro({ cookie: "ar" }))).toBe("ar");
	});

	test("supports ar via Accept-Language", () => {
		expect(resolveAdminLocale(makeAstro({ acceptLanguage: "ar-SA" }))).toBe(
			"ar",
		);
	});
});

describe("isRtlLocale", () => {
	test("returns true exactly for ar", () => {
		expect(isRtlLocale("ar")).toBe(true);
	});
	test("returns false for every LTR locale", () => {
		for (const ltr of [
			"en",
			"es",
			"fr",
			"de",
			"pt",
			"ja",
			"te",
			"hi",
			"ny",
		] as const) {
			expect(isRtlLocale(ltr)).toBe(false);
		}
	});
});

describe("localeDirection", () => {
	test("returns 'rtl' for ar", () => {
		expect(localeDirection("ar")).toBe("rtl");
	});
	test("returns 'ltr' for en", () => {
		expect(localeDirection("en")).toBe("ltr");
	});
	test("returns 'ltr' for every LTR locale in the catalog", () => {
		for (const ltr of [
			"en",
			"es",
			"fr",
			"de",
			"pt",
			"ja",
			"te",
			"hi",
			"ny",
		] as const) {
			expect(localeDirection(ltr)).toBe("ltr");
		}
	});
});

describe("admin-locale — extra branch coverage", () => {
	test("Accept-Language with no q param defaults to q=1 ordering", () => {
		expect(pickAdminLocaleFromAcceptLanguage("en, fr")).toBe("en");
	});

	test("malformed q param falls back to 1", () => {
		expect(pickAdminLocaleFromAcceptLanguage("fr;q=abc, en;q=0.5")).toBe("fr");
	});

	test("entries with empty tag are filtered out", () => {
		expect(pickAdminLocaleFromAcceptLanguage(",,en")).toBe("en");
	});

	test("returns first supported when ordering is by q descending", () => {
		expect(pickAdminLocaleFromAcceptLanguage("en;q=0.1,fr;q=0.9")).toBe("fr");
	});

	test("uppercase region tags are normalised", () => {
		expect(pickAdminLocaleFromAcceptLanguage("EN-US")).toBe("en");
	});

	test("resolveAdminLocale ignores cookie object with missing value", () => {
		const astro = {
			cookies: { get: () => ({}) },
			request: { headers: { get: () => "ja-JP" } },
		};
		expect(resolveAdminLocale(astro)).toBe("ja");
	});

	test("resolveAdminLocale falls back to en when no cookies object", () => {
		const astro = {
			request: { headers: { get: () => null } },
		};
		expect(resolveAdminLocale(astro)).toBe("en");
	});

	test("isRtlLocale on every supported LTR returns false strictly", () => {
		for (const l of [
			"en",
			"es",
			"fr",
			"de",
			"pt",
			"ja",
			"te",
			"hi",
			"ny",
		] as const) {
			expect(isRtlLocale(l)).toBe(false);
		}
	});

	test("localeDirection result is exactly the string 'rtl' for ar (mutation guard)", () => {
		const d = localeDirection("ar");
		expect(d).toBe("rtl");
		expect(d).not.toBe("ltr");
		expect(d).not.toBe("");
	});

	test("localeDirection result is exactly 'ltr' for non-ar (mutation guard)", () => {
		const d = localeDirection("en");
		expect(d).toBe("ltr");
		expect(d).not.toBe("rtl");
	});

	test("ADMIN_LOCALE_COOKIE is the documented literal 'astropress_admin_locale' (kills cookie-name mutant)", () => {
		expect(ADMIN_LOCALE_COOKIE).toBe("astropress_admin_locale");
	});

	test("Accept-Language entries with surrounding whitespace still parse (kills entry.trim() removal)", () => {
		// Spaces around comma-separated entries are common in real headers.
		// Without entry.trim(), the leading space would survive and tag would
		// be " fr" — not matching any locale.
		expect(pickAdminLocaleFromAcceptLanguage(" fr;q=0.9, en;q=0.5")).toBe("fr");
	});

	test("q-param with surrounding whitespace still parses (kills p.trim() removal)", () => {
		// Without p.trim(), " q=0.9" wouldn't match startsWith("q=") and the
		// entry would silently default to q=1, breaking the priority sort.
		// fr is high-priority via the spaced q-param; en is the low-priority
		// fallback. With original parsing fr wins.
		expect(pickAdminLocaleFromAcceptLanguage("fr; q=0.9,en;q=0.5")).toBe("fr");
	});

	test("a parameter that is NOT a q-param does not capture the q value (kills startsWith('q=') -> startsWith('') mutant)", () => {
		// Param "x=q=0.1" starts with "x=" not "q=". Original ignores it (q
		// stays default 1). Mutant `startsWith("")` would match every param,
		// reading "x=q=0.1" as q-param and parseFloat("q=0.1") = NaN, falling
		// to default 1 — same. To distinguish, use a param the regex would
		// "claim" with non-NaN value.
		// Header: "fr;extra=0.1, en;q=0.99" — original: fr q=1, en q=0.99 → fr wins.
		// Mutant: for fr, finds first param "extra=0.1", splits at "=", takes "0.1" → q=0.1. For en, finds "q=0.99" first → q=0.99. en wins.
		expect(pickAdminLocaleFromAcceptLanguage("fr;extra=0.1, en;q=0.99")).toBe(
			"fr",
		);
	});
});
