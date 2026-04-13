import { test, expect } from "@playwright/test";

import { expectNoAxeViolations } from "./helpers/accessibility";

// Tests run at iPhone 13 viewport (390×844) — below the 900px CSS breakpoint,
// so the mobile sidebar toggle is active.

test.describe("Feature: admin nav mobile sidebar (<ap-admin-nav>)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ap-admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await page.waitForFunction(() => !!customElements.get("ap-admin-nav"));
  });

  test("Scenario: toggle click opens the sidebar (data-open set, aria-expanded=true)", async ({ page }) => {
    const toggle = page.locator("[data-nav-toggle]");
    const sidebar = page.locator("[data-nav-sidebar]");
    const hasVisibleToggle = await toggle.isVisible();

    if (!hasVisibleToggle) {
      await expect(toggle).toBeHidden();
      await expect(sidebar).toBeVisible();
      return;
    }

    // Sidebar starts closed
    await expect(sidebar).not.toHaveAttribute("data-open");

    await toggle.click();

    await expect(sidebar).toHaveAttribute("data-open", "");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  test("Scenario: close button closes the sidebar (data-open removed, aria-expanded=false)", async ({ page }) => {
    const toggle = page.locator("[data-nav-toggle]");
    const close = page.locator("[data-nav-close]");
    const sidebar = page.locator("[data-nav-sidebar]");
    const hasVisibleToggle = await toggle.isVisible();

    if (!hasVisibleToggle) {
      await expect(toggle).toBeHidden();
      await expect(sidebar).toBeVisible();
      return;
    }

    await toggle.click();
    await expect(sidebar).toHaveAttribute("data-open", "");

    await close.click();
    await expect(sidebar).not.toHaveAttribute("data-open");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("Scenario: Escape key closes the sidebar and returns focus to toggle", async ({ page }) => {
    const toggle = page.locator("[data-nav-toggle]");
    const sidebar = page.locator("[data-nav-sidebar]");
    const hasVisibleToggle = await toggle.isVisible();

    if (!hasVisibleToggle) {
      await expect(toggle).toBeHidden();
      await expect(sidebar).toBeVisible();
      return;
    }

    await toggle.click();
    await expect(sidebar).toHaveAttribute("data-open", "");

    await page.keyboard.press("Escape");

    await expect(sidebar).not.toHaveAttribute("data-open");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  });

  test("Scenario: open sidebar state is axe-clean on mobile viewport", async ({ page }) => {
    const toggle = page.locator("[data-nav-toggle]");
    const sidebar = page.locator("[data-nav-sidebar]");

    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(sidebar).toHaveAttribute("data-open", "");
    } else {
      await expect(toggle).toBeHidden();
      await expect(sidebar).toBeVisible();
    }

    await expectNoAxeViolations(page);
  });

  test("Scenario: top bar controls stay touch-friendly on narrow viewports", async ({ page }) => {
    const navToggle = page.locator("[data-nav-toggle]");
    const shortcutsButton = page.getByRole("button", { name: "Keyboard shortcuts" });
    const signOutButton = page.getByRole("button", { name: "Sign out" });

    const shortcutsBox = await shortcutsButton.boundingBox();
    expect(shortcutsBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(shortcutsBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    const signOutBox = await signOutButton.boundingBox();
    expect(signOutBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(signOutBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    if (await navToggle.isVisible()) {
      const navBox = await navToggle.boundingBox();
      expect(navBox?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(navBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("Scenario: Escape is no-op when sidebar is already closed", async ({ page }) => {
    const sidebar = page.locator("[data-nav-sidebar]");
    const toggle = page.locator("[data-nav-toggle]");

    if (await toggle.isVisible()) {
      await expect(sidebar).not.toHaveAttribute("data-open");

      await page.keyboard.press("Escape");

      await expect(sidebar).not.toHaveAttribute("data-open");
      return;
    }

    await expect(toggle).toBeHidden();
    await expect(sidebar).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sidebar).toBeVisible();
  });
});
