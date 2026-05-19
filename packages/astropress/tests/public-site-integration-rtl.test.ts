/**
 * Smoke test for the public-site layout's RTL plumbing. We assert
 * against `SiteLayout.astro`'s template directly (string-level grep on
 * source) rather than booting Astro — the goal is to catch a future
 * edit that drops the `dir` attribute or hardcodes `lang="en"`,
 * regressing the acceptance criterion from issue #72.
 *
 * Why a source-text test, not a rendered-output test: the public-site
 * layout in this repo lives under `examples/github-pages/` and is
 * built by `astro build` only when the example site is exercised.
 * That path runs in the `test-build-content` CI job, not the unit
 * test suite. Pinning the template's source attributes here is the
 * lightweight unit-side complement.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LAYOUT_PATH = join(
	__dirname,
	"..",
	"..",
	"..",
	"examples",
	"github-pages",
	"src",
	"components",
	"SiteLayout.astro",
);

describe("public-site SiteLayout RTL plumbing (issue #72)", () => {
	const src = readFileSync(LAYOUT_PATH, "utf8");

	it("accepts a `lang` prop (BCP-47) — defaulting to 'en'", () => {
		expect(src).toMatch(/lang\?:\s*string/);
		expect(src).toMatch(/lang\s*=\s*"en"/);
	});

	it("renders <html lang={lang} dir={dir}>", () => {
		expect(src).toMatch(/<html\s+lang=\{lang\}\s+dir=\{dir\}>/);
	});

	it("classifies ar, he, fa, ur as RTL", () => {
		// Regex on the literal set is fine for a single-source pin —
		// the audit catches drift if the set is reordered or extended.
		expect(src).toMatch(/RTL_LOCALES[\s\S]*"ar"[\s\S]*"he"[\s\S]*"fa"[\s\S]*"ur"/);
	});

	it("normalises a regional tag down to its primary subtag", () => {
		// Without this, `lang="ar-EG"` would skip the RTL_LOCALES match.
		expect(src).toMatch(/lang\.split\("-"\)\[0\]/);
		expect(src).toMatch(/\.toLowerCase\(\)/);
	});

	it("defaults the rendered direction to ltr for unknown locales", () => {
		// The default is implicit (the union `"ltr" | "rtl"`) but the
		// fallback branch must be `"ltr"` so a misconfigured locale
		// renders left-to-right rather than throwing.
		expect(src).toMatch(/RTL_LOCALES\.has\(primaryLang\)\s*\?\s*"rtl"\s*:\s*"ltr"/);
	});
});
