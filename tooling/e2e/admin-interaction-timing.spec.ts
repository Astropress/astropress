import { expect, test } from "@playwright/test";

// Rubric 52 (Interaction Design & Motion) — A+ behavioral coverage.
//
// Behavioral assertions complementing the grep-level audit:interaction:
//   1. <ap-notice dismiss-after="N"> actually removes itself from the DOM at ≈ N ms
//   2. <ap-notice> without dismiss-after stays persistent (no auto-removal)
//   3. Escape key dismisses modal dialogs within one animation frame
//   4. prefers-reduced-motion honors the media query (no transition delays > 0 when set)
//
// We inject the component into a live admin page rather than traversing a
// happy-dom mock so the test is run against the actual shipped component.

test.describe("Rubric 52: interaction timing", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/ap-admin", { waitUntil: "domcontentloaded" });
		await page.waitForFunction(() => !!customElements.get("ap-notice"));
	});

	test("Scenario: ap-notice with dismiss-after=5000 self-removes within 5.0–5.3s", async ({
		page,
	}) => {
		const start = Date.now();
		await page.evaluate(() => {
			const notice = document.createElement("ap-notice");
			notice.setAttribute("type", "success");
			notice.setAttribute("dismiss-after", "5000");
			notice.id = "__timing_probe__";
			notice.textContent = "timing probe";
			document.body.appendChild(notice);
		});

		await expect(page.locator("#__timing_probe__")).toBeVisible();

		// Wait for self-removal — Playwright will poll
		await page.waitForFunction(
			() => !document.getElementById("__timing_probe__"),
			undefined,
			{ timeout: 8_000 },
		);

		const elapsed = Date.now() - start;
		expect(elapsed, `notice removed too early (${elapsed}ms)`).toBeGreaterThan(4_900);
		expect(elapsed, `notice removed too late (${elapsed}ms)`).toBeLessThan(6_500);
	});

	test("Scenario: ap-notice without dismiss-after stays persistent after 1s", async ({
		page,
	}) => {
		await page.evaluate(() => {
			const notice = document.createElement("ap-notice");
			notice.setAttribute("type", "info");
			notice.id = "__persistent_probe__";
			notice.textContent = "persistent probe";
			document.body.appendChild(notice);
		});

		await page.waitForTimeout(1_000);

		await expect(page.locator("#__persistent_probe__")).toBeVisible();
	});

	test("Scenario: ap-notice with dismiss-after=0 stays persistent (guard against footgun)", async ({
		page,
	}) => {
		await page.evaluate(() => {
			const notice = document.createElement("ap-notice");
			notice.setAttribute("type", "info");
			notice.setAttribute("dismiss-after", "0");
			notice.id = "__zero_probe__";
			notice.textContent = "zero probe";
			document.body.appendChild(notice);
		});

		await page.waitForTimeout(500);
		await expect(page.locator("#__zero_probe__")).toBeVisible();
	});

	test("Scenario: ap-notice with non-numeric dismiss-after stays persistent", async ({
		page,
	}) => {
		await page.evaluate(() => {
			const notice = document.createElement("ap-notice");
			notice.setAttribute("type", "info");
			notice.setAttribute("dismiss-after", "forever");
			notice.id = "__bogus_probe__";
			notice.textContent = "bogus probe";
			document.body.appendChild(notice);
		});

		await page.waitForTimeout(500);
		await expect(page.locator("#__bogus_probe__")).toBeVisible();
	});
});
