import { expect, test } from "@playwright/test";

// Regression guard: after switching the admin to a non-English locale,
// the page chrome (document <title>, <h1>, and the primary nav link labels)
// must change. Identical text across locales means a string was hardcoded
// in JSX instead of routed through getPageT(...) — the exact bug that left
// "Pages" untranslated under Telugu before the SSR i18n wire-up.
//
// We compare English (cookie cleared) against Telugu, since Telugu uses a
// non-Latin script: any leak shows up as ASCII text where Devanagari-adjacent
// glyphs were expected.

const ADMIN_ROUTES = [
	"/ap-admin",
	"/ap-admin/posts",
	"/ap-admin/pages",
	"/ap-admin/media",
	"/ap-admin/redirects",
	"/ap-admin/comments",
	"/ap-admin/settings",
	"/ap-admin/users",
	"/ap-admin/authors",
	"/ap-admin/taxonomies",
	"/ap-admin/route-pages",
	"/ap-admin/archives",
	"/ap-admin/translations",
	"/ap-admin/seo",
	"/ap-admin/system",
	"/ap-admin/api-tokens",
	"/ap-admin/webhooks",
	"/ap-admin/services",
	"/ap-admin/testimonials",
];

interface ChromeSnapshot {
	title: string;
	h1: string;
	navLabels: string[];
	mainHeadings: string[];
	supportCardLabels: string[];
}

async function snapshotChrome(
	page: import("@playwright/test").Page,
): Promise<ChromeSnapshot> {
	return await page.evaluate(() => {
		const h1 = document.querySelector("h1");
		const navLinks = Array.from(
			document.querySelectorAll<HTMLAnchorElement>("nav a, [data-admin-nav] a"),
		)
			.map((a) => (a.textContent ?? "").trim())
			.filter((s) => s.length > 0);
		// Section <h2> headings inside <main> are page-owned chrome — these are the
		// labels that prompted bugs like "Admin URL" leaking through untranslated.
		const mainHeadings = Array.from(
			document.querySelectorAll<HTMLElement>("main h2"),
		)
			.map((h) => (h.textContent ?? "").trim())
			.filter((s) => s.length > 0);
		// Dashboard support-card <strong> labels and stat-card <span class="stat-label">
		// are page-owned chrome — these are the labels that prompted the "SEO"
		// leak that the h1/h2/nav check misses.
		const supportCardLabels = Array.from(
			document.querySelectorAll<HTMLElement>(
				"main .support-card strong, main .stat-card .stat-label, main .queue-list li > .queue-copy > span",
			),
		)
			.map((el) => (el.textContent ?? "").trim())
			.filter((s) => s.length > 0);
		return {
			title: document.title,
			h1: (h1?.textContent ?? "").trim(),
			navLabels: navLinks,
			mainHeadings,
			supportCardLabels,
		};
	});
}

test.describe("Admin i18n: chrome must change between English and Telugu", () => {
	for (const route of ADMIN_ROUTES) {
		test(`Scenario: ${route} chrome differs in Telugu vs English`, async ({
			context,
			page,
		}) => {
			await context.clearCookies();
			await page.goto(route, { waitUntil: "domcontentloaded" });
			const en = await snapshotChrome(page);

			await context.addCookies([
				{
					name: "astropress_admin_locale",
					value: "te",
					url: page.url(),
				},
			]);
			await page.goto(route, { waitUntil: "domcontentloaded" });
			const te = await snapshotChrome(page);

			expect(
				en.h1.length,
				`${route}: missing <h1> in English render`,
			).toBeGreaterThan(0);
			expect(
				te.h1.length,
				`${route}: missing <h1> in Telugu render`,
			).toBeGreaterThan(0);

			expect(
				te.h1,
				`${route}: <h1> "${te.h1}" did not change between EN and TE — likely hardcoded English string instead of t(...)`,
			).not.toBe(en.h1);

			expect(
				te.title,
				`${route}: <title> did not change between EN and TE — document title is not localised`,
			).not.toBe(en.title);

			// Navigation labels are shared chrome rendered by AdminLayout; if any of them
			// match between locales it means a nav label is hardcoded. Compare as a set.
			const enNav = en.navLabels.join(" | ");
			const teNav = te.navLabels.join(" | ");
			expect(
				teNav,
				`${route}: navigation labels did not change between EN and TE\nEN: ${enNav}\nTE: ${teNav}`,
			).not.toBe(enNav);

			// Per-page <h2> section headings — each English heading must differ from
			// its Telugu counterpart, which catches panel-level leaks (e.g. "Admin URL")
			// that the h1/title/nav check misses. Technical identifiers that are valid
			// across all locales (filenames, protocol names, code tokens) are exempt.
			const TECH_IDENTIFIER = /^[a-z0-9._/-]+$/;
			expect(
				te.mainHeadings.length,
				`${route}: <main> <h2> count differs between EN (${en.mainHeadings.length}) and TE (${te.mainHeadings.length})`,
			).toBe(en.mainHeadings.length);
			for (let i = 0; i < en.mainHeadings.length; i++) {
				const enH = en.mainHeadings[i];
				const teH = te.mainHeadings[i];
				if (TECH_IDENTIFIER.test(enH)) continue;
				expect(
					teH,
					`${route}: <main> <h2>[${i}] "${teH}" did not change between EN and TE — likely hardcoded English string instead of t(...)`,
				).not.toBe(enH);
			}

			// Stat-card / support-card chrome labels — the "SEO" leak class.
			expect(te.supportCardLabels.length).toBe(en.supportCardLabels.length);
			for (let i = 0; i < en.supportCardLabels.length; i++) {
				const enL = en.supportCardLabels[i];
				const teL = te.supportCardLabels[i];
				if (TECH_IDENTIFIER.test(enL)) continue;
				expect(
					teL,
					`${route}: stat/support card label[${i}] "${teL}" did not change between EN and TE`,
				).not.toBe(enL);
			}
		});
	}
});
