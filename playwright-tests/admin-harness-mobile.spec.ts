import { test, expect } from "@playwright/test";

import { expectNoAxeViolations } from "./helpers/accessibility";

// Tests run at iPhone 13 viewport (390×844) — below the 900px CSS breakpoint,
// so the mobile sidebar toggle is active.

test.describe("Feature: admin nav mobile sidebar (<ap-admin-nav>)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ap-admin", { waitUntil: "networkidle" });
  });

  test("Scenario: toggle click opens the sidebar (data-open set, aria-expanded=true)", async ({ page }) => {
    const toggle = page.locator("[data-nav-toggle]");
    const sidebar = page.locator("[data-nav-sidebar]");

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

    await toggle.click();
    await expect(sidebar).toHaveAttribute("data-open", "");

    await close.click();
    await expect(sidebar).not.toHaveAttribute("data-open");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("Scenario: Escape key closes the sidebar and returns focus to toggle", async ({ page }) => {
    const toggle = page.locator("[data-nav-toggle]");
    const sidebar = page.locator("[data-nav-sidebar]");

    await toggle.click();
    await expect(sidebar).toHaveAttribute("data-open", "");

    await page.keyboard.press("Escape");

    await expect(sidebar).not.toHaveAttribute("data-open");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  });

  test("Scenario: open sidebar state is axe-clean on mobile viewport", async ({ page }) => {
    const toggle = page.locator("[data-nav-toggle]");

    await toggle.click();
    await expect(page.locator("[data-nav-sidebar]")).toHaveAttribute("data-open", "");

    await expectNoAxeViolations(page);
  });

  test("Scenario: Escape is no-op when sidebar is already closed", async ({ page }) => {
    const sidebar = page.locator("[data-nav-sidebar]");

    // Sidebar is closed initially
    await expect(sidebar).not.toHaveAttribute("data-open");

    await page.keyboard.press("Escape");

    // Still closed — no state change
    await expect(sidebar).not.toHaveAttribute("data-open");
  });
});
