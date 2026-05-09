import { describe, expect, it } from "vitest";
import { createAstropressHostedPlatformAdapter } from "../src/hosted-platform-adapter.js";
import type { AuthStore, ContentStore, MediaStore, RevisionStore } from "../src/platform-contracts";

describe("hosted platform adapter", () => {
	it("assembles a hosted provider from explicit store modules", async () => {
		const records = new Map<string, string>();
		const content: ContentStore = {
			async list() {
				return [...records.entries()].map(([id, title]) => ({
					id,
					kind: "post" as const,
					slug: id,
					status: "published" as const,
					title,
				}));
			},
			async get(id) {
				const title = records.get(id);
				return title
					? {
							id,
							kind: "post",
							slug: id,
							status: "published",
							title,
						}
					: null;
			},
			async save(record) {
				records.set(record.id, String(record.title ?? record.id));
				return record;
			},
			async delete(id) {
				records.delete(id);
			},
		};

		const media: MediaStore = {
			async put(asset) {
				return asset;
			},
			async get() {
				return null;
			},
			async delete() {},
		};

		const revisions: RevisionStore = {
			async list() {
				return [];
			},
			async append(revision) {
				return revision;
			},
		};

		const auth: AuthStore = {
			async signIn(email) {
				return { id: "supabase-session-1", email, role: "admin" };
			},
			async signOut() {},
			async getSession(sessionId) {
				return { id: sessionId, email: "admin@example.com", role: "admin" };
			},
		};

		const adapter = createAstropressHostedPlatformAdapter({
			providerName: "supabase",
			content,
			media,
			revisions,
			auth,
			defaultCapabilities: {
				staticPublishing: false,
			},
		});

		expect(adapter.capabilities.name).toBe("supabase");
		expect(adapter.capabilities.hostedAdmin).toBe(true);

		await adapter.content.save({
			id: "remote-post",
			kind: "post",
			slug: "remote-post",
			status: "published",
			title: "Remote post",
		});

		expect(await adapter.content.get("remote-post")).toMatchObject({
			slug: "remote-post",
			title: "Remote post",
		});
		expect(await adapter.auth.signIn("admin@example.com", "password")).toMatchObject({
			email: "admin@example.com",
			role: "admin",
		});
	});

	it("defaults capabilities (hostedAdmin/serverRuntime/etc) to true when no overrides", () => {
		const adapter = createAstropressHostedPlatformAdapter({
			providerName: "supabase",
		});
		expect(adapter.capabilities.name).toBe("supabase");
		expect(adapter.capabilities.hostedAdmin).toBe(true);
		expect(adapter.capabilities.previewEnvironments).toBe(true);
		expect(adapter.capabilities.serverRuntime).toBe(true);
		expect(adapter.capabilities.database).toBe(true);
		expect(adapter.capabilities.objectStorage).toBe(true);
		expect(adapter.capabilities.gitSync).toBe(true);
	});

	it("defaultCapabilities overrides shadow the built-in defaults", () => {
		const adapter = createAstropressHostedPlatformAdapter({
			providerName: "supabase",
			defaultCapabilities: {
				database: false,
				objectStorage: false,
			},
		});
		expect(adapter.capabilities.database).toBe(false);
		expect(adapter.capabilities.objectStorage).toBe(false);
		// Non-overridden fields keep the built-in defaults.
		expect(adapter.capabilities.hostedAdmin).toBe(true);
	});

	it("uses backingAdapter when provided (skips in-memory factory)", async () => {
		// Marker fields on the backingAdapter must surface in the result.
		const backingAdapter = {
			capabilities: {
				name: "marker-provider",
				database: true,
				hostedAdmin: false,
			},
			content: {
				async list() {
					return ["from-backing"] as never;
				},
				async get() {
					return null;
				},
				async save(r: never) {
					return r;
				},
				async delete() {},
			},
			media: {
				async put(a: never) {
					return a;
				},
				async get() {
					return null;
				},
				async delete() {},
			},
			revisions: {
				async list() {
					return [];
				},
				async append(r: never) {
					return r;
				},
			},
			auth: {
				async signIn() {
					return { id: "backing-session", email: "x", role: "admin" } as never;
				},
				async signOut() {},
				async getSession() {
					return null;
				},
			},
		} as never;
		const adapter = createAstropressHostedPlatformAdapter({
			providerName: "supabase",
			backingAdapter,
		});
		// content list must come from backing, not from an in-memory store.
		expect(await adapter.content.list()).toEqual(["from-backing"]);
		// signIn comes from backing too.
		const session = await adapter.auth.signIn("x", "p");
		expect(session).toMatchObject({ id: "backing-session" });
	});

	it("merges backing capabilities under the hosted defaults (hosted defaults win)", () => {
		const backingAdapter = {
			capabilities: {
				name: "ignored-by-merge",
				hostedAdmin: false,
				database: false,
			},
			content: {
				async list() {
					return [];
				},
				async get() {
					return null;
				},
				async save(r: never) {
					return r;
				},
				async delete() {},
			},
			media: {
				async put(a: never) {
					return a;
				},
				async get() {
					return null;
				},
				async delete() {},
			},
			revisions: {
				async list() {
					return [];
				},
				async append(r: never) {
					return r;
				},
			},
			auth: {
				async signIn() {
					return null;
				},
				async signOut() {},
				async getSession() {
					return null;
				},
			},
		} as never;
		const adapter = createAstropressHostedPlatformAdapter({
			providerName: "supabase",
			backingAdapter,
		});
		// providerName from options wins over the backing's name.
		expect(adapter.capabilities.name).toBe("supabase");
		// hosted defaults override backing's `false`.
		expect(adapter.capabilities.hostedAdmin).toBe(true);
		expect(adapter.capabilities.database).toBe(true);
	});
});
