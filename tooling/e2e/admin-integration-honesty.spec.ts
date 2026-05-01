/**
 * Regression guards for the integration-honesty sidebar partition.
 *
 * The sidebar must:
 *   1. Render a separate "Coming soon" group, distinct from "Integrations".
 *   2. Place every leaf marked status="coming-soon" in INTEGRATIONS under
 *      the Coming soon group, with data-coming-soon="true" on the <details>.
 *   3. Place real + env-gated leaves under the Integrations group.
 *   4. Render coming-soon stub pages with the roadmap copy
 *      (no env-var copy-paste hint).
 */
import { expect, test } from "@playwright/test";

const ADMIN = "/ap-admin";

const COMING_SOON_HREFS = [
	"/ap-admin/heatmaps",
	"/ap-admin/email",
	"/ap-admin/live-chat",
	"/ap-admin/image-cdn",
	"/ap-admin/deploy-hooks",
	"/ap-admin/plugins",
];

const REAL_OR_ENV_GATED_HREFS = [
	"/ap-admin/services",
	"/ap-admin/api-tokens",
	"/ap-admin/webhooks",
	"/ap-admin/analytics",
	"/ap-admin/ab-testing",
	"/ap-admin/search",
	"/ap-admin/cdn-purge",
	"/ap-admin/monitoring",
];

test.describe("admin integration honesty", () => {
	test("Scenario: Coming soon group is rendered and visually demoted", async ({
		page,
	}) => {
		await page.goto(ADMIN, { waitUntil: "domcontentloaded" });
		const muted = page.locator(
			'.sidebar-group[data-coming-soon="true"]',
		);
		await expect(muted).toHaveCount(1);
	});

	test("Scenario: every coming-soon leaf is inside the muted group", async ({
		page,
	}) => {
		await page.goto(ADMIN, { waitUntil: "domcontentloaded" });
		const muted = page.locator(
			'.sidebar-group[data-coming-soon="true"]',
		);
		// open the group so its children are queryable in DOM regardless of
		// <details> open state
		await muted.evaluate((el) => {
			(el as HTMLDetailsElement).open = true;
		});
		for (const href of COMING_SOON_HREFS) {
			const link = muted.locator(`a[href="${href}"]`);
			await expect(
				link,
				`expected ${href} under data-coming-soon group`,
			).toHaveCount(1);
		}
	});

	test("Scenario: real + env-gated leaves stay in the Integrations group", async ({
		page,
	}) => {
		await page.goto(ADMIN, { waitUntil: "domcontentloaded" });
		const muted = page.locator(
			'.sidebar-group[data-coming-soon="true"]',
		);
		for (const href of REAL_OR_ENV_GATED_HREFS) {
			// Must NOT appear under the muted group.
			const inMuted = muted.locator(`a[href="${href}"]`);
			await expect(inMuted).toHaveCount(0);
		}
	});

	test("Scenario: coming-soon stub page renders roadmap copy, not env hints", async ({
		page,
	}) => {
		await page.goto(`${ADMIN}/heatmaps`, { waitUntil: "domcontentloaded" });
		// "Coming soon" eyebrow appears (English locale default).
		const eyebrow = page.locator(".stub-eyebrow");
		await expect(eyebrow).toContainText(/coming soon/i);
		// Env-var copy-paste block (<pre><code>registerCms(...)</code></pre>)
		// must NOT be rendered for coming-soon variant.
		await expect(page.locator(".stub-grid pre")).toHaveCount(0);
		// Roadmap link is present.
		const roadmap = page.locator(
			'a[href="https://github.com/Astropress/astropress/issues/76"]',
		);
		await expect(roadmap.first()).toBeVisible();
	});
});
