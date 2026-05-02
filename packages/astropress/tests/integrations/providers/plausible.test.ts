import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	PLAUSIBLE_FIELDS,
	PlausibleVerifyError,
	buildPlausibleAuthHeader,
	buildPlausibleSiteUrl,
	registerPlausible,
	verifyPlausible,
} from "../../../src/integrations/providers/plausible";
import {
	_resetRegistryForTests,
	getProvider,
} from "../../../src/integrations/registry";

interface CapturedCall {
	url: string;
	method: string | undefined;
	authorization: string | null;
	signalIs: AbortSignal | undefined;
}

function makeFetchMock(response: { status: number }): {
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
			signalIs: init?.signal ?? undefined,
		});
		return new Response(null, { status: response.status });
	};
	return { fetch: f, calls };
}

const FIELDS = {
	host: "https://plausible.io",
	siteId: "example.com",
	apiKey: "plausible-token-xyz",
};

afterEach(() => {
	_resetRegistryForTests();
});

describe("PLAUSIBLE_FIELDS schema", () => {
	it("accepts a valid host/siteId/apiKey triple", () => {
		expect(PLAUSIBLE_FIELDS.parse(FIELDS)).toEqual(FIELDS);
	});

	it("rejects a non-URL host", () => {
		expect(
			PLAUSIBLE_FIELDS.safeParse({ ...FIELDS, host: "plausible.io" }).success,
		).toBe(false);
	});

	it("rejects an empty siteId", () => {
		expect(PLAUSIBLE_FIELDS.safeParse({ ...FIELDS, siteId: "" }).success).toBe(
			false,
		);
	});

	it("rejects an empty apiKey", () => {
		expect(PLAUSIBLE_FIELDS.safeParse({ ...FIELDS, apiKey: "" }).success).toBe(
			false,
		);
	});
});

describe("buildPlausibleSiteUrl", () => {
	it("appends /api/v1/sites/{siteId} to a bare-origin host", () => {
		expect(buildPlausibleSiteUrl("https://plausible.io", "example.com")).toBe(
			"https://plausible.io/api/v1/sites/example.com",
		);
	});

	it("URL-encodes a siteId that contains reserved characters", () => {
		// `:` and `/` in a siteId would otherwise change the URL path
		// shape; encodeURIComponent renders them safe.
		expect(
			buildPlausibleSiteUrl("https://plausible.io", "team/site:prod"),
		).toBe("https://plausible.io/api/v1/sites/team%2Fsite%3Aprod");
	});

	it("works against a self-hosted host with a trailing slash", () => {
		expect(
			buildPlausibleSiteUrl("https://stats.example.com/", "example.com"),
		).toBe("https://stats.example.com/api/v1/sites/example.com");
	});
});

describe("buildPlausibleAuthHeader", () => {
	it("prefixes the token with 'Bearer '", () => {
		expect(buildPlausibleAuthHeader("abc")).toBe("Bearer abc");
	});

	it("does not mutate or trim the token", () => {
		// Pinning a token with surrounding whitespace catches a mutant
		// that would helpfully .trim() and accidentally drop a real
		// trailing-whitespace key configured by the operator.
		expect(buildPlausibleAuthHeader("  abc  ")).toBe("Bearer   abc  ");
	});
});

