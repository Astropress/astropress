import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { STANDARD_ACTOR } from "./helpers/make-db.js";

const { mockLoadLocalAdminStore, fakeStore } = vi.hoisted(() => {
	const fake = {
		createAuthor: vi.fn(),
		updateAuthor: vi.fn(),
		deleteAuthor: vi.fn(),
		createCategory: vi.fn(),
		updateCategory: vi.fn(),
		deleteCategory: vi.fn(),
		createTag: vi.fn(),
		updateTag: vi.fn(),
		deleteTag: vi.fn(),
	};
	return {
		fakeStore: fake,
		mockLoadLocalAdminStore: vi.fn(),
	};
});

vi.mock("../src/local-runtime-modules", () => ({
	loadLocalAdminStore: mockLoadLocalAdminStore,
}));

vi.mock("../src/local-runtime-modules.js", () => ({
	loadLocalAdminStore: mockLoadLocalAdminStore,
}));

let mod: typeof import("../src/runtime-actions-taxonomies.js");

beforeEach(async () => {
	vi.resetModules();
	mod = await import("../src/runtime-actions-taxonomies.js");
	for (const fn of Object.values(fakeStore)) fn.mockReset();
	mockLoadLocalAdminStore.mockReset();
	mockLoadLocalAdminStore.mockResolvedValue(fakeStore);
});

afterAll(() => {
	vi.resetModules();
});

const actor = STANDARD_ACTOR;

describe("runtime-actions-taxonomies — local-store fallback path", () => {
	it("createRuntimeAuthor delegates to localStore.createAuthor", async () => {
		fakeStore.createAuthor.mockResolvedValue({ ok: true, id: 1 });
		const input = { name: "Local Author" };
		const result = await mod.createRuntimeAuthor(input, actor, null);
		expect(fakeStore.createAuthor).toHaveBeenCalledWith(input, actor);
		expect(result).toEqual({ ok: true, id: 1 });
	});

	it("updateRuntimeAuthor delegates to localStore.updateAuthor", async () => {
		fakeStore.updateAuthor.mockResolvedValue({ ok: true });
		const input = { id: 7, name: "Updated" };
		const result = await mod.updateRuntimeAuthor(input, actor, null);
		expect(fakeStore.updateAuthor).toHaveBeenCalledWith(input, actor);
		expect(result).toEqual({ ok: true });
	});

	it("deleteRuntimeAuthor delegates to localStore.deleteAuthor", async () => {
		fakeStore.deleteAuthor.mockResolvedValue({ ok: true });
		const result = await mod.deleteRuntimeAuthor(42, actor, null);
		expect(fakeStore.deleteAuthor).toHaveBeenCalledWith(42, actor);
		expect(result).toEqual({ ok: true });
	});

	it("createRuntimeCategory delegates to localStore.createCategory", async () => {
		fakeStore.createCategory.mockResolvedValue({ ok: true });
		const input = { name: "Local Cat" };
		const result = await mod.createRuntimeCategory(input, actor, null);
		expect(fakeStore.createCategory).toHaveBeenCalledWith(input, actor);
		expect(result).toEqual({ ok: true });
	});

	it("updateRuntimeCategory delegates to localStore.updateCategory", async () => {
		fakeStore.updateCategory.mockResolvedValue({ ok: true });
		const input = { id: 3, name: "Updated Cat" };
		const result = await mod.updateRuntimeCategory(input, actor, null);
		expect(fakeStore.updateCategory).toHaveBeenCalledWith(input, actor);
		expect(result).toEqual({ ok: true });
	});

	it("deleteRuntimeCategory delegates to localStore.deleteCategory", async () => {
		fakeStore.deleteCategory.mockResolvedValue({ ok: true });
		const result = await mod.deleteRuntimeCategory(9, actor, null);
		expect(fakeStore.deleteCategory).toHaveBeenCalledWith(9, actor);
		expect(result).toEqual({ ok: true });
	});

	it("createRuntimeTag delegates to localStore.createTag", async () => {
		fakeStore.createTag.mockResolvedValue({ ok: true });
		const input = { name: "Local Tag" };
		const result = await mod.createRuntimeTag(input, actor, null);
		expect(fakeStore.createTag).toHaveBeenCalledWith(input, actor);
		expect(result).toEqual({ ok: true });
	});

	it("updateRuntimeTag delegates to localStore.updateTag", async () => {
		fakeStore.updateTag.mockResolvedValue({ ok: true });
		const input = { id: 5, name: "Updated Tag" };
		const result = await mod.updateRuntimeTag(input, actor, null);
		expect(fakeStore.updateTag).toHaveBeenCalledWith(input, actor);
		expect(result).toEqual({ ok: true });
	});

	it("deleteRuntimeTag delegates to localStore.deleteTag", async () => {
		fakeStore.deleteTag.mockResolvedValue({ ok: true });
		const result = await mod.deleteRuntimeTag(11, actor, null);
		expect(fakeStore.deleteTag).toHaveBeenCalledWith(11, actor);
		expect(result).toEqual({ ok: true });
	});
});
