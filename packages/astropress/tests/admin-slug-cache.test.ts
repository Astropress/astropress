import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/runtime-page-store", () => ({
	getRuntimeSettings: vi.fn(),
}));

import {
	invalidateAstropressAdminSlugCache,
	resolveAstropressAdminSlug,
} from "../src/admin-slug-cache";
import { getRuntimeSettings } from "../src/runtime-page-store";

const mockedGetRuntimeSettings = vi.mocked(getRuntimeSettings);

beforeEach(() => {
	invalidateAstropressAdminSlugCache();
	mockedGetRuntimeSettings.mockReset();
});

afterEach(() => {
	invalidateAstropressAdminSlugCache();
});

const FAKE_LOCALS = {} as never;

describe("resolveAstropressAdminSlug", () => {
	it("returns the configured adminSlug from settings", async () => {
		mockedGetRuntimeSettings.mockResolvedValueOnce({
			adminSlug: "custom-admin",
		} as never);
		expect(await resolveAstropressAdminSlug(FAKE_LOCALS)).toBe("custom-admin");
	});

	it("falls back to ap-admin when adminSlug is empty string", async () => {
		mockedGetRuntimeSettings.mockResolvedValueOnce({ adminSlug: "" } as never);
		expect(await resolveAstropressAdminSlug(FAKE_LOCALS)).toBe("ap-admin");
	});

	it("falls back to ap-admin when adminSlug is undefined", async () => {
		mockedGetRuntimeSettings.mockResolvedValueOnce({} as never);
		expect(await resolveAstropressAdminSlug(FAKE_LOCALS)).toBe("ap-admin");
	});

	it("returns ap-admin when getRuntimeSettings throws", async () => {
		mockedGetRuntimeSettings.mockRejectedValueOnce(new Error("boom"));
		expect(await resolveAstropressAdminSlug(FAKE_LOCALS)).toBe("ap-admin");
	});

	it("caches the resolved slug across calls within TTL", async () => {
		mockedGetRuntimeSettings.mockResolvedValueOnce({
			adminSlug: "first",
		} as never);
		expect(await resolveAstropressAdminSlug(FAKE_LOCALS)).toBe("first");
		// Second call: settings would return "second" but cache should win.
		mockedGetRuntimeSettings.mockResolvedValueOnce({
			adminSlug: "second",
		} as never);
		expect(await resolveAstropressAdminSlug(FAKE_LOCALS)).toBe("first");
		expect(mockedGetRuntimeSettings).toHaveBeenCalledOnce();
	});

	it("re-fetches after the cache TTL elapses", async () => {
		vi.useFakeTimers();
		try {
			mockedGetRuntimeSettings.mockResolvedValueOnce({
				adminSlug: "first",
			} as never);
			expect(await resolveAstropressAdminSlug(FAKE_LOCALS)).toBe("first");

			// Advance just past the 60s TTL.
			vi.advanceTimersByTime(60_001);

			mockedGetRuntimeSettings.mockResolvedValueOnce({
				adminSlug: "second",
			} as never);
			expect(await resolveAstropressAdminSlug(FAKE_LOCALS)).toBe("second");
			expect(mockedGetRuntimeSettings).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	// Boundary: at EXACTLY TTL_MS the cache expires (strict <, not <=).
	// Pins the EqualityOperator mutation: now - cachedAt < TTL → <= TTL.
	// With the mutation, at exactly TTL the cache would still be served.
	it("re-fetches at exactly the TTL boundary (strict-less-than semantics)", async () => {
		vi.useFakeTimers();
		try {
			// Cache "first" at t=0.
			mockedGetRuntimeSettings.mockResolvedValueOnce({
				adminSlug: "first",
			} as never);
			expect(await resolveAstropressAdminSlug(FAKE_LOCALS)).toBe("first");
			// Within TTL: cache wins, no extra fetch.
			vi.advanceTimersByTime(59_999);
			expect(await resolveAstropressAdminSlug(FAKE_LOCALS)).toBe("first");
			expect(mockedGetRuntimeSettings).toHaveBeenCalledOnce();

			// Advance to exactly TTL: with strict-less-than, the cache is
			// stale and we re-fetch. With the < → <= mutation, the cache
			// would still be served and "second" would never be reached.
			vi.advanceTimersByTime(1);
			mockedGetRuntimeSettings.mockResolvedValueOnce({
				adminSlug: "second",
			} as never);
			expect(await resolveAstropressAdminSlug(FAKE_LOCALS)).toBe("second");
			expect(mockedGetRuntimeSettings).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it("invalidate forces the next call to refetch", async () => {
		mockedGetRuntimeSettings.mockResolvedValueOnce({
			adminSlug: "first",
		} as never);
		await resolveAstropressAdminSlug(FAKE_LOCALS);
		invalidateAstropressAdminSlugCache();
		mockedGetRuntimeSettings.mockResolvedValueOnce({
			adminSlug: "second",
		} as never);
		expect(await resolveAstropressAdminSlug(FAKE_LOCALS)).toBe("second");
		expect(mockedGetRuntimeSettings).toHaveBeenCalledTimes(2);
	});
});
