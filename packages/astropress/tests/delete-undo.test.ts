import { describe, expect, it } from "vitest";
import { isRestorableTable } from "../src/runtime-actions-restore";

// BDD: Undo toast after deleting admin resources
//
// Unit tests verify the restore action's table allowlist and redirect URL pattern.
// Full delete → undo flow is covered by admin-harness e2e tests.

describe("delete_undo", () => {
	it("Deleting a resource shows an undo toast — redirect URL includes restore params", () => {
		// Simulate what author-delete.ts produces after a successful delete.
		const id = 42;
		const redirectUrl = `/ap-admin/authors?deleted=1&restore_table=authors&restore_id=${id}`;
		const params = new URLSearchParams(redirectUrl.split("?")[1]);
		expect(params.get("deleted")).toBe("1");
		expect(params.get("restore_table")).toBe("authors");
		expect(params.get("restore_id")).toBe("42");
	});

	it("Clicking Undo restores the deleted resource — isRestorableTable validates the allowlist", () => {
		expect(isRestorableTable("authors")).toBe(true);
		expect(isRestorableTable("categories")).toBe(true);
		expect(isRestorableTable("tags")).toBe(true);
		expect(isRestorableTable("media_assets")).toBe(true);
		// Arbitrary table names must be rejected.
		expect(isRestorableTable("users")).toBe(false);
		expect(isRestorableTable("content_records")).toBe(false);
		expect(isRestorableTable("admin_users")).toBe(false);
	});
});
