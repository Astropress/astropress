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

	// Issue #134: the subscriber-delete action runs through withAdminFormAction,
	// which rejects requests without a CSRF token. The confirm-dialog form on the
	// detail page is the only call site that can submit it, so verify the modal's
	// <form> itself carries a CsrfInput — not just that the sweeping audit passes.
	it("subscriber detail delete modal form includes a CSRF token (issue #134)", () => {
		const src = readFileSync(path.join(adminPagesRoot, "subscribers", "[id].astro"), "utf8");
		// Isolate the <form> that posts to subscriber-delete so the assertion can't
		// be satisfied by an unrelated CsrfInput elsewhere on the page.
		const formMatch = src.match(
			/<form\b[^>]*action=["']\/ap-admin\/actions\/subscriber-delete["'][^>]*>([\s\S]*?)<\/form>/,
		);
		expect(
			formMatch,
			"expected a <form> posting to /ap-admin/actions/subscriber-delete",
		).not.toBeNull();
		const formBody = formMatch?.[1] ?? "";
		expect(formBody).toMatch(/<CsrfInput\b[^/]*token=\{Astro\.locals\.csrfToken\}/);
		expect(formBody).toContain('name="id"');
	});
});
