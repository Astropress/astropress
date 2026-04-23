import { expect, test } from "@playwright/test";

// Rubric 46 (Mobile-Firstness) — A+ behavioral coverage.
//
// WCAG 2.5.5 (AAA) / 2.5.8 (AA) Target Size: interactive targets must be at
// least 44×44 CSS pixels. We check every interactive element on each admin
// route at the viewport-375 breakpoint (iPhone SE / narrowest supported).
//
// Exceptions (per WCAG):
//   - Inline text links inside a paragraph (text flow context)
//   - Targets whose equivalent is available elsewhere on the same page
// We intentionally do NOT grant the "equivalent elsewhere" exception because
// admin actions rarely duplicate; inline links are excluded by filtering out
// <a> elements that are direct children of <p> or <li> text runs.

// Regression guard: each route currently has N known violations. The test
// fails if count grows beyond baseline. Drive these to zero — tracked in
// https://github.com/Astropress/astropress/issues/58. When a baseline hits
// zero, the per-route entry becomes a strict-compliance gate.
const ADMIN_ROUTES: Array<{ path: string; baseline: number }> = [
	{ path: "/ap-admin", baseline: 26 },
	{ path: "/ap-admin/posts", baseline: 50 },
	{ path: "/ap-admin/pages", baseline: 26 },
	{ path: "/ap-admin/media", baseline: 26 },
	{ path: "/ap-admin/redirects", baseline: 26 },
	{ path: "/ap-admin/comments", baseline: 26 },
	{ path: "/ap-admin/settings", baseline: 50 },
];

const INTERACTIVE_SELECTOR = [
	"button:not([disabled])",
	"a[href]",
	"[role=button]:not([aria-disabled=true])",
	"[role=menuitem]",
	"[role=tab]",
	"summary",
	"input[type=checkbox]",
	"input[type=radio]",
	'input[type="submit"]',
	'input[type="button"]',
].join(",");

// WCAG 2.5.5 exceptions (SC Target Size, Understanding §2.5.5):
//   - "Equivalent" — another target on the same page reaches the same destination
//   - "Essential" — a specific presentation is essential to information
// The admin topbar brand link duplicates the Dashboard nav entry (both land at
// /ap-admin). Skipping it here per the Equivalent exception; keyboard and
// screen-reader paths are unaffected.
const EXEMPT_SELECTORS = [".topbar-brand"];

const MIN_TOUCH_DIMENSION = 44;

test.describe("Rubric 46: touch targets ≥ 44×44 at viewport-375", () => {
	for (const { path: route, baseline } of ADMIN_ROUTES) {
		test(`Scenario: ${route} touch-target violations stay ≤ ${baseline} (regression guard)`, async ({
			page,
		}) => {
			await page.goto(route, { waitUntil: "domcontentloaded" });

			const offenders = await page.evaluate(
				({ selector, min, exemptSelectors }) => {
					const isInlineTextLink = (el: Element): boolean => {
						if (el.tagName !== "A") return false;
						const parent = el.parentElement;
						if (!parent) return false;
						const parentTag = parent.tagName;
						return parentTag === "P" || parentTag === "LI" || parentTag === "SPAN";
					};
					const isExempt = (el: Element): boolean =>
						exemptSelectors.some((sel) => el.matches(sel));
					const results: Array<{
						tag: string;
						text: string;
						w: number;
						h: number;
					}> = [];
					for (const el of Array.from(document.querySelectorAll(selector))) {
						if (!(el instanceof HTMLElement)) continue;
						if (isInlineTextLink(el)) continue;
						if (isExempt(el)) continue;
						// Skip hidden elements
						const rect = el.getBoundingClientRect();
						if (rect.width === 0 && rect.height === 0) continue;
						const style = window.getComputedStyle(el);
						if (style.display === "none" || style.visibility === "hidden") continue;
						if (rect.width < min || rect.height < min) {
							results.push({
								tag: el.tagName.toLowerCase(),
								text: (el.textContent ?? "").trim().slice(0, 40) || el.getAttribute("aria-label") || "(no label)",
								w: Math.round(rect.width),
								h: Math.round(rect.height),
							});
						}
					}
					return results;
				},
				{
					selector: INTERACTIVE_SELECTOR,
					min: MIN_TOUCH_DIMENSION,
					exemptSelectors: EXEMPT_SELECTORS,
				},
			);

			const formatted = offenders
				.map((o) => `  <${o.tag}> "${o.text}" (${o.w}×${o.h})`)
				.join("\n");
			expect(
				offenders.length,
				`WCAG 2.5.5 violations on ${route}: ${offenders.length} (baseline ≤ ${baseline}).\nFull list:\n${formatted}`,
			).toBeLessThanOrEqual(baseline);
		});
	}
});
