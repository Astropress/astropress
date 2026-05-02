import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	CLOUDFLARE_CDN_FIELDS,
	CloudflareCdnVerifyError,
	buildCloudflareAuthHeader,
	buildCloudflareTokenVerifyUrl,
	buildCloudflareZoneUrl,
	classifyCloudflareStatus,
	registerCloudflareCdn,
	verifyCloudflareCdn,
} from "../../../src/integrations/providers/cloudflare-cdn";
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

function makeFetchMock(statuses: number[]): {
	fetch: typeof fetch;
	calls: CapturedCall[];
} {
	const calls: CapturedCall[] = [];
	let i = 0;
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
		const status = statuses[i] ?? statuses[statuses.length - 1] ?? 200;
		i += 1;
		return new Response(null, { status });
	};
	return { fetch: f, calls };
}

const FIELDS = {
	apiToken: "cf-token-abc",
	zoneId: "zone-12345",
};

afterEach(() => {
	_resetRegistryForTests();
});

describe("CLOUDFLARE_CDN_FIELDS schema", () => {
	it("accepts apiToken/zoneId", () => {
		expect(CLOUDFLARE_CDN_FIELDS.parse(FIELDS)).toEqual(FIELDS);
	});

	it("rejects an empty apiToken", () => {
		expect(
			CLOUDFLARE_CDN_FIELDS.safeParse({ ...FIELDS, apiToken: "" }).success,
		).toBe(false);
	});

	it("rejects an empty zoneId", () => {
		expect(
			CLOUDFLARE_CDN_FIELDS.safeParse({ ...FIELDS, zoneId: "" }).success,
		).toBe(false);
	});
});

describe("URL builders", () => {
	it("buildCloudflareTokenVerifyUrl pins the verify endpoint", () => {
		expect(buildCloudflareTokenVerifyUrl()).toBe(
			"https://api.cloudflare.com/client/v4/user/tokens/verify",
		);
	});

	it("buildCloudflareZoneUrl pins the zone-by-id endpoint", () => {
		expect(buildCloudflareZoneUrl("zone-12345")).toBe(
			"https://api.cloudflare.com/client/v4/zones/zone-12345",
		);
	});

	it("buildCloudflareZoneUrl URL-encodes a zoneId with reserved characters", () => {
		expect(buildCloudflareZoneUrl("zone/with:reserved")).toBe(
			"https://api.cloudflare.com/client/v4/zones/zone%2Fwith%3Areserved",
		);
	});
});

describe("buildCloudflareAuthHeader", () => {
	it("prefixes the token with 'Bearer '", () => {
		expect(buildCloudflareAuthHeader("xyz")).toBe("Bearer xyz");
	});
});

describe("classifyCloudflareStatus", () => {
	const r = (status: number) => new Response(null, { status });

	it("returns null on 200", () => {
		expect(classifyCloudflareStatus(r(200))).toBeNull();
	});

	it("returns null on 204", () => {
		expect(classifyCloudflareStatus(r(204))).toBeNull();
	});

	it("returns AUTH_REJECTED on 401", () => {
		expect(classifyCloudflareStatus(r(401))).toBe("INTEGRATION_AUTH_REJECTED");
	});

	it("returns AUTH_REJECTED on 403", () => {
		expect(classifyCloudflareStatus(r(403))).toBe("INTEGRATION_AUTH_REJECTED");
	});

	it("returns NOT_FOUND on 404", () => {
		expect(classifyCloudflareStatus(r(404))).toBe("INTEGRATION_NOT_FOUND");
	});

	it("returns RATE_LIMITED on 429", () => {
		expect(classifyCloudflareStatus(r(429))).toBe("INTEGRATION_RATE_LIMITED");
	});

	it("returns VERIFY_FAILED on 500", () => {
		expect(classifyCloudflareStatus(r(500))).toBe("INTEGRATION_VERIFY_FAILED");
	});

	it("returns VERIFY_FAILED on 400 (4xx that isn't 401/403/404/429)", () => {
		expect(classifyCloudflareStatus(r(400))).toBe("INTEGRATION_VERIFY_FAILED");
	});
});

