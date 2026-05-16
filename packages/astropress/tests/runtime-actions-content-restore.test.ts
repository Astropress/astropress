import { describe, expect, it, vi } from "vitest";
import { STANDARD_ACTOR } from "./helpers/make-db.js";

vi.mock("../src/local-runtime-modules", () => ({
	loadLocalAdminStore: vi.fn(),
}));

describe("runtime-actions-content local-store fallback paths", () => {
	it("restoreRuntimeRevision dispatches to localStore.restoreRevision when no D1 binding is available on locals", async () => {
		const restoreRevision = vi.fn(async () => ({ ok: true as const }));
		const { loadLocalAdminStore } = await import("../src/local-runtime-modules");
		(loadLocalAdminStore as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ restoreRevision });

		const { restoreRuntimeRevision } = await import("../src/runtime-actions-content");

		const result = await restoreRuntimeRevision("hello-world", "rev-1", STANDARD_ACTOR, null);
		expect(restoreRevision).toHaveBeenCalledTimes(1);
		expect(restoreRevision).toHaveBeenCalledWith("hello-world", "rev-1", STANDARD_ACTOR);
		expect(result).toEqual({ ok: true });
	});

	it("saveRuntimeContentState dispatches to localStore.saveContentState when no D1 binding is available", async () => {
		const saveContentState = vi.fn(async () => ({ ok: true as const, state: {} }));
		const { loadLocalAdminStore } = await import("../src/local-runtime-modules");
		(loadLocalAdminStore as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ saveContentState });

		const { saveRuntimeContentState } = await import("../src/runtime-actions-content");
		const saveInput = {
			title: "T",
			status: "draft" as const,
			seoTitle: "S",
			metaDescription: "M",
		};
		const result = await saveRuntimeContentState("slug-x", saveInput, STANDARD_ACTOR, null);
		expect(saveContentState).toHaveBeenCalledTimes(1);
		expect(saveContentState).toHaveBeenCalledWith("slug-x", saveInput, STANDARD_ACTOR);
		expect(result.ok).toBe(true);
	});

	it("createRuntimeContentRecord dispatches to localStore.createContentRecord when no D1 binding is available", async () => {
		const createContentRecord = vi.fn(async () => ({ ok: true as const, state: {} }));
		const { loadLocalAdminStore } = await import("../src/local-runtime-modules");
		(loadLocalAdminStore as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			createContentRecord,
		});

		const { createRuntimeContentRecord } = await import("../src/runtime-actions-content");
		const createInput = {
			title: "New",
			slug: "new-slug",
			status: "draft",
			seoTitle: "S",
			metaDescription: "M",
		};
		const result = await createRuntimeContentRecord(createInput, STANDARD_ACTOR, null);
		expect(createContentRecord).toHaveBeenCalledTimes(1);
		expect(createContentRecord).toHaveBeenCalledWith(createInput, STANDARD_ACTOR);
		expect(result.ok).toBe(true);
	});
});
