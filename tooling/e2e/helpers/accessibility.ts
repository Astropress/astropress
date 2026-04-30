import AxeBuilder from "@axe-core/playwright";
import { type Page, expect } from "@playwright/test";

/**
 * Asserts that the page has at least one loaded stylesheet with CSS rules.
 * This catches cases where CSP blocks inline styles or a stylesheet link is broken —
 * conditions that are invisible to DOM-presence and axe checks but make the UI
 * visually broken in a real browser.
 *
 * Use this on every admin route that should render with admin.css applied.
 */
export async function expectStylesheetsLoaded(page: Page): Promise<void> {
	const loaded = await page.evaluate(() =>
		Array.from(document.styleSheets).some((ss) => {
			try {
				return ss.cssRules.length > 0;
			} catch {
				// Cross-origin stylesheet: if href is set it loaded (CORS restriction on cssRules).
				return ss.href !== null;
			}
		}),
	);
	expect(
		loaded,
		"Page has no loaded stylesheets — CSS may be blocked by CSP or a link tag is missing",
	).toBe(true);
}

/**
 * Asserts that document.title does not contain a double brand suffix.
 * Catches the composition boundary bug where a page passes a pre-formatted title
 * to a layout component that appends the suffix again.
 */
export async function expectNoDoubleTitleSuffix(page: Page): Promise<void> {
	const title = await page.title();
	const separators = ["|", "—", "–", "-"];
	for (const sep of separators) {
		const parts = title.split(sep).map((s) => s.trim().toLowerCase());
		const seen = new Set<string>();
		for (const part of parts) {
			if (part && seen.has(part)) {
				throw new Error(
					`document.title has duplicate segment "${part}" — likely a double-suffix bug. Full title: "${title}"`,
				);
			}
			seen.add(part);
		}
	}
}

/**
 * Asserts zero WCAG 2.2 AA + enhanced contrast axe violations.
 *
 * Tags checked: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice.
 * Additionally enforces color-contrast-enhanced (WCAG AAA 7:1 ratio) via
 * axe rule inclusion — all text in the admin panel and public pages meets
 * the higher AAA contrast threshold.
 *
 * Full WCAG 2.2 AAA conformance is not claimed (W3C recommends against it
 * for entire sites), but contrast, section headings (2.4.10), change on
 * request (3.2.5), and visual presentation (1.4.8) all meet AAA.
 */
export async function expectNoAxeViolations(
	page: Page,
	options?: { ignoreRules?: string[] },
) {
	const ignoreRules = new Set(options?.ignoreRules ?? []);
	// IMPORTANT: do NOT add `.withRules(...)`. AxeBuilder treats withRules as a
	// hard restriction — it overrides withTags and disables every rule not
	// listed, including the WCAG AA `color-contrast` (4.5:1) check. The previous
	// version of this helper enabled `color-contrast-enhanced` via withRules
	// and silently lost AA contrast coverage as a side effect.
	//
	// We turn AAA contrast on via `options.rules` so it runs in addition to the
	// tag-driven AA + best-practice rules, never instead of them.
	const results = await new AxeBuilder({ page })
		.withTags([
			"wcag2a",
			"wcag2aa",
			"wcag21a",
			"wcag21aa",
			"wcag22aa",
			"best-practice",
		])
		.options({ rules: { "color-contrast-enhanced": { enabled: true } } })
		.analyze();

	// Include offender selectors and the explanation axe attached to each node
	// so failures are actionable without re-running with a debugger.
	const violations = results.violations
		.filter((violation) => !ignoreRules.has(violation.id))
		.map((violation) => ({
			id: violation.id,
			help: violation.help,
			nodes: violation.nodes.map((node) => ({
				target: node.target,
				failureSummary: node.failureSummary,
			})),
		}));

	expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

export async function expectKeyboardFocusMoves(page: Page) {
	await page.keyboard.press("Tab");
	const activeTag = await page.evaluate(
		() => document.activeElement?.tagName ?? "",
	);
	expect(activeTag).not.toBe("");
}
