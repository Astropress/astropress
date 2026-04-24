import { expect, test } from "@playwright/test";

import { expectNoAxeViolations } from "./helpers/accessibility";

// Rubric 47 (Admin Panel UX) — A+ behavioral coverage.
//
// Verifies heading structure + button labelling across all admin routes:
//   1. Exactly one <h1> per page (WCAG 2.4.6 / 1.3.1)
//   2. No heading-level skips (h1 → h3 is a violation; h1 → h2 → h3 is fine)
//   3. Icon-only buttons (empty or single-character text content) have aria-label
//   4. Every <button> has either visible text or aria-label / aria-labelledby
//   5. axe-core 'heading-order' rule runs without being in the ignore list
//
// This is the behavioral complement to the grep-level audit:navigation check.

const ADMIN_ROUTES = [
	"/ap-admin",
	"/ap-admin/posts",
	"/ap-admin/pages",
	"/ap-admin/media",
	"/ap-admin/redirects",
	"/ap-admin/comments",
	"/ap-admin/settings",
];

test.describe("Rubric 47: heading hierarchy + button labelling", () => {
	for (const route of ADMIN_ROUTES) {
		test(`Scenario: ${route} has exactly one h1 and no level skips`, async ({
			page,
		}) => {
			await page.goto(route, { waitUntil: "domcontentloaded" });

			const headingLevels = await page.evaluate(() => {
				return Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
					.filter((el) => {
						const rect = el.getBoundingClientRect();
						const style = window.getComputedStyle(el);
						return (
							(rect.width > 0 || rect.height > 0) &&
							style.display !== "none" &&
							style.visibility !== "hidden"
						);
					})
					.map((el) => Number(el.tagName.charAt(1)));
			});

			const h1Count = headingLevels.filter((l) => l === 1).length;
			expect(h1Count, `${route} must have exactly one <h1>, found ${h1Count}`).toBe(1);

			let previous = 0;
			for (const level of headingLevels) {
				if (previous !== 0 && level > previous + 1) {
					throw new Error(
						`${route}: heading-level skip detected — jumped from h${previous} to h${level}. Sequence: ${headingLevels.join(",")}`,
					);
				}
				previous = level;
			}
		});

		test(`Scenario: ${route} icon-only buttons have aria-label`, async ({ page }) => {
			await page.goto(route, { waitUntil: "domcontentloaded" });

			const offenders = await page.evaluate(() => {
				const results: Array<{ outerHtml: string; text: string }> = [];
				const buttons = Array.from(
					document.querySelectorAll<HTMLElement>("button, [role=button]"),
				);
				for (const btn of buttons) {
					const rect = btn.getBoundingClientRect();
					if (rect.width === 0 && rect.height === 0) continue;
					const text = (btn.textContent ?? "").trim();
					const ariaLabel = btn.getAttribute("aria-label")?.trim() ?? "";
					const ariaLabelledBy = btn.getAttribute("aria-labelledby")?.trim() ?? "";
					const title = btn.getAttribute("title")?.trim() ?? "";
					// Icon-only: text content is empty or purely a single symbol/codepoint
					const isIconOnly = text.length === 0 || text.length === 1;
					const hasAccessibleName =
						text.length >= 2 || ariaLabel.length > 0 || ariaLabelledBy.length > 0 || title.length > 0;
					if (isIconOnly && !hasAccessibleName) {
						results.push({
							outerHtml: btn.outerHTML.slice(0, 120),
							text,
						});
					}
				}
				return results;
			});

			expect(
				offenders,
				`${route}: icon-only buttons missing aria-label/aria-labelledby/title:\n${offenders
					.map((o) => `  ${o.outerHtml}`)
					.join("\n")}`,
			).toEqual([]);
		});

		test(`Scenario: ${route} passes axe heading-order (not ignored)`, async ({ page }) => {
			await page.goto(route, { waitUntil: "domcontentloaded" });
			// Note: heading-order is NOT in the ignore list — Rubric 47 A+ requires it to be enforced.
			await expectNoAxeViolations(page);
		});
	}
});
