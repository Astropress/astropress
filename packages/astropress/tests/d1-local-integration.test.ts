/**
 * D1 local integration tests — exercises the Cloudflare adapter through a real
 * SQLite-backed D1 shim (SqliteBackedD1Database).
 *
 * These tests use a local SQLite-backed D1 shim. Cloudflare D1 uses SQLite under
 * the hood and the shim is functionally equivalent for integration testing purposes.
 * No Cloudflare account or credentials required.
 */

import {
	createAstropressCloudflareAdapter,
	registerCms,
} from "@astropress-diy/astropress";
import { beforeEach, describe, expect, it } from "vitest";
import { STANDARD_CMS_CONFIG, makeDb } from "./helpers/make-db.js";
import {
	SqliteBackedD1Database,
	createSeededCloudflareDatabase,
} from "./helpers/provider-test-fixtures.js";

beforeEach(() => {
	registerCms(STANDARD_CMS_CONFIG);
});

describe("D1 adapter: auth round-trip via SQLite shim", () => {
	it("creates a session, retrieves it, and revokes it", async () => {
		const db = await createSeededCloudflareDatabase();
		const adapter = createAstropressCloudflareAdapter({
			db: new SqliteBackedD1Database(db),
		});

		// Sign in
		const session = await adapter.auth.signIn("admin@example.com", "password");
		expect(session).not.toBeNull();
		expect(session?.email).toBe("admin@example.com");
		expect(session?.role).toBe("admin");

		// Retrieve session
		const retrieved = await adapter.auth.getSession(session?.id);
		expect(retrieved?.email).toBe("admin@example.com");

		// Revoke session
		await adapter.auth.signOut(session?.id);
		const revoked = await adapter.auth.getSession(session?.id);
		expect(revoked).toBeNull();
	});
});

describe("D1 adapter: content CRUD via SQLite shim", () => {
	it("creates a content record, reads it back, updates it, and deletes it", async () => {
		const db = await createSeededCloudflareDatabase();
		const adapter = createAstropressCloudflareAdapter({
			db: new SqliteBackedD1Database(db),
		});

		// Create
		const saved = await adapter.content.save({
			id: "d1-test-slug",
			slug: "d1-test-slug",
			kind: "post",
			title: "D1 Test Post",
			status: "draft",
			body: "<p>Initial body</p>",
			metadata: {
				seoTitle: "D1 Test Post",
				metaDescription: "Testing D1",
				legacyUrl: "/d1-test-slug",
				templateKey: "content",
				updatedAt: new Date().toISOString(),
				summary: "",
			},
		});
		expect(saved.slug).toBe("d1-test-slug");

		// Read back
		const fetched = await adapter.content.get("d1-test-slug");
		expect(fetched?.title).toBe("D1 Test Post");
		expect(fetched?.status).toBe("draft");

		// Update
		const updated = await adapter.content.save({
			...saved,
			title: "D1 Updated Post",
			status: "published",
		});
		expect(updated.title).toBe("D1 Updated Post");
		expect(updated.status).toBe("published");

		// Delete (soft delete — archives the record)
		await adapter.content.delete("d1-test-slug");
		const afterDelete = await adapter.content.get("d1-test-slug");
		// The Cloudflare adapter soft-deletes posts by setting status to "archived"
		expect(afterDelete?.status).toBe("archived");
	});
});

describe("D1 adapter: schema bootstrap via SQLite shim", () => {
	it("bootstraps the schema and confirms schema_migrations table exists", () => {
		const db = makeDb();

		const tableRow = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'",
			)
			.get() as { name: string } | undefined;

		expect(tableRow?.name).toBe("schema_migrations");
	});

	it("D1 shim executes SQL statements via prepare().all()", async () => {
		const db = await createSeededCloudflareDatabase();
		const d1 = new SqliteBackedD1Database(db);

		const result = await d1
			.prepare("SELECT COUNT(*) as count FROM admin_users")
			.first<{ count: number }>();
		expect(result).not.toBeNull();
		expect(result?.count).toBeGreaterThan(0);
	});
});
