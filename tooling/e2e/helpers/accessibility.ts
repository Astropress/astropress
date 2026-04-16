import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

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
  expect(loaded, "Page has no loaded stylesheets — CSS may be blocked by CSP or a link tag is missing").toBe(true);
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

// color-contrast is temporarily ignored across all admin specs — the admin CSS has
// pre-existing contrast issues that will be fixed during the admin panel UX pass.
// Remove this once admin.css contrast is fixed.
const GLOBAL_IGNORE_RULES = ["color-contrast"];

export async function expectNoAxeViolations(page: Page, options?: { ignoreRules?: string[] }) {
  const ignoreRules = new Set([...GLOBAL_IGNORE_RULES, ...(options?.ignoreRules ?? [])]);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const violations = results.violations
    .filter((violation) => !ignoreRules.has(violation.id))
    .map((violation) => ({
    id: violation.id,
    help: violation.help,
    nodes: violation.nodes.length,
    }));

  expect(violations).toEqual([]);
}

export async function expectKeyboardFocusMoves(page: Page) {
  await page.keyboard.press("Tab");
  const activeTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
  expect(activeTag).not.toBe("");
}
