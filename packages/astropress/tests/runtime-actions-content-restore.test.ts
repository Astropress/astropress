import { describe, expect, it, vi } from "vitest";
import { STANDARD_ACTOR } from "./helpers/make-db.js";

vi.mock("../src/local-runtime-modules", () => ({
	loadLocalAdminStore: vi.fn(),
}));

describe("restoreRuntimeRevision local-store fallback path", () => {
	it("dispatches to localStore.restoreRevision when no D1 binding is available on locals", async () => {
		const restoreRevision = vi.fn(async () => ({ ok: true as const }));
		const { loadLocalAdminStore } = await import("../src/local-runtime-modules");
		(loadLocalAdminStore as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ restoreRevision });

		const { restoreRuntimeRevision } = await import("../src/runtime-actions-content");

		const result = await restoreRuntimeRevision("hello-world", "rev-1", STANDARD_ACTOR, null);
		expect(restoreRevision).toHaveBeenCalledTimes(1);
		expect(restoreRevision).toHaveBeenCalledWith("hello-world", "rev-1", STANDARD_ACTOR);
		expect(result).toEqual({ ok: true });
	});
});
