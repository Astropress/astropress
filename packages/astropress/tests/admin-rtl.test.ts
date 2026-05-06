import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isRtlLocale, localeDirection } from "../src/admin-locale";

const REPO_ROOT = join(__dirname, "..");

describe("admin RTL plumbing", () => {
	it("AdminLocale union includes ar", () => {
		const src = readFileSync(join(REPO_ROOT, "src", "admin-labels.ts"), "utf8");
		expect(src).toMatch(/\|\s*"ar"/);
	});

	it("supported locale list contains ar", () => {
		const src = readFileSync(join(REPO_ROOT, "src", "admin-locale.ts"), "utf8");
		expect(src).toMatch(/"ar"/);
	});

	it("isRtlLocale returns true for ar", () => {
		expect(isRtlLocale("ar")).toBe(true);
	});

	it("isRtlLocale returns false for ltr locales", () => {
		expect(isRtlLocale("en")).toBe(false);
		expect(isRtlLocale("te")).toBe(false);
		expect(isRtlLocale("ja")).toBe(false);
	});

	it("localeDirection returns rtl for ar", () => {
		expect(localeDirection("ar")).toBe("rtl");
	});

	it("localeDirection returns ltr for ltr locales", () => {
		expect(localeDirection("en")).toBe("ltr");
		expect(localeDirection("hi")).toBe("ltr");
	});

	it("AdminLayout.astro emits dir on the html element", () => {
		const src = readFileSync(join(REPO_ROOT, "components", "AdminLayout.astro"), "utf8");
		expect(src).toMatch(/<html\s+lang=\{adminLocale\}\s+dir=\{adminDir\}/);
	});

	it("admin.css uses logical properties for inline-axis spacing", () => {
		const src = readFileSync(join(REPO_ROOT, "public", "admin.css"), "utf8");
		expect(src).toContain("inset-inline-start:");
		expect(src).toContain("inset-inline-end:");
		expect(src).toContain("padding-inline-start:");
		expect(src).toContain("border-inline-end:");
		expect(src).toMatch(/text-align:\s*start/);
		// And we should not have any user-visible physical properties that would
		// flip wrong under RTL. A few centering tricks (left: 50% + translate)
		// are neutral and excluded by checking only directional spacing.
		expect(src).not.toMatch(/^\s*margin-left:/m);
		expect(src).not.toMatch(/^\s*margin-right:/m);
		expect(src).not.toMatch(/^\s*padding-left:/m);
		expect(src).not.toMatch(/^\s*padding-right:/m);
		expect(src).not.toMatch(/^\s*border-left:/m);
		expect(src).not.toMatch(/^\s*border-right:/m);
	});
});
