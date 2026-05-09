/**
 * Regression guards for the pre-alpha walkthrough fixes (PR #75 follow-up).
 *
 * Each test corresponds to a UX issue surfaced during the manual walkthrough:
 *
 *   1. /sections.css served as text/css (live preview was unstyled)
 *   2. Section editor reachable from /pages and rendered as the first card
 *   3. /pages/new submits without filling SEO fields (SEO is now optional)
 *   4. Admin URL "Avoid generic paths" warning has whitespace around <code>
 *   5. Mobile topbar at 375px does not overlap brand + identity
 *   6. RTL (locale=ar) emits dir="rtl" + applies unicode-bidi to body copy
 *   7. Section editor "Add section" dialog renders all 4 templates
 *   8. Live preview iframe loads /sections.css without console error
 */
import { expect, test } from "@playwright/test";

const ADMIN = "/ap-admin";

test.describe("pre-alpha walkthrough regression guards", () => {
	test("Scenario: /sections.css is served as text/css", async ({ request }) => {
		const res = await request.get("/sections.css");
		expect(res.status()).toBe(200);
		const ct = res.headers()["content-type"] ?? "";
		expect(ct, `expected text/css mime, got "${ct}"`).toMatch(/text\/css/);
		const body = await res.text();
		expect(body.length).toBeGreaterThan(0);
	});

	test("Scenario: /admin.css is served as text/css", async ({ request }) => {
		const res = await request.get("/admin.css");
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"] ?? "").toMatch(/text\/css/);
	});

	test("Scenario: /pages exposes the section editor for structured pages", async ({ page }) => {
		await page.goto(`${ADMIN}/pages`, { waitUntil: "domcontentloaded" });
		// Harness seeds /welcome as a structured page so the editor link is
		// reachable from the public pages list.
		const link = page.locator('a[href*="/ap-admin/route-pages/welcome"]').first();
		await expect(link).toBeVisible();
		await link.click();
		await page.waitForLoadState("domcontentloaded");
		// The new editor should be the first content card after the form
		// header — sections-first ordering instead of being buried below
		// General/SEO/etc.
		const firstPanel = page.locator("main form .panel").first();
		await expect(firstPanel.locator("ap-section-editor")).toHaveCount(1);
	});

	test("Scenario: section editor heading is 'Sections' (not 'Sections JSON')", async ({ page }) => {
		await page.goto(`${ADMIN}/route-pages/welcome`, {
			waitUntil: "domcontentloaded",
		});
		const headings = await page.locator("main h2").allTextContents();
		expect(headings, `headings: ${JSON.stringify(headings)}`).not.toContain("Sections JSON");
		expect(headings).toContain("Sections");
	});

	test("Scenario: /pages/new accepts a submit without SEO Title or Meta Description", async ({
		page,
	}) => {
		await page.goto(`${ADMIN}/pages/new`, { waitUntil: "domcontentloaded" });
		const seoTitle = page.locator('input[name="seoTitle"]');
		const meta = page.locator('textarea[name="metaDescription"]');
		// SEO fields must NOT be required HTML5 fields — the operator drafts now,
		// fills SEO later from the editor.
		expect(await seoTitle.getAttribute("required")).toBeNull();
		expect(await meta.getAttribute("required")).toBeNull();
		// Visible "(optional)" hint copy is present under the SEO heading so the
		// operator knows they can skip these.
		await expect(page.locator("text=/optional/i").first()).toBeVisible();
	});

	test("Scenario: admin URL warning leaves whitespace around inline code tokens", async ({
		page,
	}) => {
		await page.goto(`${ADMIN}/route-pages`, { waitUntil: "domcontentloaded" });
		const note = page.locator(".field-note").filter({ hasText: /admin/i }).first();
		await expect(note).toBeVisible();
		// Render-time computed style: the inline-margin rule we added must
		// produce a non-zero margin around the <code> token so the prose
		// reads as separate words.
		const margin = await note
			.locator("code")
			.first()
			.evaluate((el) => {
				const s = window.getComputedStyle(el);
				return {
					inlineStart: parseFloat(s.marginInlineStart || "0"),
					paddingInline: parseFloat(s.paddingInlineStart || "0"),
				};
			});
		expect(
			margin.paddingInline + margin.inlineStart,
			`expected non-zero inline padding/margin around <code>, got ${JSON.stringify(margin)}`,
		).toBeGreaterThan(0);
	});

	test("Scenario: locale=ar emits dir=rtl and applies bidi-plaintext to body copy", async ({
		context,
		page,
	}) => {
		await context.addCookies([
			{ name: "astropress_admin_locale", value: "ar", url: "http://127.0.0.1" },
		]);
		await page.goto(ADMIN, { waitUntil: "domcontentloaded" });
		expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
		expect(await page.evaluate(() => document.documentElement.lang)).toBe("ar");
		const bidi = await page
			.locator("main p")
			.first()
			.evaluate((el) => window.getComputedStyle(el).unicodeBidi);
		expect(
			["plaintext", "-webkit-plaintext"].includes(bidi),
			`expected unicode-bidi: plaintext on body copy, got "${bidi}"`,
		).toBe(true);
	});

	test("Scenario: section editor 'Add section' dialog renders all 4 templates", async ({
		page,
	}) => {
		await page.goto(`${ADMIN}/route-pages/welcome`, {
			waitUntil: "domcontentloaded",
		});
		await page.locator("[data-section-editor-add]").first().click();
		const dialog = page.locator("[data-section-editor-add-dialog]");
		await expect(dialog).toBeVisible();
		const tplCount = await dialog.locator("[data-template]").count();
		expect(tplCount, `expected 4 templates (blank, landing, about, contact)`).toBe(4);
		const tplKeys = await dialog
			.locator("[data-template]")
			.evaluateAll((els) => els.map((e) => e.getAttribute("data-template")));
		expect(tplKeys.sort()).toEqual(["about", "blank", "contact", "landing"]);
	});

	test("Scenario: section editor picker shows all 8 section kinds with translated labels", async ({
		page,
	}) => {
		await page.goto(`${ADMIN}/route-pages/welcome`, {
			waitUntil: "domcontentloaded",
		});
		await page.locator("[data-section-editor-add]").first().click();
		const dialog = page.locator("[data-section-editor-add-dialog]");
		const kindKeys = await dialog
			.locator("[data-kind]")
			.evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
		expect(kindKeys.sort()).toEqual([
			"cta-banner",
			"faq",
			"feature-grid",
			"gallery",
			"hero",
			"image-text",
			"rich-text",
			"testimonials",
		]);
		// CTA banner must render a human-readable label, not the raw kind key.
		const ctaButton = dialog.locator('[data-kind="cta-banner"]');
		const ctaLabel = ((await ctaButton.textContent()) ?? "").trim();
		expect(ctaLabel).not.toBe("cta-banner");
		expect(ctaLabel.length).toBeGreaterThan(0);
	});

	test("Scenario: live preview iframe references /sections.css and the URL responds 200", async ({
		page,
		request,
	}) => {
		await page.goto(`${ADMIN}/route-pages/welcome`, {
			waitUntil: "domcontentloaded",
		});
		const stylesheet = await page.locator("ap-page-preview").first().getAttribute("stylesheet");
		expect(stylesheet).toBe("/sections.css");
		const r = await request.get(stylesheet ?? "/sections.css");
		expect(r.status()).toBe(200);
	});
});

