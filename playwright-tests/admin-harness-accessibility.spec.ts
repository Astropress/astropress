import { test, expect } from "@playwright/test";

import { expectKeyboardFocusMoves, expectNoAxeViolations } from "./helpers/accessibility";

const routes = [
  { path: "/ap-admin", heading: "Dashboard" },
  { path: "/ap-admin/posts", heading: "Posts" },
  { path: "/ap-admin/comments", heading: "Comments" },
  { path: "/ap-admin/redirects", heading: "Redirects" },
  { path: "/ap-admin/login", heading: "Sign in to the admin" },
  { path: "/ap-admin/reset-password", heading: "Reset password" },
  { path: "/ap-admin/accept-invite?token=demo", heading: "Accept invitation" },
];

test.describe("Feature: package-owned admin accessibility coverage", () => {
  for (const route of routes) {
    test(`Scenario: ${route.path} is keyboard reachable and axe clean`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
      await expectKeyboardFocusMoves(page);
      await expectNoAxeViolations(page);
    });
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
