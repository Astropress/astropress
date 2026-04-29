import { test, expect } from "@playwright/test";

import { expectKeyboardFocusMoves, expectNoAxeViolations, expectNoDoubleTitleSuffix, expectStylesheetsLoaded } from "./helpers/accessibility";

const routes = [
  { path: "/ap-admin", heading: "Dashboard" },
  { path: "/ap-admin/posts", heading: "Posts" },
  { path: "/ap-admin/comments", heading: "Comments" },
  { path: "/ap-admin/redirects", heading: "Redirects" },
  { path: "/ap-admin/login", heading: "Sign in to the admin" },
  { path: "/ap-admin/reset-password", heading: "Reset password" },
  { path: "/ap-admin/accept-invite?token=demo", heading: "Accept invitation" },
];

const themes = ["light", "dark"] as const;

test.describe("Feature: package-owned admin accessibility coverage", () => {
  for (const theme of themes) {
    for (const route of routes) {
      test(`Scenario: ${route.path} (${theme}) is keyboard reachable and axe clean`, async ({ page, context }) => {
        // <ap-theme-toggle> reads localStorage["theme"] in connectedCallback and
        // applies data-theme on <html>. Seeding it before navigation makes every
        // route render in the requested palette without needing a UI click.
        await context.addInitScript((value) => {
          window.localStorage.setItem("theme", value);
        }, theme);

        await page.goto(route.path, { waitUntil: "networkidle" });
        await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();

        // Belt-and-braces: pages without <ap-theme-toggle> in their template
        // (or before the WC has connected) won't pick up the localStorage
        // value on their own. Force the data-theme attribute too so axe sees
        // the right computed colors.
        await page.evaluate((value) => {
          document.documentElement.setAttribute("data-theme", value);
        }, theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

        // Regression guard: CSP must not block stylesheets (e.g. allowInlineStyles omitted
        // from middleware causes unstyled login/auth pages in dev mode).
        await expectStylesheetsLoaded(page);
        await expectNoDoubleTitleSuffix(page);
        await expectKeyboardFocusMoves(page);
        await expectNoAxeViolations(page);
      });
    }
  }

  test("Scenario: redirects confirmation dialog is keyboard operable", async ({ page }) => {
    await page.goto("/ap-admin/redirects", { waitUntil: "networkidle" });
    await page.locator("[data-confirm-delete]").first().click();
    const dialog = page.locator("#confirm-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Delete redirect rule?" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario: comments rejection dialog restores focus and remains axe clean", async ({ page }) => {
    await page.goto("/ap-admin/comments", { waitUntil: "networkidle" });
    const trigger = page.locator("[data-confirm-reject]").first();
    await trigger.click();
    const dialog = page.locator("#reject-dialog");
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test("Scenario: post editor media dialog opens from the canonical textarea editor", async ({ page }) => {
    await page.goto("/ap-admin/posts", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Hello World" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Body HTML" })).toBeVisible();
    await page.getByRole("button", { name: "Open media library" }).click();
    const dialog = page.locator("#media-library-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Media Library" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(dialog).not.toBeVisible();
  });
});
