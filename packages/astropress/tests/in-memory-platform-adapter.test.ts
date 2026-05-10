import { describe, expect, it } from "vitest";
import { createAstropressInMemoryPlatformAdapter } from "../src/in-memory-platform-adapter";
import type {
	ContentStoreRecord,
	MediaAssetRecord,
	RevisionRecord,
} from "../src/platform-contracts";

const minimalCapabilities = { name: "in-memory-test" };

function makeAdapter() {
	return createAstropressInMemoryPlatformAdapter({
		capabilities: minimalCapabilities,
	});
}

describe("createAstropressInMemoryPlatformAdapter — content store", () => {
	it("save / get / list / delete round-trip a content record", async () => {
		const adapter = makeAdapter();
		const record: ContentStoreRecord = {
			id: "post-1",
			kind: "post",
			title: "T",
			body: "B",
			updatedAt: "2026-01-01",
		};
		expect(await adapter.content.list()).toEqual([]);
		expect(await adapter.content.save(record)).toEqual(record);
		expect(await adapter.content.get("post-1")).toEqual(record);
		expect(await adapter.content.list()).toEqual([record]);
		await adapter.content.delete("post-1");
		expect(await adapter.content.get("post-1")).toBeNull();
		expect(await adapter.content.list()).toEqual([]);
	});

	it("list filters by kind when supplied", async () => {
		const adapter = makeAdapter();
		await adapter.content.save({
			id: "p1",
			kind: "post",
			title: "P",
			body: "",
			updatedAt: "2026-01-01",
		});
		await adapter.content.save({
			id: "g1",
			kind: "page",
			title: "G",
			body: "",
			updatedAt: "2026-01-01",
		});
		expect((await adapter.content.list("post")).map((r) => r.id)).toEqual(["p1"]);
		expect((await adapter.content.list("page")).map((r) => r.id)).toEqual(["g1"]);
	});
});

describe("createAstropressInMemoryPlatformAdapter — media store", () => {
	it("put / get / delete round-trip a media asset", async () => {
		const adapter = makeAdapter();
		const asset: MediaAssetRecord = {
			id: "m1",
			url: "/m1.png",
			mimeType: "image/png",
		};
		expect(await adapter.media.put(asset)).toEqual(asset);
		expect(await adapter.media.get("m1")).toEqual(asset);
		await adapter.media.delete("m1");
		expect(await adapter.media.get("m1")).toBeNull();
	});
});

describe("createAstropressInMemoryPlatformAdapter — revision store", () => {
	it("list returns [] for an unknown record id and append accumulates per recordId", async () => {
		const adapter = makeAdapter();
		expect(await adapter.revisions.list("missing")).toEqual([]);

		const r1: RevisionRecord = {
			id: "rev-1",
			recordId: "post-1",
			savedAt: "2026-01-01",
			payload: { title: "v1" },
		};
		const r2: RevisionRecord = {
			id: "rev-2",
			recordId: "post-1",
			savedAt: "2026-01-02",
			payload: { title: "v2" },
		};
		await adapter.revisions.append(r1);
		await adapter.revisions.append(r2);
		const listed = await adapter.revisions.list("post-1");
		expect(listed.map((r) => r.id)).toEqual(["rev-1", "rev-2"]);
		expect(await adapter.revisions.list("other-id")).toEqual([]);
	});
});

describe("createAstropressInMemoryPlatformAdapter — auth store (default seed user)", () => {
	it("signs in the default seeded admin with id='admin-1', email='admin@example.com', isAdmin=true, password='password'", async () => {
		const adapter = makeAdapter();
		const user = await adapter.auth.signIn("admin@example.com", "password");
		expect(user).toEqual({ id: "admin-1", email: "admin@example.com", isAdmin: true });
	});

	it("returns null for unknown email and for wrong password", async () => {
		const adapter = makeAdapter();
		expect(await adapter.auth.signIn("nobody@example.com", "password")).toBeNull();
		expect(await adapter.auth.signIn("admin@example.com", "wrong")).toBeNull();
	});

	it("normalises email casing/whitespace on lookup so 'ADMIN@EXAMPLE.COM' and '  admin@example.com  ' both authenticate", async () => {
		const adapter = makeAdapter();
		const upper = await adapter.auth.signIn("ADMIN@EXAMPLE.COM", "password");
		expect(upper?.email).toBe("admin@example.com");
		const padded = await adapter.auth.signIn("  admin@example.com  ", "password");
		expect(padded?.email).toBe("admin@example.com");
	});

	it("getSession resolves a session created by signIn under the documented session:<id> key, and signOut clears it", async () => {
		const adapter = makeAdapter();
		const user = await adapter.auth.signIn("admin@example.com", "password");
		expect(user).not.toBeNull();
		expect(await adapter.auth.getSession(`session:${user?.id}`)).toEqual(user);
		await adapter.auth.signOut(`session:${user?.id}`);
		expect(await adapter.auth.getSession(`session:${user?.id}`)).toBeNull();
	});
});

describe("createAstropressInMemoryPlatformAdapter — explicit users override the default", () => {
	it("authenticates a custom seed user and rejects the default admin when users[] is supplied", async () => {
		const adapter = createAstropressInMemoryPlatformAdapter({
			capabilities: minimalCapabilities,
			users: [
				{
					id: "editor-9",
					email: "editor@example.com",
					isAdmin: false,
					password: "secret",
				},
			],
		});
		const user = await adapter.auth.signIn("editor@example.com", "secret");
		expect(user).toEqual({ id: "editor-9", email: "editor@example.com", isAdmin: false });
		// Default admin must NOT exist under this configuration.
		expect(await adapter.auth.signIn("admin@example.com", "password")).toBeNull();
	});
});