test.describe("pre-alpha walkthrough — mobile chrome at 375px", () => {
	test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

	test("Scenario: mobile topbar wraps; brand and identity do not overlap", async ({ page }) => {
		await page.goto(ADMIN, { waitUntil: "domcontentloaded" });
		const brand = page.locator(".topbar-brand").first();
		const meta = page.locator(".topbar-meta").first();
		await expect(brand).toBeVisible();
		await expect(meta).toBeVisible();
		const [b, m] = await Promise.all([brand.boundingBox(), meta.boundingBox()]);
		if (!b || !m) throw new Error("topbar boxes missing");
		// Either brand wraps to its own row (m.y >= b.y + b.height) OR the two
		// boxes do not horizontally overlap. Either is acceptable; overlap is
		// the failure mode we're guarding against.
		const horizontalOverlap = b.x < m.x + m.width && m.x < b.x + b.width;
		const verticallyStacked = m.y >= b.y + b.height - 1;
		expect(
			!horizontalOverlap || verticallyStacked,
			`brand bbox=${JSON.stringify(b)} meta bbox=${JSON.stringify(m)} overlap horizontally and not stacked`,
		).toBe(true);
	});

	test("Scenario: hamburger toggle is visible at 375px and meets WCAG 2.5.5", async ({ page }) => {
		await page.goto(ADMIN, { waitUntil: "domcontentloaded" });
		const toggle = page.locator("[data-nav-toggle]").first();
		await expect(toggle).toBeVisible();
		const box = await toggle.boundingBox();
		expect(box).not.toBeNull();
		expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
		expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
	});
});