describe("verifyPlausible", () => {
	let signal: AbortSignal;

	beforeEach(() => {
		signal = new AbortController().signal;
	});

	it("resolves on 200 OK", async () => {
		const { fetch, calls } = makeFetchMock({ status: 200 });
		await expect(
			verifyPlausible(FIELDS, { signal }, { fetch }),
		).resolves.toBeUndefined();
		expect(calls).toHaveLength(1);
	});

	it("uses GET method (mutator-killer for the literal 'GET')", async () => {
		const { fetch, calls } = makeFetchMock({ status: 200 });
		await verifyPlausible(FIELDS, { signal }, { fetch });
		expect(calls[0].method).toBe("GET");
	});

	it("hits the constructed URL ({host}/api/v1/sites/{siteId})", async () => {
		const { fetch, calls } = makeFetchMock({ status: 200 });
		await verifyPlausible(FIELDS, { signal }, { fetch });
		expect(calls[0].url).toBe("https://plausible.io/api/v1/sites/example.com");
	});

	it("attaches Bearer auth header built from apiKey", async () => {
		const { fetch, calls } = makeFetchMock({ status: 200 });
		await verifyPlausible(FIELDS, { signal }, { fetch });
		expect(calls[0].authorization).toBe("Bearer plausible-token-xyz");
	});

	it("forwards the AbortSignal so connect-flow's timeout aborts the fetch", async () => {
		const { fetch, calls } = makeFetchMock({ status: 200 });
		await verifyPlausible(FIELDS, { signal }, { fetch });
		expect(calls[0].signalIs).toBe(signal);
	});

	it("throws AUTH_REJECTED on 401", async () => {
		const { fetch } = makeFetchMock({ status: 401 });
		await expect(
			verifyPlausible(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_AUTH_REJECTED" });
	});

	it("throws AUTH_REJECTED on 403 (token-without-site-scope)", async () => {
		const { fetch } = makeFetchMock({ status: 403 });
		await expect(
			verifyPlausible(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_AUTH_REJECTED" });
	});

	it("throws NOT_FOUND on 404 (distinct from AUTH_REJECTED)", async () => {
		const { fetch } = makeFetchMock({ status: 404 });
		await expect(
			verifyPlausible(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_NOT_FOUND" });
	});

	it("throws RATE_LIMITED on 429 (distinct from VERIFY_FAILED)", async () => {
		const { fetch } = makeFetchMock({ status: 429 });
		await expect(
			verifyPlausible(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_RATE_LIMITED" });
	});

	it("throws VERIFY_FAILED on 500", async () => {
		const { fetch } = makeFetchMock({ status: 500 });
		await expect(
			verifyPlausible(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_VERIFY_FAILED" });
	});

	it("throws VERIFY_FAILED on 400 (4xx that isn't 401/403/404/429)", async () => {
		const { fetch } = makeFetchMock({ status: 400 });
		await expect(
			verifyPlausible(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_VERIFY_FAILED" });
	});

	it("PlausibleVerifyError subclasses Error and carries the typed code", async () => {
		const { fetch } = makeFetchMock({ status: 403 });
		try {
			await verifyPlausible(FIELDS, { signal }, { fetch });
			throw new Error("expected verify to throw");
		} catch (err) {
			expect(err).toBeInstanceOf(PlausibleVerifyError);
			expect(err).toBeInstanceOf(Error);
			expect((err as PlausibleVerifyError).code).toBe(
				"INTEGRATION_AUTH_REJECTED",
			);
		}
	});
});

describe("registerPlausible", () => {
	it("registers under analytics with id 'plausible' and label 'Plausible'", () => {
		const entry = registerPlausible();
		expect(entry.domain).toBe("analytics");
		expect(entry.id).toBe("plausible");
		expect(entry.label).toBe("Plausible");
		const looked = getProvider("analytics", "plausible");
		expect(looked?.label).toBe("Plausible");
	});

	it("registers PLAUSIBLE_FIELDS schema (rejects an invalid payload)", () => {
		registerPlausible();
		const provider = getProvider("analytics", "plausible");
		expect(provider?.fields.safeParse({ host: "x" }).success).toBe(false);
	});

	it("wires verifyPlausible so connect-flow gets a callable verify", () => {
		registerPlausible();
		const provider = getProvider("analytics", "plausible");
		expect(typeof provider?.verify).toBe("function");
	});

	it("wires defaultErrorCode to AUTH_REJECTED (Plausible's most common verify failure)", () => {
		registerPlausible();
		const provider = getProvider("analytics", "plausible");
		expect(provider?.defaultErrorCode).toBe("INTEGRATION_AUTH_REJECTED");
	});
});
