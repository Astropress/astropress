import { test, expect } from "@playwright/test";

import { expectNoAxeViolations, expectStylesheetsLoaded } from "./helpers/accessibility";

// Routes that were previously uncovered (73% of admin routes had zero Playwright
// coverage). Each test navigates to the route, verifies the primary heading renders,
// asserts CSS is loaded (guards against the CSP-blocking-inline-styles bug), and
// runs an axe accessibility scan.
//
// Feature-gated routes (cms, fundraising, host) are omitted here because they
// redirect to the dashboard when not configured; they are covered by the HTTP
// smoke test (run-consumer-smoke.ts) which follows redirects.

const staticRoutes: Array<{ path: string; heading: string }> = [
  { path: "/ap-admin/settings", heading: "Settings" },
  { path: "/ap-admin/seo", heading: "SEO" },
  { path: "/ap-admin/system", heading: "System" },
  { path: "/ap-admin/api-tokens", heading: "API Tokens" },
  { path: "/ap-admin/authors", heading: "Authors" },
  { path: "/ap-admin/taxonomies", heading: "Taxonomies" },
  { path: "/ap-admin/translations", heading: "Translations" },
  { path: "/ap-admin/archives", heading: "Archives" },
  { path: "/ap-admin/route-pages", heading: "Route Table" },
  { path: "/ap-admin/pages", heading: "Pages" },
  { path: "/ap-admin/services", heading: "Services" },
  { path: "/ap-admin/webhooks", heading: "Webhooks" },
];

test.describe("Feature: admin panel smoke coverage — all static routes load with CSS", () => {
  for (const { path, heading } of staticRoutes) {
    test(`Scenario: ${path} loads with heading and stylesheets`, async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });

      // Heading visible — ensures SSR rendered successfully (not 500).
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();

      // CSS loaded — guards against CSP blocking inline styles or missing stylesheet link.
      await expectStylesheetsLoaded(page);

      // Axe clean — no WCAG regressions.
      await expectNoAxeViolations(page);
    });
  }
});
