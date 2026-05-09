import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const adminPagesRoot = path.resolve(import.meta.dirname, "../pages/ap-admin");

// Destructive actions must use the styled <ap-confirm-dialog> web component
// rather than the native window.confirm() — keeps the dialog accessible,
// keyboard-trappable, and visually consistent with the admin shell.

describe("destructive actions use confirm dialogs", () => {
	it("authors page uses ap-confirm-dialog for deletion", () => {
		const src = readFileSync(path.join(adminPagesRoot, "authors.astro"), "utf8");
		expect(src).toContain("ap-confirm-dialog");
		expect(src).toContain("data-confirm-trigger");
		expect(src).toContain('id="confirm-delete-author"');
	});

	it("taxonomies page uses ap-confirm-dialog for category and tag deletion", () => {
		const src = readFileSync(path.join(adminPagesRoot, "taxonomies.astro"), "utf8");
		expect(src).toContain("ap-confirm-dialog");
		expect(src).toContain("data-confirm-trigger");
		expect(src).toContain('id="confirm-delete-category"');
		expect(src).toContain('id="confirm-delete-tag"');
	});

	it("media page uses ap-confirm-dialog for deletion", () => {
		const src = readFileSync(path.join(adminPagesRoot, "media.astro"), "utf8");
		expect(src).toContain("ap-confirm-dialog");
		expect(src).toContain("data-confirm-trigger");
		expect(src).toContain('id="confirm-delete-media"');
	});

	it("webhooks page uses ap-confirm-dialog for deletion", () => {
		const src = readFileSync(path.join(adminPagesRoot, "webhooks.astro"), "utf8");
		expect(src).toContain("ap-confirm-dialog");
		expect(src).toContain("data-confirm-trigger");
		expect(src).toContain('id="confirm-delete-webhook"');
	});

	it("api-tokens page uses ap-confirm-dialog for revocation", () => {
		const src = readFileSync(path.join(adminPagesRoot, "api-tokens.astro"), "utf8");
		expect(src).toContain("ap-confirm-dialog");
		expect(src).toContain("data-confirm-trigger");
		expect(src).toContain('id="confirm-revoke-token"');
	});

	it("users page uses styled dialog instead of window.confirm()", () => {
		const src = readFileSync(path.join(adminPagesRoot, "users.astro"), "utf8");
		expect(src).not.toContain("window.confirm");
		expect(src).not.toMatch(/data-confirm="/);
		expect(src).toContain("ap-confirm-dialog");
		expect(src).toContain('id="confirm-suspend-user"');
		expect(src).toContain('id="confirm-purge-user"');
	});

	it("subscriber detail uses styled dialog instead of window.confirm()", () => {
		const src = readFileSync(path.join(adminPagesRoot, "subscribers", "[id].astro"), "utf8");
		expect(src).not.toContain("window.confirm");
		expect(src).not.toMatch(/data-confirm="/);
		expect(src).toContain("ap-confirm-dialog");
		expect(src).toContain('id="confirm-delete-subscriber"');
	});
});
