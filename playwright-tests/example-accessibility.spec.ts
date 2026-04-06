import { test, expect } from "@playwright/test";

import { expectKeyboardFocusMoves, expectNoAxeViolations } from "./helpers/accessibility";

const routes = [
  { path: "/", heading: "A real admin for simple sites, without inheriting all of WordPress." },
  { path: "/docs", heading: "Start with the local path that Astropress validates most heavily." },
  { path: "/providers", heading: "Choose the app host separately from the content services." },
  { path: "/wordpress", heading: "WordPress migration is supported as a staged workflow, not a fake one-click promise." },
  { path: "/operations", heading: "Use doctor, backup, and restore as first-class operational workflows." },
  { path: "/admin", heading: "The admin is the center of the editing workflow." },
];

test.describe("Feature: representative public accessibility coverage", () => {
  for (const route of routes) {
    test(`Scenario: ${route.path} is keyboard reachable and axe clean`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
      await expectKeyboardFocusMoves(page);
      await expectNoAxeViolations(page);
    });
  }
});
