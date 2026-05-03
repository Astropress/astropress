import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	LISTMONK_FIELDS,
	ListmonkVerifyError,
	buildListmonkAuthHeader,
	buildListmonkHealthUrl,
	registerListmonk,
	verifyListmonk,
} from "../../../src/integrations/providers/listmonk";
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
	baseUrl: "https://newsletter.example.com",
	apiUser: "admin",
	apiKey: "secret-token",
};

afterEach(() => {
	_resetRegistryForTests();
});

describe("LISTMONK_FIELDS schema", () => {
	it("accepts a valid baseUrl/apiUser/apiKey triple", () => {
		expect(LISTMONK_FIELDS.parse(FIELDS)).toEqual(FIELDS);
	});

	it("rejects a malformed baseUrl", () => {
		expect(
			LISTMONK_FIELDS.safeParse({ ...FIELDS, baseUrl: "not-a-url" }).success,
		).toBe(false);
	});

	it("rejects an empty apiUser", () => {
		expect(LISTMONK_FIELDS.safeParse({ ...FIELDS, apiUser: "" }).success).toBe(
			false,
		);
	});

	it("rejects an empty apiKey", () => {
		expect(LISTMONK_FIELDS.safeParse({ ...FIELDS, apiKey: "" }).success).toBe(
			false,
		);
	});
});

describe("buildListmonkHealthUrl", () => {
	it("appends /api/health to a bare-origin baseUrl", () => {
		expect(buildListmonkHealthUrl("https://newsletter.example.com")).toBe(
			"https://newsletter.example.com/api/health",
		);
	});

	it("appends /api/health to a baseUrl with a trailing slash", () => {
		expect(buildListmonkHealthUrl("https://newsletter.example.com/")).toBe(
			"https://newsletter.example.com/api/health",
		);
	});

	it("replaces a path on the baseUrl with /api/health (absolute)", () => {
		expect(buildListmonkHealthUrl("https://newsletter.example.com/foo")).toBe(
			"https://newsletter.example.com/api/health",
		);
	});
});

describe("buildListmonkAuthHeader", () => {
	it("encodes user:key as base64 with the Basic prefix", () => {
		// btoa("admin:secret-token") → "YWRtaW46c2VjcmV0LXRva2Vu"
		expect(buildListmonkAuthHeader("admin", "secret-token")).toBe(
			"Basic YWRtaW46c2VjcmV0LXRva2Vu",
		);
	});

	it("uses a colon as the user/key separator (not, e.g., empty)", () => {
		// btoa("u:k") → "dTpr"; btoa("uk") → "dWs". Pinning the colon
		// kills any "drop the colon" mutant on the template literal.
		expect(buildListmonkAuthHeader("u", "k")).toBe("Basic dTpr");
	});

	it("preserves a colon embedded in the apiKey itself", () => {
		// btoa("u:k:v") → "dTprOnY=". Confirms the join is literal,
		// not a split-then-rejoin that would lose embedded colons.
		expect(buildListmonkAuthHeader("u", "k:v")).toBe("Basic dTprOnY=");
	});
});

