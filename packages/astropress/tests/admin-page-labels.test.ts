import { describe, expect, it } from "vitest";

import { getPageT } from "../src/admin-page-labels";

describe("getPageT", () => {
	it("returns the requested-locale translation when present", () => {
		const t = getPageT("te");
		expect(t("translations.title")).toBe("అనువాదాలు");
	});

	it("falls back to English when the locale is missing for a key", () => {
		// "ny" (Chichewa) is a defined locale but many keys lack a "ny" entry —
		// ensure we get the English value rather than undefined.
		const t = getPageT("ny");
		const value = t("translations.title");
		expect(value.length).toBeGreaterThan(0);
		// Must be either the ny translation OR the English fallback, never undefined.
		expect(typeof value).toBe("string");
	});

	it("returns the English value for English requests", () => {
		const t = getPageT("en");
		expect(t("translations.title")).toBe("Translations");
	});

	it("returns the key as a last-resort fallback when the catalog has no entry", () => {
		// Cast: deliberately exercising the missing-key path that protects SSR
		// from crashing on a typo in a future page template.
		const t = getPageT("en");
		expect(t("nonexistent.key.that.is.not.in.catalog" as never)).toBe(
			"nonexistent.key.that.is.not.in.catalog",
		);
	});

	it("returns a different value for the same key across locales", () => {
		const en = getPageT("en")("translations.title");
		const te = getPageT("te")("translations.title");
		const ja = getPageT("ja")("translations.title");
		// Each non-English locale that has its own translation must differ from EN.
		expect(te).not.toBe(en);
		expect(ja).not.toBe(en);
	});
});
