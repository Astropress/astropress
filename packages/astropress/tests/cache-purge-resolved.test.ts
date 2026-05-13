import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { purgeCdnCache, purgeCdnCacheForResolved } from "../src/cache-purge";
import type { CmsConfig } from "../src/config";
import type { ResolvedCdnPurge } from "../src/integrations/resolvers/cdn-purge-resolver";

interface CapturedCall {
	url: string;
	method: string | undefined;
	authorization: string | null;
	contentType: string | null;
	body: string | null;
}

function makeFetchMock(
	status = 200,
	responseBody: string | null = null,
): {
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
		return new Response(responseBody, { status });
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
		expect(calls[0].url).toBe("https://api.cloudflare.com/client/v4/zones/zone-12345/purge_cache");
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
		await expect(purgeCdnCacheForResolved("slug", RESOLVED, { fetch })).resolves.toBeUndefined();
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
		await expect(purgeCdnCacheForResolved("slug", RESOLVED, { fetch })).resolves.toBeUndefined();
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

describe("purgeCdnCacheForResolved — non-2xx with body that fails to read", () => {
	// Covers the `.catch(() => "")` callback on res.text() — when the upstream
	// returns non-OK and the body stream itself throws (chunked encoding cut,
	// gzip decode error, etc.). The warn-log path must still fire with an
	// empty body string rather than crashing.
	function makeFetchWithBrokenBody(): typeof fetch {
		return async () => {
			const res = new Response(null, { status: 500 });
			Object.defineProperty(res, "text", {
				value: () => Promise.reject(new Error("body stream broken")),
			});
			return res;
		};
	}

	it("logs a warning for cloudflare when res.text() rejects", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		await expect(
			purgeCdnCacheForResolved(
				"slug",
				{
					kind: "cloudflare",
					apiToken: "tok",
					zoneId: "z",
					source: "registry",
				},
				{ fetch: makeFetchWithBrokenBody() },
			),
		).resolves.toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
		// Pin L38 StringLiteral (`"" `→ `"Stryker was here!"`) and L38 ArrowFunction
		// (`() => ""` → `() => undefined`). The body fallback flows into the
		// template; original yields a message ending with status + empty.
		const msg = String(warnSpy.mock.calls[0]?.[0] ?? "");
		expect(msg).not.toContain("Stryker was here");
		expect(msg).not.toContain("undefined");
		warnSpy.mockRestore();
	});

	it("logs a warning for webhook when res.text() rejects", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		await expect(
			purgeCdnCacheForResolved(
				"slug",
				{ kind: "webhook", url: "https://x", source: "config" },
				{ fetch: makeFetchWithBrokenBody() },
			),
		).resolves.toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
		// Pins L57 StringLiteral + ArrowFunction — same equivalence as cloudflare.
		const msg = String(warnSpy.mock.calls[0]?.[0] ?? "");
		expect(msg).not.toContain("Stryker was here");
		expect(msg).not.toContain("undefined");
		warnSpy.mockRestore();
	});
});

