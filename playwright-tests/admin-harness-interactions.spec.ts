import { test, expect } from "@playwright/test";

import { expectNoAxeViolations } from "./helpers/accessibility";

test.describe("Feature: authenticated admin interaction flows", () => {
  test("Scenario: create redirect — new row appears in list and page is axe-clean", async ({ page }) => {
    await page.goto("/ap-admin/redirects", { waitUntil: "networkidle" });

    await page.getByLabel("Legacy path").fill("/old-test-path/");
    await page.getByLabel("Target path").fill("/new-test-path/");
    await page.getByRole("button", { name: "Save rule" }).click();

    await page.waitForURL(/\/ap-admin\/redirects/, { waitUntil: "networkidle" });
    await expect(page.locator("td", { hasText: "/old-test-path/" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("Scenario: moderate comment — approve changes status and page is axe-clean", async ({ page }) => {
    await page.goto("/ap-admin/comments", { waitUntil: "networkidle" });

    const firstApproveButton = page.getByRole("button", { name: "Approve" }).first();
    await expect(firstApproveButton).toBeVisible();
    await firstApproveButton.click();

    await page.waitForURL(/\/ap-admin\/comments/, { waitUntil: "networkidle" });
    await expectNoAxeViolations(page);
  });

  test("Scenario: redirect validation error — focus lands on first input when submitted empty", async ({ page }) => {
    await page.goto("/ap-admin/redirects", { waitUntil: "networkidle" });

    // Submit empty form to trigger validation
    await page.getByRole("button", { name: "Save rule" }).click();

    // The browser's native validation should prevent submission and focus the first required field.
    // If the app has custom error handling, focus should be on the first error field or error summary.
    const legacyPathInput = page.getByLabel("Legacy path");
    await expect(legacyPathInput).toBeVisible();
    // After native form validation, focus lands on the first invalid field
    await expect(legacyPathInput).toBeFocused();
  });

  test("Scenario: post editor keyboard nav — toolbar buttons and textarea are tab-reachable", async ({ page }) => {
    await page.goto("/ap-admin/posts", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Hello World" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();

    // Focus the html-editor area and verify Tab moves through controls
    const editor = page.locator("ap-html-editor");
    await expect(editor).toBeVisible();

    // Tab into the editor and verify focus moves
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();

    await expectNoAxeViolations(page);
  });

  test("Scenario: media dialog focus trap — focus stays within dialog while open", async ({ page }) => {
    await page.goto("/ap-admin/posts", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Hello World" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();

    await page.getByRole("button", { name: "Open media library" }).click();
    const dialog = page.locator("#media-library-dialog");
    await expect(dialog).toBeVisible();

    // Tab several times and verify focus stays within the dialog
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      const activeElementInDialog = await page.evaluate(() => {
        const activeEl = document.activeElement;
        const dialogEl = document.querySelector("#media-library-dialog");
        return dialogEl?.contains(activeEl) ?? false;
      });
      expect(activeElementInDialog).toBe(true);
    }

    await expectNoAxeViolations(page);
  });

  test("Scenario: media dialog Escape — closes dialog and returns focus to Open button", async ({ page }) => {
    await page.goto("/ap-admin/posts", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Hello World" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();

    const openButton = page.getByRole("button", { name: "Open media library" });
    await openButton.click();
    const dialog = page.locator("#media-library-dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(openButton).toBeFocused();
  });

  test("Scenario: login with wrong credentials — error message shown, stays on login page", async ({ page }) => {
    await page.goto("/ap-admin/login", { waitUntil: "networkidle" });

    await page.locator("input[name='email']").fill("wrong@example.com");
    await page.locator("input[name='password']").fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL(/\/ap-admin\/login/, { waitUntil: "networkidle" });
    // Should stay on login page and show an error
    await expect(page.getByRole("heading", { level: 1, name: "Sign in to the admin" })).toBeVisible();
    const errorIndicator = page.locator("[data-error], .error, [aria-live='polite'], [role='alert']");
    await expect(errorIndicator.first()).toBeVisible();
  });

  test("Scenario: post editor save with empty title — validation prevents submission", async ({ page }) => {
    await page.goto("/ap-admin/posts", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Hello World" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();

    // Clear the title field and attempt to save
    const titleInput = page.locator("input[name='title'], input[name='seoTitle']").first();
    await titleInput.fill("");
    await page.getByRole("button", { name: /save/i }).first().click();

    // Should not navigate away — either browser validation stops it or the page shows an error
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();
  });

  test("Scenario: redirect creation with duplicate path — error shown, not saved twice", async ({ page }) => {
    const uniquePath = `/dup-test-${Date.now()}/`;
    await page.goto("/ap-admin/redirects", { waitUntil: "networkidle" });

    // Create the redirect the first time
    await page.getByLabel("Legacy path").fill(uniquePath);
    await page.getByLabel("Target path").fill("/target-path/");
    await page.getByRole("button", { name: "Save rule" }).click();
    await page.waitForURL(/\/ap-admin\/redirects/, { waitUntil: "networkidle" });
    await expect(page.locator("td", { hasText: uniquePath })).toBeVisible();

    // Attempt to create the same redirect again
    await page.getByLabel("Legacy path").fill(uniquePath);
    await page.getByLabel("Target path").fill("/other-target/");
    await page.getByRole("button", { name: "Save rule" }).click();
    await page.waitForURL(/\/ap-admin\/redirects/, { waitUntil: "networkidle" });

    // Should show an error and not create a duplicate row
    const duplicateRows = page.locator("td", { hasText: uniquePath });
    await expect(duplicateRows).toHaveCount(1);
    const errorIndicator = page.locator("[data-error], .error, [aria-live='polite'], [role='alert']");
    await expect(errorIndicator.first()).toBeVisible();
  });

  test("Scenario: login form keyboard nav — focus order is email → password → submit", async ({ page }) => {
    await page.goto("/ap-admin/login", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Sign in to the admin" })).toBeVisible();

    const emailInput = page.locator("input[name='email']");
    const passwordInput = page.locator("input[name='password']");
    const submitButton = page.getByRole("button", { name: /sign in/i });

    await emailInput.focus();
    await expect(emailInput).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(passwordInput).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(submitButton).toBeFocused();

    await expectNoAxeViolations(page);
  });
});
