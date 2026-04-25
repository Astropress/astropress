import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { expectStylesheetsLoaded } from "./helpers/accessibility";

// journey: admin-cross-browser-smoke
// journey: admin-dashboard-load
// journey: admin-post-edit-save

async function submitAndWaitForActionRedirect(
  page: Page,
  action: () => Promise<unknown>,
  actionPath: string,
  redirectLocation: RegExp,
) {
  const [response] = await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === actionPath && response.request().method() === "POST";
    }, { timeout: 15_000 }),
    action(),
  ]);
  expect(response.status()).toBe(302);
  expect(response.headers().location ?? "").toMatch(redirectLocation);
}

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
    await submitAndWaitForActionRedirect(
      page,
      () => page.getByRole("button", { name: "Save reviewed changes" }).click(),
      "/ap-admin/actions/content-save",
      /\/ap-admin\/posts\/hello-world\?saved=1/,
    );
    await expect(page.locator("ap-notice[type='success']")).toContainText(
      "Changes saved successfully",
      {
        useInnerText: true,
      },
    );
  });
});