describe("verifyCloudflareCdn", () => {
	let signal: AbortSignal;

	beforeEach(() => {
		signal = new AbortController().signal;
	});

	it("resolves when both probes return 200", async () => {
		const { fetch, calls } = makeFetchMock([200, 200]);
		await expect(
			verifyCloudflareCdn(FIELDS, { signal }, { fetch }),
		).resolves.toBeUndefined();
		expect(calls).toHaveLength(2);
	});

	it("hits the token-verify endpoint first", async () => {
		const { fetch, calls } = makeFetchMock([200, 200]);
		await verifyCloudflareCdn(FIELDS, { signal }, { fetch });
		expect(calls[0].url).toBe(
			"https://api.cloudflare.com/client/v4/user/tokens/verify",
		);
	});

	it("hits the zone endpoint second", async () => {
		const { fetch, calls } = makeFetchMock([200, 200]);
		await verifyCloudflareCdn(FIELDS, { signal }, { fetch });
		expect(calls[1].url).toBe(
			"https://api.cloudflare.com/client/v4/zones/zone-12345",
		);
	});

	it("uses GET on both probes", async () => {
		const { fetch, calls } = makeFetchMock([200, 200]);
		await verifyCloudflareCdn(FIELDS, { signal }, { fetch });
		expect(calls[0].method).toBe("GET");
		expect(calls[1].method).toBe("GET");
	});

	it("attaches Bearer auth on both probes", async () => {
		const { fetch, calls } = makeFetchMock([200, 200]);
		await verifyCloudflareCdn(FIELDS, { signal }, { fetch });
		expect(calls[0].authorization).toBe("Bearer cf-token-abc");
		expect(calls[1].authorization).toBe("Bearer cf-token-abc");
	});

	it("forwards the AbortSignal on both probes", async () => {
		const { fetch, calls } = makeFetchMock([200, 200]);
		await verifyCloudflareCdn(FIELDS, { signal }, { fetch });
		expect(calls[0].signalIs).toBe(signal);
		expect(calls[1].signalIs).toBe(signal);
	});

	it("short-circuits with AUTH_REJECTED when token-verify returns 401 (no zone fetch)", async () => {
		const { fetch, calls } = makeFetchMock([401]);
		await expect(
			verifyCloudflareCdn(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_AUTH_REJECTED" });
		expect(calls).toHaveLength(1);
	});

	it("throws AUTH_REJECTED when zone probe returns 403 (token valid but no zone scope)", async () => {
		const { fetch, calls } = makeFetchMock([200, 403]);
		await expect(
			verifyCloudflareCdn(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_AUTH_REJECTED" });
		expect(calls).toHaveLength(2);
	});

	it("throws NOT_FOUND when zone probe returns 404 (zoneId does not exist)", async () => {
		const { fetch } = makeFetchMock([200, 404]);
		await expect(
			verifyCloudflareCdn(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_NOT_FOUND" });
	});

	it("throws RATE_LIMITED when token probe returns 429", async () => {
		const { fetch } = makeFetchMock([429]);
		await expect(
			verifyCloudflareCdn(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_RATE_LIMITED" });
	});

	it("throws VERIFY_FAILED when token probe returns 500", async () => {
		const { fetch } = makeFetchMock([500]);
		await expect(
			verifyCloudflareCdn(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_VERIFY_FAILED" });
	});

	it("CloudflareCdnVerifyError subclasses Error and carries the typed code", async () => {
		const { fetch } = makeFetchMock([401]);
		try {
			await verifyCloudflareCdn(FIELDS, { signal }, { fetch });
			throw new Error("expected verify to throw");
		} catch (err) {
			expect(err).toBeInstanceOf(CloudflareCdnVerifyError);
			expect(err).toBeInstanceOf(Error);
			expect((err as CloudflareCdnVerifyError).code).toBe(
				"INTEGRATION_AUTH_REJECTED",
			);
		}
	});
});

describe("registerCloudflareCdn", () => {
	it("registers under cdn-purge with id 'cloudflare' and label 'Cloudflare'", () => {
		const entry = registerCloudflareCdn();
		expect(entry.domain).toBe("cdn-purge");
		expect(entry.id).toBe("cloudflare");
		expect(entry.label).toBe("Cloudflare");
		const looked = getProvider("cdn-purge", "cloudflare");
		expect(looked?.label).toBe("Cloudflare");
	});

	it("registers CLOUDFLARE_CDN_FIELDS schema", () => {
		registerCloudflareCdn();
		const provider = getProvider("cdn-purge", "cloudflare");
		expect(provider?.fields.safeParse({ apiToken: "x" }).success).toBe(false);
	});

	it("wires verifyCloudflareCdn so connect-flow gets a callable verify", () => {
		registerCloudflareCdn();
		const provider = getProvider("cdn-purge", "cloudflare");
		expect(typeof provider?.verify).toBe("function");
	});

	it("wires defaultErrorCode to VERIFY_FAILED", () => {
		registerCloudflareCdn();
		const provider = getProvider("cdn-purge", "cloudflare");
		expect(provider?.defaultErrorCode).toBe("INTEGRATION_VERIFY_FAILED");
	});
});
