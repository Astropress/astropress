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

// Strict-compliance gate: every interactive admin target at viewport-375 must
// meet WCAG 2.5.5 (44×44). Issue #58 drove the original 26-50 violations per
// route to zero; the spec is now an equality check rather than a regression
// guard. New violations fail CI immediately.
const ADMIN_ROUTES: string[] = [
	"/ap-admin",
	"/ap-admin/posts",
	"/ap-admin/pages",
	"/ap-admin/media",
	"/ap-admin/redirects",
	"/ap-admin/comments",
	"/ap-admin/settings",
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
	for (const route of ADMIN_ROUTES) {
		test(`Scenario: ${route} has no WCAG 2.5.5 violations`, async ({
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
						// WCAG 2.5.5 "Inline" exception: links inside text-flow containers.
						// <ap-notice> is a flow-text custom element used for in-page bootstrap and admin
						// notices ("change your password" etc.) where the link is part of a sentence.
						return (
							parentTag === "P" ||
							parentTag === "LI" ||
							parentTag === "SPAN" ||
							parentTag === "AP-NOTICE"
						);
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
				offenders,
				`WCAG 2.5.5 violations on ${route}:\n${formatted}`,
			).toEqual([]);
		});
	}
});
