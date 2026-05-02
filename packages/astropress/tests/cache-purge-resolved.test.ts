import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { purgeCdnCacheForResolved } from "../src/cache-purge";
import type { ResolvedCdnPurge } from "../src/integrations/resolvers/cdn-purge-resolver";

interface CapturedCall {
	url: string;
	method: string | undefined;
	authorization: string | null;
	contentType: string | null;
	body: string | null;
}

function makeFetchMock(status = 200): {
	fetch: typeof fetch;
	calls: CapturedCall[];
} {
	const calls: CapturedCall[] = [];
	const f: typeof fetch = async (input, init) => {
		const url = typeof input === "string" ? input : input.toString();
		const headers =
			init?.headers instanceof Headers
				? init.headers
				: new Headers((init?.headers as Record<string, string>) ?? {});
		calls.push({
			url,
			method: init?.method,
			authorization: headers.get("authorization"),
			contentType: headers.get("content-type"),
			body: typeof init?.body === "string" ? init.body : null,
		});
		return new Response(null, { status });
	};
	return { fetch: f, calls };
}

describe("purgeCdnCacheForResolved — kind: 'none'", () => {
	it("resolves silently and issues no fetch", async () => {
		const { fetch, calls } = makeFetchMock();
		await expect(
			purgeCdnCacheForResolved("slug", { kind: "none" }, { fetch }),
		).resolves.toBeUndefined();
		expect(calls).toHaveLength(0);
	});
});

describe("purgeCdnCacheForResolved — kind: 'cloudflare'", () => {
	const RESOLVED: ResolvedCdnPurge = {
		kind: "cloudflare",
		apiToken: "cf-token",
		zoneId: "zone-12345",
		source: "registry",
	};

	it("hits the zone purge_cache endpoint with POST", async () => {
		const { fetch, calls } = makeFetchMock();
		await purgeCdnCacheForResolved("slug", RESOLVED, { fetch });
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(
			"https://api.cloudflare.com/client/v4/zones/zone-12345/purge_cache",
		);
		expect(calls[0].method).toBe("POST");
	});

	it("URL-encodes a zoneId with reserved characters", async () => {
		const { fetch, calls } = makeFetchMock();
		await purgeCdnCacheForResolved(
			"slug",
			{ ...RESOLVED, zoneId: "zone/with:reserved" },
			{ fetch },
		);
		expect(calls[0].url).toBe(
			"https://api.cloudflare.com/client/v4/zones/zone%2Fwith%3Areserved/purge_cache",
		);
	});

	it("attaches Bearer auth from the resolved apiToken", async () => {
		const { fetch, calls } = makeFetchMock();
		await purgeCdnCacheForResolved("slug", RESOLVED, { fetch });
		expect(calls[0].authorization).toBe("Bearer cf-token");
	});

	it("sets Content-Type: application/json", async () => {
		const { fetch, calls } = makeFetchMock();
		await purgeCdnCacheForResolved("slug", RESOLVED, { fetch });
		expect(calls[0].contentType).toBe("application/json");
	});

	it("sends a body with the slug as a tag (so partial-purge-by-tag works)", async () => {
		const { fetch, calls } = makeFetchMock();
		await purgeCdnCacheForResolved("my-post", RESOLVED, { fetch });
		const body = JSON.parse(calls[0].body as string);
		expect(body).toEqual({ tags: ["slug:my-post"] });
	});

	it("does not throw on a non-200 response (failures are non-fatal)", async () => {
		const { fetch } = makeFetchMock(500);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		await expect(
			purgeCdnCacheForResolved("slug", RESOLVED, { fetch }),
		).resolves.toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it("does not throw when fetch itself rejects", async () => {
		const fetchImpl: typeof fetch = async () => {
			throw new Error("network down");
		};
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		await expect(
			purgeCdnCacheForResolved("slug", RESOLVED, { fetch: fetchImpl }),
		).resolves.toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});
});

describe("purgeCdnCacheForResolved — kind: 'webhook'", () => {
	const RESOLVED: ResolvedCdnPurge = {
		kind: "webhook",
		url: "https://hooks.example.com/purge",
		source: "config",
	};

	it("POSTs to the resolved webhook URL", async () => {
		const { fetch, calls } = makeFetchMock();
		await purgeCdnCacheForResolved("slug", RESOLVED, { fetch });
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe("https://hooks.example.com/purge");
		expect(calls[0].method).toBe("POST");
	});

	it("sets Content-Type: application/json", async () => {
		const { fetch, calls } = makeFetchMock();
		await purgeCdnCacheForResolved("slug", RESOLVED, { fetch });
		expect(calls[0].contentType).toBe("application/json");
	});

	it("sends a body with slug + purgedAt", async () => {
		const { fetch, calls } = makeFetchMock();
		await purgeCdnCacheForResolved("my-post", RESOLVED, { fetch });
		const body = JSON.parse(calls[0].body as string);
		expect(body.slug).toBe("my-post");
		expect(typeof body.purgedAt).toBe("string");
	});

	it("does not attach an Authorization header (webhook is unauthenticated)", async () => {
		const { fetch, calls } = makeFetchMock();
		await purgeCdnCacheForResolved("slug", RESOLVED, { fetch });
		expect(calls[0].authorization).toBeNull();
	});

	it("does not throw on a non-200 response", async () => {
		const { fetch } = makeFetchMock(500);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		await expect(
			purgeCdnCacheForResolved("slug", RESOLVED, { fetch }),
		).resolves.toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it("does not throw when fetch itself rejects", async () => {
		const fetchImpl: typeof fetch = async () => {
			throw new Error("network down");
		};
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		await expect(
			purgeCdnCacheForResolved("slug", RESOLVED, { fetch: fetchImpl }),
		).resolves.toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});
});

describe("purgeCdnCacheForResolved — fetch wiring", () => {
	let warnSpy: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => {
		warnSpy.mockRestore();
	});

	it("uses deps.fetch when provided", async () => {
		const { fetch, calls } = makeFetchMock();
		await purgeCdnCacheForResolved(
			"slug",
			{
				kind: "webhook",
				url: "https://example.com",
				source: "config",
			},
			{ fetch },
		);
		expect(calls).toHaveLength(1);
	});
});
