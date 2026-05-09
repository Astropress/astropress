import { expect, test } from "@playwright/test";

// Smoke test for the visual section editor on the route-page admin route.
// Requires a seeded route page (the harness seed is expected to provide one);
// if no route pages exist, the test is skipped — see the harness CRUD spec
// for the seed flow.

test.describe("Admin: visual section editor smoke", () => {
	test("Scenario: route-page editor mounts ap-section-editor", async ({ page }) => {
		// Pick whatever the first row in the route-pages list links to.
		await page.goto("/ap-admin/route-pages", { waitUntil: "domcontentloaded" });
		const firstEditLink = page.getByRole("link", { name: /open|edit/i }).first();
		const count = await firstEditLink.count();
		test.skip(count === 0, "no seeded route page available");

		await firstEditLink.click();
		await page.waitForLoadState("domcontentloaded");

		// The section editor is the new mount point; presence of the custom
		// element + a hidden sectionsJson input proves the editor took over
		// from the legacy textarea.
		await expect(page.locator("ap-section-editor")).toBeVisible();
		await expect(page.locator("ap-section-editor input[name=sectionsJson]")).toHaveCount(1);
		await expect(page.locator("ap-section-editor [data-section-editor-add]")).toBeVisible();
	});

	test("Scenario: live preview iframe is mounted", async ({ page }) => {
		await page.goto("/ap-admin/route-pages", { waitUntil: "domcontentloaded" });
		const firstEditLink = page.getByRole("link", { name: /open|edit/i }).first();
		const count = await firstEditLink.count();
		test.skip(count === 0, "no seeded route page available");

		await firstEditLink.click();
		await page.waitForLoadState("domcontentloaded");

		await expect(page.locator("ap-page-preview iframe")).toBeAttached();
	});
});
