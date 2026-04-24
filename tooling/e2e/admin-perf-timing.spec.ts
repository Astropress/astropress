import { expect, test } from "@playwright/test";

// Rubric 52 (Interaction Design & Motion) — A+ behavioral coverage, part 2.
//
// Complements admin-interaction-timing.spec.ts (notice dismiss timing) with
// the other two claims from issue #57:
//
//   1. Loading indicators appear within 100ms of async action start.
//      The admin now wraps write-oriented forms in <ap-pending-form>, which
//      flips aria-busy="true" on the submit button synchronously in the
//      submit-event phase. We measure click → aria-busy transition.
//
//   2. CLS (Cumulative Layout Shift) < 0.1 on admin route transitions.
//      Uses the Layout Instability API (PerformanceObserver type 'layout-shift').
//      Threshold 0.1 matches Google Web Vitals "Good".
//
// Retries: the perf project in playwright.config.ts gives this spec retries=1
// because timing measurements can hiccup under CPU contention.

test.describe("Rubric 52: loading indicator appears ≤ 100ms", () => {
	test("Scenario: redirect Save button flips aria-busy within 100ms of click", async ({
		page,
	}) => {
		await page.goto("/ap-admin/redirects", { waitUntil: "domcontentloaded" });
		await page.waitForFunction(() => !!customElements.get("ap-pending-form"));

		// Pre-fill the form to avoid browser validation pre-empting submission.
		await page.getByLabel("Legacy path").fill("/perf-probe-source");
		await page.getByLabel("Target path").fill("/perf-probe-target");

		// Capture intent-to-signal latency as measured inside the page.
		// We install the listener via page.evaluate so the submit-event handler
		// and the performance.now() reading live in the same event loop.
		const latency = await page.evaluate(async () => {
			const button = document.querySelector(
				'#new-rule button[type="submit"]',
			) as HTMLButtonElement | null;
			if (!button) throw new Error("submit button not found");

			return await new Promise<number>((resolve) => {
				let clickAt = 0;
				const observer = new MutationObserver((mutations) => {
					for (const m of mutations) {
						if (
							m.type === "attributes" &&
							m.attributeName === "aria-busy" &&
							(m.target as Element).getAttribute("aria-busy") === "true"
						) {
							const now = performance.now();
							observer.disconnect();
							resolve(now - clickAt);
							return;
						}
					}
				});
				observer.observe(button, { attributes: true });
				clickAt = performance.now();
				button.click();
			});
		});

		expect(
			latency,
			`aria-busy appeared ${latency.toFixed(1)}ms after click`,
		).toBeLessThan(100);
	});

	test("Scenario: data-pending flips on the host element synchronously too", async ({
		page,
	}) => {
		await page.goto("/ap-admin/redirects", { waitUntil: "domcontentloaded" });
		await page.waitForFunction(() => !!customElements.get("ap-pending-form"));

		await page.getByLabel("Legacy path").fill("/perf-probe-source-2");
		await page.getByLabel("Target path").fill("/perf-probe-target-2");

		const pendingSeen = await page.evaluate(async () => {
			const host = document.querySelector("ap-pending-form");
			const button = host?.querySelector(
				'button[type="submit"]',
			) as HTMLButtonElement | null;
			if (!host || !button) return false;
			button.click();
			// Read the attribute in the micro-task right after click returns.
			// A synchronous submit-event handler runs before we reach here.
			return host.getAttribute("data-pending") === "true";
		});
		expect(pendingSeen).toBe(true);
	});
});

test.describe("Rubric 52: CLS stays low on admin navigation", () => {
	const ADMIN_ROUTES = [
		"/ap-admin",
		"/ap-admin/posts",
		"/ap-admin/media",
		"/ap-admin/redirects",
	];

	// Relaxed initial threshold per issue #57 ("Use relaxed upper bounds first
	// (≤200ms, CLS<0.25) and tighten once CI noise is characterized."). Treat
	// 0.25 as the upper guardrail and log the actual value so baseline tightening
	// has a data point on every CI run.
	const CLS_MAX = 0.25;

	for (const route of ADMIN_ROUTES) {
		test(`Scenario: CLS on ${route} stays below ${CLS_MAX}`, async ({
			page,
		}) => {
			await page.addInitScript(() => {
				(globalThis as unknown as { __clsValue: number }).__clsValue = 0;
				const po = new PerformanceObserver((list) => {
					for (const entry of list.getEntries()) {
						const ls = entry as PerformanceEntry & {
							value: number;
							hadRecentInput?: boolean;
						};
						if (!ls.hadRecentInput) {
							(globalThis as unknown as { __clsValue: number }).__clsValue +=
								ls.value;
						}
					}
				});
				po.observe({ type: "layout-shift", buffered: true });
			});
			await page.goto(route, { waitUntil: "networkidle" });
			// Give late-rendering content a frame to settle
			await page.waitForTimeout(500);
			const cls = await page.evaluate(
				() => (globalThis as unknown as { __clsValue: number }).__clsValue,
			);
			console.log(`[rubric-52-cls] ${route} CLS=${cls.toFixed(4)}`);
			expect(cls, `CLS on ${route} = ${cls.toFixed(4)}`).toBeLessThan(CLS_MAX);
		});
	}
});
