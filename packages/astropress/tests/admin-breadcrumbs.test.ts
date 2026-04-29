import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Breadcrumb invariants for deep admin pages. Each editor or detail page
// that lives more than one level deep must render a <nav class="breadcrumb">
// so users can navigate back up the hierarchy.

const root = path.resolve(import.meta.dirname, "..");
const adminCss = readFileSync(path.join(root, "public", "admin.css"), "utf8");

const PAGES_WITH_BREADCRUMBS = [
	["import", "[source].astro"],
	["subscribers", "[id].astro"],
	["posts", "[slug].astro"],
	["archives", "[...slug].astro"],
	["route-pages", "[...slug].astro"],
] as const;

describe("breadcrumb navigation", () => {
	// Breadcrumb nav must include class="breadcrumb" plus a localised aria-label.
	// After the i18n hardening pass the aria-label resolves via t(...) — match
	// on the class and the presence of an aria-label attribute rather than the
	// literal English string.
	const breadcrumbRe = /<nav\s+class="breadcrumb"\s+aria-label=/;

	for (const segments of PAGES_WITH_BREADCRUMBS) {
		const rel = segments.join("/");
		it(`${rel} renders a breadcrumb nav`, () => {
			const src = readFileSync(
				path.join(root, "pages", "ap-admin", ...segments),
				"utf8",
			);
			expect(src).toMatch(breadcrumbRe);
		});
	}

	it("ships shared breadcrumb styles in admin.css", () => {
		expect(adminCss).toContain(".breadcrumb");
		expect(adminCss).toContain(".breadcrumb a");
	});
});