describe("verifyListmonk", () => {
	let signal: AbortSignal;

	beforeEach(() => {
		signal = new AbortController().signal;
	});

	it("resolves on 200 OK", async () => {
		const { fetch, calls } = makeFetchMock({ status: 200 });
		await expect(
			verifyListmonk(FIELDS, { signal }, { fetch }),
		).resolves.toBeUndefined();
		expect(calls).toHaveLength(1);
	});

	it("uses HEAD method (mutator-killer for the literal 'HEAD')", async () => {
		const { fetch, calls } = makeFetchMock({ status: 200 });
		await verifyListmonk(FIELDS, { signal }, { fetch });
		expect(calls[0].method).toBe("HEAD");
	});

	it("hits the constructed URL ({baseUrl}/api/health)", async () => {
		const { fetch, calls } = makeFetchMock({ status: 200 });
		await verifyListmonk(FIELDS, { signal }, { fetch });
		expect(calls[0].url).toBe("https://newsletter.example.com/api/health");
	});

	it("attaches Basic-auth header built from apiUser/apiKey", async () => {
		const { fetch, calls } = makeFetchMock({ status: 200 });
		await verifyListmonk(FIELDS, { signal }, { fetch });
		expect(calls[0].authorization).toBe("Basic YWRtaW46c2VjcmV0LXRva2Vu");
	});

	it("forwards the AbortSignal so connect-flow's timeout aborts the fetch", async () => {
		const { fetch, calls } = makeFetchMock({ status: 200 });
		await verifyListmonk(FIELDS, { signal }, { fetch });
		expect(calls[0].signalIs).toBe(signal);
	});

	it("throws AUTH_REJECTED on 401", async () => {
		const { fetch } = makeFetchMock({ status: 401 });
		await expect(
			verifyListmonk(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_AUTH_REJECTED" });
	});

	it("throws AUTH_REJECTED on 403", async () => {
		const { fetch } = makeFetchMock({ status: 403 });
		await expect(
			verifyListmonk(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_AUTH_REJECTED" });
	});

	it("throws NOT_FOUND on 404 (distinct from AUTH_REJECTED)", async () => {
		const { fetch } = makeFetchMock({ status: 404 });
		await expect(
			verifyListmonk(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_NOT_FOUND" });
	});

	it("throws RATE_LIMITED on 429 (distinct from VERIFY_FAILED)", async () => {
		const { fetch } = makeFetchMock({ status: 429 });
		await expect(
			verifyListmonk(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_RATE_LIMITED" });
	});

	it("throws VERIFY_FAILED on 500 (generic non-ok fall-through)", async () => {
		const { fetch } = makeFetchMock({ status: 500 });
		await expect(
			verifyListmonk(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_VERIFY_FAILED" });
	});

	it("throws VERIFY_FAILED on 400 (4xx that isn't 401/403/404/429)", async () => {
		const { fetch } = makeFetchMock({ status: 400 });
		await expect(
			verifyListmonk(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_VERIFY_FAILED" });
	});

	it("ListmonkVerifyError subclasses Error and carries the typed code", async () => {
		const { fetch } = makeFetchMock({ status: 401 });
		try {
			await verifyListmonk(FIELDS, { signal }, { fetch });
			throw new Error("expected verify to throw");
		} catch (err) {
			expect(err).toBeInstanceOf(ListmonkVerifyError);
			expect(err).toBeInstanceOf(Error);
			expect((err as ListmonkVerifyError).code).toBe(
				"INTEGRATION_AUTH_REJECTED",
			);
		}
	});

	it("falls back to global fetch when deps.fetch is omitted", async () => {
		const stub = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(null, { status: 200 }));
		try {
			await expect(verifyListmonk(FIELDS, { signal })).resolves.toBeUndefined();
			expect(stub).toHaveBeenCalledTimes(1);
		} finally {
			stub.mockRestore();
		}
	});
});

describe("registerListmonk", () => {
	it("registers under newsletter with id 'listmonk' and label 'Listmonk'", () => {
		const entry = registerListmonk();
		expect(entry.domain).toBe("newsletter");
		expect(entry.id).toBe("listmonk");
		expect(entry.label).toBe("Listmonk");
		const looked = getProvider("newsletter", "listmonk");
		expect(looked?.label).toBe("Listmonk");
	});

	it("registers the LISTMONK_FIELDS schema (rejects an invalid payload)", () => {
		registerListmonk();
		const provider = getProvider("newsletter", "listmonk");
		expect(provider?.fields.safeParse({ baseUrl: "x" }).success).toBe(false);
	});

	it("wires verifyListmonk so connect-flow gets a callable verify", () => {
		registerListmonk();
		const provider = getProvider("newsletter", "listmonk");
		expect(typeof provider?.verify).toBe("function");
	});

	it("wires defaultErrorCode to VERIFY_FAILED", () => {
		registerListmonk();
		const provider = getProvider("newsletter", "listmonk");
		expect(provider?.defaultErrorCode).toBe("INTEGRATION_VERIFY_FAILED");
	});
});
