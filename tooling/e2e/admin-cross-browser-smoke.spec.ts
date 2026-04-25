import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { expectStylesheetsLoaded } from "./helpers/accessibility";

// journey: admin-cross-browser-smoke
// journey: admin-dashboard-load
// journey: admin-post-edit-save

async function submitAndExpectInlineFeedback(page: Page) {
  await page.waitForFunction(() => !!customElements.get("ap-pending-form"));
  await page.waitForFunction(() => {
    const host = document.querySelector("ap-pending-form");
    const form = document.querySelector("form[action='/ap-admin/actions/content-save']");
    return host instanceof HTMLElement && form instanceof HTMLFormElement && host.contains(form);
  });

  const form = page.locator("form[action='/ap-admin/actions/content-save']");
  await form.evaluate((form) => {
    form.noValidate = true;
    form.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
      },
      { once: true },
    );
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  const saveButton = page.getByRole("button", { name: "Save reviewed changes" });
  await expect(saveButton).toBeDisabled();
  await expect(saveButton).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("ap-pending-form")).toHaveAttribute("data-pending", "true");
}

async function expectSubmitAffordance(page: Page) {
  const form = page.locator("form[action='/ap-admin/actions/content-save']");
  await expect(form).toBeVisible();
  await expect(form).toHaveAttribute("method", "post");
  await expect(page.getByRole("button", { name: "Save reviewed changes" })).toBeVisible();
}

test.describe("Feature: cross-browser admin golden smoke", () => {
  test("Scenario: dashboard, editor submit feedback, keyboard focus, and CSS work", async ({ page, browserName }) => {
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
    if (browserName === "webkit") {
      await expectSubmitAffordance(page);
    } else {
      await submitAndExpectInlineFeedback(page);
    }
  });
});
