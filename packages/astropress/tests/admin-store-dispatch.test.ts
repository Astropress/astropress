import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeDb } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let withLocalStoreFallback: typeof import("../src/admin-store-dispatch.js").withLocalStoreFallback;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let withSafeLocalStoreFallback: typeof import("../src/admin-store-dispatch.js").withSafeLocalStoreFallback;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let getAdminDb: typeof import("../src/admin-store-dispatch.js").getAdminDb;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let safeLoadLocalAdminStore: typeof import("../src/admin-store-dispatch.js").safeLoadLocalAdminStore;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let resolveApiRuntime: typeof import("../src/admin-store-dispatch.js").resolveApiRuntime;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let resolveFlashStore: typeof import("../src/admin-store-dispatch.js").resolveFlashStore;

const { mockLoadLocalAdminStore } = vi.hoisted(() => ({
	mockLoadLocalAdminStore: vi.fn(),
}));

vi.mock("../src/local-runtime-modules", () => ({
	loadLocalAdminStore: mockLoadLocalAdminStore,
}));

vi.mock("../src/local-runtime-modules.js", () => ({
	loadLocalAdminStore: mockLoadLocalAdminStore,
}));

beforeEach(async () => {
	vi.resetModules();
	({
		withLocalStoreFallback,
		withSafeLocalStoreFallback,
		getAdminDb,
		safeLoadLocalAdminStore,
		resolveApiRuntime,
		resolveFlashStore,
	} = await import("../src/admin-store-dispatch.js"));
	mockLoadLocalAdminStore.mockReset();
});

afterAll(() => {
	vi.resetModules();
});

describe("withLocalStoreFallback", () => {
	it("calls onD1 when a D1 database binding is present in locals", async () => {
		const db = makeDb();
		const locals = makeLocals(db);
		const onD1 = vi.fn().mockResolvedValue("d1-result");
		const onLocal = vi.fn();

		const result = await withLocalStoreFallback(locals, onD1, onLocal);

		expect(result).toBe("d1-result");
		expect(onD1).toHaveBeenCalledOnce();
		expect(onLocal).not.toHaveBeenCalled();
	});

	it("calls onLocal with the loaded store when no D1 binding is present", async () => {
		const mockStore = { listContent: vi.fn() };
		mockLoadLocalAdminStore.mockResolvedValue(mockStore);
		const onD1 = vi.fn();
		const onLocal = vi.fn().mockResolvedValue("local-result");

		const result = await withLocalStoreFallback(null, onD1, onLocal);

		expect(result).toBe("local-result");
		expect(onLocal).toHaveBeenCalledWith(mockStore);
		expect(onD1).not.toHaveBeenCalled();
	});
});

describe("withSafeLocalStoreFallback", () => {
	it("calls onD1 when a D1 database binding is present in locals", async () => {
		const db = makeDb();
		const locals = makeLocals(db);
		const onD1 = vi.fn().mockResolvedValue("d1-safe-result");
		const onLocal = vi.fn();

		const result = await withSafeLocalStoreFallback(locals, onD1, onLocal);

		expect(result).toBe("d1-safe-result");
		expect(onD1).toHaveBeenCalledOnce();
		expect(onLocal).not.toHaveBeenCalled();
	});

	it("calls onLocal with the loaded store when no D1 binding is present", async () => {
		const mockStore = { listContent: vi.fn() };
		mockLoadLocalAdminStore.mockResolvedValue(mockStore);
		const onD1 = vi.fn();
		const onLocal = vi.fn().mockResolvedValue("local-safe-result");

		const result = await withSafeLocalStoreFallback(null, onD1, onLocal);

		expect(result).toBe("local-safe-result");
		expect(onLocal).toHaveBeenCalledWith(mockStore);
		expect(onD1).not.toHaveBeenCalled();
	});

	it("calls onLocal with null when loadLocalAdminStore throws (catch path)", async () => {
		mockLoadLocalAdminStore.mockRejectedValueOnce(new Error("module missing"));
		const onD1 = vi.fn();
		const onLocal = vi.fn().mockResolvedValue("static-fallback");

		const result = await withSafeLocalStoreFallback(null, onD1, onLocal);

		expect(result).toBe("static-fallback");
		expect(onLocal).toHaveBeenCalledWith(null);
		expect(onD1).not.toHaveBeenCalled();
	});
});

