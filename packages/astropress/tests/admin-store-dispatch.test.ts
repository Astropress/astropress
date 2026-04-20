import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeDb } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let withLocalStoreFallback: typeof import("../src/admin-store-dispatch.js").withLocalStoreFallback;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let withSafeLocalStoreFallback: typeof import("../src/admin-store-dispatch.js").withSafeLocalStoreFallback;

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
	({ withLocalStoreFallback, withSafeLocalStoreFallback } = await import(
		"../src/admin-store-dispatch.js"
	));
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
});
