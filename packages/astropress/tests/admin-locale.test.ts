import { describe, expect, test } from "vitest";

import {
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
});