describe("purgeCdnCache (env-driven) — pins L85 process-typeof + L89 ObjectLiteral", () => {
	const ORIG_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
	const ORIG_ZONE = process.env.CLOUDFLARE_ZONE_ID;
	const ORIG_FETCH = globalThis.fetch;

	afterEach(() => {
		if (ORIG_TOKEN === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
		else process.env.CLOUDFLARE_API_TOKEN = ORIG_TOKEN;
		if (ORIG_ZONE === undefined) delete process.env.CLOUDFLARE_ZONE_ID;
		else process.env.CLOUDFLARE_ZONE_ID = ORIG_ZONE;
		globalThis.fetch = ORIG_FETCH;
	});

	it("resolves to cloudflare and hits the zone API when CF env vars are set (no registry, no webhook)", async () => {
		process.env.CLOUDFLARE_API_TOKEN = "env-token";
		process.env.CLOUDFLARE_ZONE_ID = "env-zone";
		const captured: Array<{ url: string; auth: string | null }> = [];
		globalThis.fetch = (async (input, init) => {
			const url = typeof input === "string" ? input : input.toString();
			const headers =
				init?.headers instanceof Headers
					? init.headers
					: new Headers((init?.headers as Record<string, string>) ?? {});
			captured.push({ url, auth: headers.get("authorization") });
			return new Response("", { status: 200 });
		}) as typeof fetch;
		await purgeCdnCache("env-slug", { cdnPurgeWebhook: undefined } as CmsConfig);
		// L85 false / =/== flip would zero out env → resolveCdnPurge would not
		// see CF creds and the call would short-circuit on `kind: "none"`.
		// L89 ObjectLiteral `{}` strips the CLOUDFLARE_* keys for the same effect.
		expect(captured).toHaveLength(1);
		expect(captured[0].url).toContain("/zones/env-zone/purge_cache");
		expect(captured[0].auth).toBe("Bearer env-token");
	});
});

describe("purgeCdnCacheForResolved — success paths emit no warnings (pins L37/L56 `if (!res.ok)`)", () => {
	it("cloudflare 200 response triggers no console.warn", async () => {
		const fetchImpl: typeof fetch = async () => new Response("", { status: 200 });
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		await purgeCdnCacheForResolved(
			"slug",
			{ kind: "cloudflare", apiToken: "tok", zoneId: "z", source: "registry" },
			{ fetch: fetchImpl },
		);
		// L37 mutant flips `if (!res.ok)` → `if (true)`, so even a 200 logs.
		expect(warnSpy).not.toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it("webhook 200 response triggers no console.warn", async () => {
		const fetchImpl: typeof fetch = async () => new Response("", { status: 200 });
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		await purgeCdnCacheForResolved(
			"slug",
			{ kind: "webhook", url: "https://x", source: "config" },
			{ fetch: fetchImpl },
		);
		expect(warnSpy).not.toHaveBeenCalled();
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

describe("purgeCdnCacheForResolved — log message content (pins L40/L44/L58/L61)", () => {
	let warnSpy: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => {
		warnSpy.mockRestore();
	});

	it("Cloudflare non-ok log message includes slug + status + body (pins L40 template)", async () => {
		const { fetch } = makeFetchMock(403, "forbidden-body");
		await purgeCdnCacheForResolved(
			"my-slug",
			{
				kind: "cloudflare",
				apiToken: "tok",
				zoneId: "z",
				source: "registry",
			},
			{ fetch },
		);
		const msg = String(warnSpy.mock.calls[0]?.[0] ?? "");
		expect(msg).toContain("[cache-purge]");
		expect(msg).toContain("Cloudflare");
		expect(msg).toContain("my-slug");
		expect(msg).toContain("403");
		expect(msg).toContain("forbidden-body");
	});

	it("Cloudflare fetch-throws log message includes slug (pins L44 template)", async () => {
		const fetchImpl: typeof fetch = async () => {
			throw new Error("network");
		};
		await purgeCdnCacheForResolved(
			"err-slug",
			{
				kind: "cloudflare",
				apiToken: "tok",
				zoneId: "z",
				source: "registry",
			},
			{ fetch: fetchImpl },
		);
		const msg = String(warnSpy.mock.calls[0]?.[0] ?? "");
		expect(msg).toContain("[cache-purge]");
		expect(msg).toContain("Cloudflare");
		expect(msg).toContain("err-slug");
	});

	it("Webhook non-ok log message includes slug + status + body (pins L58 template)", async () => {
		const { fetch } = makeFetchMock(502, "bad-gateway-body");
		await purgeCdnCacheForResolved(
			"hook-slug",
			{ kind: "webhook", url: "https://x", source: "config" },
			{ fetch },
		);
		const msg = String(warnSpy.mock.calls[0]?.[0] ?? "");
		expect(msg).toContain("[cache-purge]");
		expect(msg).toContain("Webhook");
		expect(msg).toContain("hook-slug");
		expect(msg).toContain("502");
		expect(msg).toContain("bad-gateway-body");
	});

	it("Webhook fetch-throws log message includes slug (pins L61 template)", async () => {
		const fetchImpl: typeof fetch = async () => {
			throw new Error("network");
		};
		await purgeCdnCacheForResolved(
			"hook-err-slug",
			{ kind: "webhook", url: "https://x", source: "config" },
			{ fetch: fetchImpl },
		);
		const msg = String(warnSpy.mock.calls[0]?.[0] ?? "");
		expect(msg).toContain("[cache-purge]");
		expect(msg).toContain("Webhook");
		expect(msg).toContain("hook-err-slug");
	});
});
