import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Admin shell invariants: AdminLayout.astro + admin.css + theme toggle.
// Page-specific concerns (breadcrumbs, confirm dialogs, post editor) live
// in their own focused test files so changes to a single page's markup
// only invalidate the relevant suite under stryker incremental.

const root = path.resolve(import.meta.dirname, "..");
const adminLayout = readFileSync(path.join(root, "components", "AdminLayout.astro"), "utf8");
const adminCss = readFileSync(path.join(root, "public", "admin.css"), "utf8");

describe("admin shell ux invariants", () => {
	it("ships a viewport meta tag and keyboard shortcuts popover in the shared admin layout", () => {
		expect(adminLayout).toContain(
			'<meta name="viewport" content="width=device-width, initial-scale=1" />',
		);
		expect(adminLayout).toContain('popovertarget="admin-keyboard-shortcuts"');
		expect(adminLayout).toContain('<h2>{tLayout("layout.keyboardShortcuts")}</h2>');
		expect(adminLayout).toContain("<kbd>Ctrl</kbd>+<kbd>K</kbd>");
	});

	it("has collapsible utility panel using native details/summary", () => {
		expect(adminLayout).toContain('class="topbar-panel-details"');
		expect(adminLayout).toContain('class="topbar-panel-toggle"');
		expect(adminLayout).toContain('id="topbar-utility-panel"');
		// <details>/<summary> gives native toggle without JS; panel stays inline in topbar flex
		expect(adminLayout).toContain("<details");
		expect(adminLayout).toContain("<summary");
	});

	it("utility panel sits inline in the topbar, not as a fixed overlay", () => {
		// No position:fixed on the panel — it flows inside the topbar flex row
		expect(adminCss).not.toMatch(/\.topbar-utility-panel\s*\{[^}]*position:\s*fixed/);
	});

	it("has a scroll-to-top/bottom button in the utility panel", () => {
		expect(adminLayout).toContain('id="scroll-to-bottom-btn"');
		expect(adminLayout).toContain('id="scroll-to-top-fab"');
		expect(adminLayout).toContain('tLayout("layout.scrollToBottom")');
	});

	it("uses CSS animation for undo toast auto-dismiss instead of JS setTimeout", () => {
		expect(adminCss).toContain("ap-toast-out");
		expect(adminCss).toContain("animation:");

		const authorsPage = readFileSync(path.join(root, "pages", "ap-admin", "authors.astro"), "utf8");
		const taxonomiesPage = readFileSync(
			path.join(root, "pages", "ap-admin", "taxonomies.astro"),
			"utf8",
		);
		expect(authorsPage).not.toContain("setTimeout");
		expect(taxonomiesPage).not.toContain("setTimeout");
	});

	it("sets scroll-behavior: smooth on html element", () => {
		expect(adminCss).toContain("scroll-behavior: smooth");
	});

	it("theme toggle uses SVG icons instead of Unicode", () => {
		const themeToggle = readFileSync(path.join(root, "web-components", "theme-toggle.ts"), "utf8");
		expect(themeToggle).toContain("<svg");
		expect(themeToggle).not.toContain('"\\u2600"');
		expect(themeToggle).not.toContain('"☀"');
		expect(themeToggle).not.toContain('"☾"');
	});

	it("keeps reduced-motion handling in the shared stylesheet", () => {
		expect(adminCss).toContain("@media (prefers-reduced-motion: reduce)");
		expect(adminCss).toMatch(/\.skeleton\s*\{\s*animation:\s*none/);
		expect(adminCss).toMatch(/\.undo-toast\s*\{\s*animation:\s*none/);
	});

	it("keeps shared touch targets at 44px or larger", () => {
		expect(adminCss).toContain("min-height: 2.75rem;");
		expect(adminCss).toContain("min-width: 2.75rem;");
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
});
