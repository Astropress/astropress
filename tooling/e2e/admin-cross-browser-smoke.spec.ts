import { expect, test } from "@playwright/test";

import { expectStylesheetsLoaded } from "./helpers/accessibility";

// journey: admin-cross-browser-smoke
// journey: admin-dashboard-load
// journey: admin-post-edit-save

test.describe("Feature: cross-browser admin golden smoke", () => {
  test("Scenario: dashboard, editor save feedback, keyboard focus, and CSS work", async ({ page }) => {
    await page.goto("/ap-admin", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expectStylesheetsLoaded(page);

    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();

    await page.goto("/ap-admin/posts/hello-world", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Edit Post" })).toBeVisible();
    await expectStylesheetsLoaded(page);

    await page
      .locator("textarea[aria-label='Body HTML']")
      .fill(`<p>Cross-browser smoke save ${Date.now()}</p>`);
    await page.getByRole("button", { name: "Save reviewed changes" }).click();

    await page.waitForURL(/\/ap-admin\/posts\/hello-world\?saved=1/, {
      waitUntil: "networkidle",
    });
    await expect(page.locator("ap-notice[type='success']")).toContainText("Changes saved successfully");
  });
});
