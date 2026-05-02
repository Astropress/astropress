import { describe, expect, it } from "vitest";

import { resolveNewsletter } from "../../../src/integrations/resolvers/newsletter-resolver";

const REG = { baseUrl: "https://lm.example.com", apiUser: "u", apiKey: "k" };
const FULL_ENV = {
	LISTMONK_API_URL: "https://lm-env.example.com",
	LISTMONK_API_USERNAME: "envU",
	LISTMONK_API_PASSWORD: "envP",
	LISTMONK_LIST_ID: "42",
};

describe("resolveNewsletter — NEWSLETTER_DELIVERY_MODE=mock forces mock", () => {
	it("returns mock when env explicitly forces it, even if registry has credentials", () => {
		const r = resolveNewsletter({
			registry: REG,
			env: { ...FULL_ENV, NEWSLETTER_DELIVERY_MODE: "mock" },
		});
		expect(r).toEqual({ kind: "mock" });
	});

	it("returns mock when env explicitly forces it, even if env has all four LISTMONK_*", () => {
		const r = resolveNewsletter({
			env: { ...FULL_ENV, NEWSLETTER_DELIVERY_MODE: "mock" },
		});
		expect(r).toEqual({ kind: "mock" });
	});

	it("does NOT force mock for any other NEWSLETTER_DELIVERY_MODE value (e.g. 'listmonk')", () => {
		const r = resolveNewsletter({
			env: { ...FULL_ENV, NEWSLETTER_DELIVERY_MODE: "listmonk" },
		});
		expect(r.kind).toBe("listmonk");
	});
});

describe("resolveNewsletter — listId is required for any listmonk path", () => {
	it("returns mock when LISTMONK_LIST_ID is missing even with full registry credentials", () => {
		const r = resolveNewsletter({
			registry: REG,
			env: {
				LISTMONK_API_URL: "x",
				LISTMONK_API_USERNAME: "u",
				LISTMONK_API_PASSWORD: "p",
			},
		});
		expect(r).toEqual({ kind: "mock" });
	});

	it("returns mock when LISTMONK_LIST_ID is empty string", () => {
		const r = resolveNewsletter({
			registry: REG,
			env: { LISTMONK_LIST_ID: "" },
		});
		expect(r).toEqual({ kind: "mock" });
	});

	it("returns mock when env is undefined (no listId reachable)", () => {
		const r = resolveNewsletter({ registry: REG });
		expect(r).toEqual({ kind: "mock" });
	});
});

describe("resolveNewsletter — registry takes priority over env", () => {
	it("returns listmonk/registry credentials when both registry and full env are present", () => {
		const r = resolveNewsletter({ registry: REG, env: FULL_ENV });
		expect(r).toEqual({
			kind: "listmonk",
			baseUrl: REG.baseUrl,
			apiUser: REG.apiUser,
			apiKey: REG.apiKey,
			listId: FULL_ENV.LISTMONK_LIST_ID,
			credentialSource: "registry",
		});
	});

	it("propagates the env's LISTMONK_LIST_ID even when credentials come from registry", () => {
		const r = resolveNewsletter({
			registry: REG,
			env: { ...FULL_ENV, LISTMONK_LIST_ID: "99" },
		});
		expect(r.kind).toBe("listmonk");
		if (r.kind === "listmonk") expect(r.listId).toBe("99");
	});

	it("does not mutate or trim the registry's apiKey", () => {
		const r = resolveNewsletter({
			registry: { ...REG, apiKey: "  pad  " },
			env: { LISTMONK_LIST_ID: "1" },
		});
		expect(r.kind).toBe("listmonk");
		if (r.kind === "listmonk") expect(r.apiKey).toBe("  pad  ");
	});
});

describe("resolveNewsletter — env-only credentials", () => {
	it("returns listmonk/env when registry is null and all four env vars are set", () => {
		const r = resolveNewsletter({ registry: null, env: FULL_ENV });
		expect(r).toEqual({
			kind: "listmonk",
			baseUrl: FULL_ENV.LISTMONK_API_URL,
			apiUser: FULL_ENV.LISTMONK_API_USERNAME,
			apiKey: FULL_ENV.LISTMONK_API_PASSWORD,
			listId: FULL_ENV.LISTMONK_LIST_ID,
			credentialSource: "env",
		});
	});

	it("returns mock when LISTMONK_API_URL is missing", () => {
		const r = resolveNewsletter({
			env: { ...FULL_ENV, LISTMONK_API_URL: undefined },
		});
		expect(r.kind).toBe("mock");
	});

	it("returns mock when LISTMONK_API_USERNAME is missing", () => {
		const r = resolveNewsletter({
			env: { ...FULL_ENV, LISTMONK_API_USERNAME: undefined },
		});
		expect(r.kind).toBe("mock");
	});

	it("returns mock when LISTMONK_API_PASSWORD is missing", () => {
		const r = resolveNewsletter({
			env: { ...FULL_ENV, LISTMONK_API_PASSWORD: undefined },
		});
		expect(r.kind).toBe("mock");
	});

	it("returns mock when LISTMONK_API_URL is empty string", () => {
		const r = resolveNewsletter({ env: { ...FULL_ENV, LISTMONK_API_URL: "" } });
		expect(r.kind).toBe("mock");
	});

	it("returns mock when LISTMONK_API_USERNAME is empty string", () => {
		const r = resolveNewsletter({
			env: { ...FULL_ENV, LISTMONK_API_USERNAME: "" },
		});
		expect(r.kind).toBe("mock");
	});

	it("returns mock when LISTMONK_API_PASSWORD is empty string", () => {
		const r = resolveNewsletter({
			env: { ...FULL_ENV, LISTMONK_API_PASSWORD: "" },
		});
		expect(r.kind).toBe("mock");
	});
});

describe("resolveNewsletter — empty result", () => {
	it("returns mock when input is entirely empty", () => {
		expect(resolveNewsletter({})).toEqual({ kind: "mock" });
	});

	it("returns mock when input is explicitly null/undefined for both sources", () => {
		expect(resolveNewsletter({ registry: null, env: null })).toEqual({
			kind: "mock",
		});
	});
});