describe("safeLoadLocalAdminStore", () => {
	it("returns the loaded module on success", async () => {
		const mockStore = { listContent: vi.fn() };
		mockLoadLocalAdminStore.mockResolvedValueOnce(mockStore);
		expect(await safeLoadLocalAdminStore()).toBe(mockStore);
	});

	it("returns null when the loader throws (catch path)", async () => {
		mockLoadLocalAdminStore.mockRejectedValueOnce(new Error("missing"));
		expect(await safeLoadLocalAdminStore()).toBeNull();
	});
});

describe("getAdminDb", () => {
	it("returns the D1 binding when present in locals.runtime.env.DB", () => {
		const db = makeDb();
		const locals = makeLocals(db);
		const result = getAdminDb(locals);
		expect(result).toBeDefined();
		// Same identity as the binding the helper installed.
		expect(result).toBe(locals.runtime?.env?.DB);
	});

	it("returns undefined when locals is null", () => {
		expect(getAdminDb(null)).toBeUndefined();
	});

	it("returns undefined when locals is undefined (no arg)", () => {
		expect(getAdminDb()).toBeUndefined();
	});

	it("returns undefined when locals.runtime.env has no DB binding", () => {
		const noDbLocals = {
			runtime: { env: {} },
		} as unknown as App.Locals;
		expect(getAdminDb(noDbLocals)).toBeUndefined();
	});
});

describe("resolveApiRuntime", () => {
	it("returns D1-backed stores and an async rate limiter when a DB binding is present", async () => {
		const db = makeDb();
		const locals = makeLocals(db);

		const runtime = await resolveApiRuntime(locals);
		expect(runtime.webhooks).toBeDefined();
		expect(mockLoadLocalAdminStore).not.toHaveBeenCalled();
		const apiTokens = runtime.apiTokens;
		if (!apiTokens) throw new Error("expected D1 apiTokens store");

		// The D1 token store round-trips against the same binding.
		const { rawToken } = await apiTokens.create({
			label: "t",
			scopes: ["content:read"],
		});
		const verified = await apiTokens.verify(rawToken);
		expect(verified.valid).toBe(true);

		// D1 rate limiter is promise-returning; withApiRequest awaits it.
		await expect(Promise.resolve(runtime.checkRateLimit("api:test", 60, 60_000))).resolves.toBe(
			true,
		);
	});

	it("falls back to the local store's apiTokens/webhooks/checkRateLimit with no DB binding", async () => {
		const localApiTokens = { verify: vi.fn() };
		const localWebhooks = { list: vi.fn() };
		const localCheckRateLimit = vi.fn().mockReturnValue(true);
		mockLoadLocalAdminStore.mockResolvedValue({
			apiTokens: localApiTokens,
			webhooks: localWebhooks,
			checkRateLimit: localCheckRateLimit,
		});

		const runtime = await resolveApiRuntime(null);
		expect(runtime.apiTokens).toBe(localApiTokens);
		expect(runtime.webhooks).toBe(localWebhooks);
		expect(runtime.checkRateLimit).toBe(localCheckRateLimit);
		expect(mockLoadLocalAdminStore).toHaveBeenCalledOnce();
	});
});

describe("resolveFlashStore", () => {
	it("returns a working D1-backed flash store when a DB binding is present", async () => {
		const db = makeDb();
		const locals = makeLocals(db);
		const flash = await resolveFlashStore(locals);
		expect(flash).toBeDefined();
		if (!flash) throw new Error("expected D1 flash store");

		const { id } = await flash.put("d1-roundtrip");
		expect(await flash.consume(id)).toBe("d1-roundtrip");
		expect(await flash.consume(id)).toBeNull();
	});

	it("falls back to the local store's flash surface with no DB binding", async () => {
		const localFlash = { put: vi.fn(), consume: vi.fn() };
		mockLoadLocalAdminStore.mockResolvedValue({ flash: localFlash });

		const flash = await resolveFlashStore(null);
		expect(flash).toBe(localFlash);
		expect(mockLoadLocalAdminStore).toHaveBeenCalledOnce();
	});
});
