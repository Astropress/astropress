import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const adminLayout = readFileSync(path.join(root, "components", "AdminLayout.astro"), "utf8");
const adminCss = readFileSync(path.join(root, "public", "admin.css"), "utf8");
const importPage = readFileSync(path.join(root, "pages", "ap-admin", "import", "[source].astro"), "utf8");
const subscriberPage = readFileSync(path.join(root, "pages", "ap-admin", "subscribers", "[id].astro"), "utf8");

describe("admin shell ux invariants", () => {
  it("ships a viewport meta tag and keyboard shortcuts popover in the shared admin layout", () => {
    expect(adminLayout).toContain('<meta name="viewport" content="width=device-width, initial-scale=1" />');
    expect(adminLayout).toContain('popovertarget="admin-keyboard-shortcuts"');
    expect(adminLayout).toContain("<h2>Keyboard shortcuts</h2>");
    expect(adminLayout).toContain("<kbd>Ctrl</kbd>+<kbd>K</kbd>");
  });

  it("keeps reduced-motion handling in the shared stylesheet", () => {
    expect(adminCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(adminCss).toContain(".skeleton { animation: none;");
    expect(adminCss).toContain(".undo-toast { animation: none; }");
  });

  it("keeps shared touch targets at 44px or larger", () => {
    expect(adminCss).toContain("min-height: 2.75rem;");
    expect(adminCss).toContain("min-width: 2.75rem;");
  });

  it("renders breadcrumbs on deep admin pages", () => {
    expect(importPage).toContain('<nav class="breadcrumb" aria-label="breadcrumb">');
    expect(subscriberPage).toContain('<nav class="breadcrumb" aria-label="breadcrumb">');
  });

  it("ships shared confirm-dialog styles in admin.css", () => {
    expect(adminCss).toContain(".confirm-modal");
    expect(adminCss).toContain(".modal-content");
    expect(adminCss).toContain(".modal-actions");
    expect(adminCss).toContain(".dialog-warning");
  });

  it("wires generic form submit loading state in admin layout", () => {
    expect(adminLayout).toContain("btn.disabled = true");
    expect(adminLayout).toContain('button[type="submit"]');
    expect(adminLayout).toContain("\\u2026");
  });

  it("ships shared breadcrumb styles in admin.css", () => {
    expect(adminCss).toContain(".breadcrumb");
    expect(adminCss).toContain(".breadcrumb a");
  });
});
