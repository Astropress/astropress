import { describe, expect, it } from "vitest";

import { resolveCdnPurge } from "../../../src/integrations/resolvers/cdn-purge-resolver";

describe("resolveCdnPurge — registry takes priority", () => {
	it("returns cloudflare/registry when registry has fields, ignoring env and config", () => {
		const r = resolveCdnPurge({
			registry: { apiToken: "reg-tok", zoneId: "reg-zone" },
			env: {
				CLOUDFLARE_API_TOKEN: "env-tok",
				CLOUDFLARE_ZONE_ID: "env-zone",
			},
			config: { cdnPurgeWebhook: "https://example.com/purge" },
		});
		expect(r).toEqual({
			kind: "cloudflare",
			apiToken: "reg-tok",
			zoneId: "reg-zone",
			source: "registry",
		});
	});

	it("propagates the registry's apiToken verbatim (no trim, no mutate)", () => {
		const r = resolveCdnPurge({
			registry: { apiToken: "  pad  ", zoneId: "z" },
		});
		expect(r).toMatchObject({ apiToken: "  pad  " });
	});

	it("propagates the registry's zoneId verbatim", () => {
		const r = resolveCdnPurge({
			registry: { apiToken: "t", zoneId: "zone-with-:reserved/chars" },
		});
		expect(r).toMatchObject({ zoneId: "zone-with-:reserved/chars" });
	});
});

describe("resolveCdnPurge — env fallback when registry is absent", () => {
	it("returns cloudflare/env when registry is null and env has both vars", () => {
		const r = resolveCdnPurge({
			registry: null,
			env: { CLOUDFLARE_API_TOKEN: "env-tok", CLOUDFLARE_ZONE_ID: "env-zone" },
			config: { cdnPurgeWebhook: "https://example.com/purge" },
		});
		expect(r).toEqual({
			kind: "cloudflare",
			apiToken: "env-tok",
			zoneId: "env-zone",
			source: "env",
		});
	});

	it("returns cloudflare/env when registry is undefined", () => {
		const r = resolveCdnPurge({
			env: { CLOUDFLARE_API_TOKEN: "t", CLOUDFLARE_ZONE_ID: "z" },
		});
		expect(r.kind).toBe("cloudflare");
		if (r.kind === "cloudflare") expect(r.source).toBe("env");
	});

	it("falls through to config when env has only CLOUDFLARE_API_TOKEN", () => {
		const r = resolveCdnPurge({
			env: { CLOUDFLARE_API_TOKEN: "t" },
			config: { cdnPurgeWebhook: "https://example.com/purge" },
		});
		expect(r).toEqual({
			kind: "webhook",
			url: "https://example.com/purge",
			source: "config",
		});
	});

	it("falls through to config when env has only CLOUDFLARE_ZONE_ID", () => {
		const r = resolveCdnPurge({
			env: { CLOUDFLARE_ZONE_ID: "z" },
			config: { cdnPurgeWebhook: "https://example.com/purge" },
		});
		expect(r.kind).toBe("webhook");
	});

	it("treats empty CLOUDFLARE_API_TOKEN as missing", () => {
		const r = resolveCdnPurge({
			env: { CLOUDFLARE_API_TOKEN: "", CLOUDFLARE_ZONE_ID: "z" },
		});
		expect(r.kind).toBe("none");
	});

	it("treats empty CLOUDFLARE_ZONE_ID as missing", () => {
		const r = resolveCdnPurge({
			env: { CLOUDFLARE_API_TOKEN: "t", CLOUDFLARE_ZONE_ID: "" },
		});
		expect(r.kind).toBe("none");
	});
});

describe("resolveCdnPurge — config fallback", () => {
	it("returns webhook/config when only config.cdnPurgeWebhook is set", () => {
		const r = resolveCdnPurge({
			config: { cdnPurgeWebhook: "https://example.com/purge" },
		});
		expect(r).toEqual({
			kind: "webhook",
			url: "https://example.com/purge",
			source: "config",
		});
	});

	it("treats an empty cdnPurgeWebhook string as missing", () => {
		const r = resolveCdnPurge({ config: { cdnPurgeWebhook: "" } });
		expect(r.kind).toBe("none");
	});

	it("treats a null cdnPurgeWebhook as missing", () => {
		const r = resolveCdnPurge({ config: { cdnPurgeWebhook: null } });
		expect(r.kind).toBe("none");
	});
});

describe("resolveCdnPurge — empty result", () => {
	it("returns kind: 'none' when all sources are absent", () => {
		expect(resolveCdnPurge({})).toEqual({ kind: "none" });
	});

	it("returns kind: 'none' when all sources are explicitly null/undefined", () => {
		expect(resolveCdnPurge({ registry: null, env: null, config: null })).toEqual({ kind: "none" });
	});

	it("returns kind: 'none' when env is an empty object", () => {
		expect(resolveCdnPurge({ env: {} })).toEqual({ kind: "none" });
	});
});
