import { afterEach, describe, expect, it } from "vitest";

import {
	_resetCloudflareCdnProviderForTests,
	registerCloudflareCdnProvider,
	verifyCloudflareCdnConnection,
} from "../../src/integrations/providers/cloudflare-cdn";
import {
	_resetGithubDeployProviderForTests,
	registerGithubDeployProvider,
	verifyGithubDeployConnection,
} from "../../src/integrations/providers/github-deploy";
import {
	_resetListmonkProviderForTests,
	buildListmonkAuthHeader,
	registerListmonkProvider,
	verifyListmonkConnection,
} from "../../src/integrations/providers/listmonk";
import {
	_resetPlausibleProviderForTests,
	registerPlausibleProvider,
	verifyPlausibleConnection,
} from "../../src/integrations/providers/plausible";
import {
	_resetRegistryForTests,
	getProvider,
} from "../../src/integrations/registry";

afterEach(() => {
	_resetRegistryForTests();
	_resetListmonkProviderForTests();
	_resetPlausibleProviderForTests();
	_resetCloudflareCdnProviderForTests();
	_resetGithubDeployProviderForTests();
});

function fakeFetch(
	responses: Array<{
		url?: RegExp;
		status: number;
		body?: string;
	}>,
): typeof fetch {
	const remaining = [...responses];
	return (async (input: RequestInfo | URL) => {
		const next = remaining.shift();
		if (!next) throw new Error("no more fake responses");
		if (next.url) {
			const url = typeof input === "string" ? input : input.toString();
			expect(next.url.test(url)).toBe(true);
		}
		return new Response(next.body ?? "", { status: next.status });
	}) as typeof fetch;
}

describe("Listmonk provider", () => {
	const FIELDS = {
		baseUrl: "https://lm.example.test",
		apiUser: "alice",
		apiKey: "k-12345",
	};

	it("registers under newsletter domain", () => {
		registerListmonkProvider();
		expect(getProvider("newsletter", "listmonk")?.label).toBe("Listmonk");
	});

	it("buildListmonkAuthHeader produces a valid Basic header", () => {
		const header = buildListmonkAuthHeader({
			apiUser: "user",
			apiKey: "pass",
		});
		expect(header).toBe(`Basic ${btoa("user:pass")}`);
	});

	it("verify hits /api/health with HEAD + Basic auth", async () => {
		const calls: Array<{ method?: string; auth?: string | null }> = [];
		const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === "string" ? input : input.toString();
			expect(url.endsWith("/api/health")).toBe(true);
			calls.push({
				method: init?.method,
				auth: new Headers(init?.headers).get("authorization"),
			});
			return new Response("", { status: 200 });
		}) as typeof fetch;
		const ctrl = new AbortController();
		await verifyListmonkConnection(FIELDS, ctrl.signal, { fetchImpl });
		expect(calls[0]?.method).toBe("HEAD");
		expect(calls[0]?.auth).toBe(buildListmonkAuthHeader(FIELDS));
	});

	it("verify maps 401 to INTEGRATION_AUTH_REJECTED", async () => {
		const fetchImpl = fakeFetch([{ status: 401 }]);
		try {
			await verifyListmonkConnection(FIELDS, new AbortController().signal, {
				fetchImpl,
			});
			throw new Error("expected throw");
		} catch (err) {
			expect((err as { code: string }).code).toBe("INTEGRATION_AUTH_REJECTED");
		}
	});

	it("verify maps 500 to INTEGRATION_VERIFY_FAILED", async () => {
		const fetchImpl = fakeFetch([{ status: 500 }]);
		try {
			await verifyListmonkConnection(FIELDS, new AbortController().signal, {
				fetchImpl,
			});
			throw new Error("expected throw");
		} catch (err) {
			expect((err as { code: string }).code).toBe("INTEGRATION_VERIFY_FAILED");
		}
	});

	it("registerListmonkProvider is idempotent", () => {
		const first = registerListmonkProvider();
		const second = registerListmonkProvider();
		expect(second).toBe(first);
	});
});

describe("Plausible provider", () => {
	const FIELDS = {
		apiKey: "tok-abc",
		siteId: "example.com",
		host: "https://plausible.io",
	};

	it("registers under analytics domain", () => {
		registerPlausibleProvider();
		expect(getProvider("analytics", "plausible")?.label).toBe("Plausible");
	});

	it("verify hits /api/v1/sites/<siteId> with bearer auth", async () => {
		const calls: string[] = [];
		const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === "string" ? input : input.toString();
			calls.push(url);
			expect(new Headers(init?.headers).get("authorization")).toBe(
				`Bearer ${FIELDS.apiKey}`,
			);
			return new Response("", { status: 200 });
		}) as typeof fetch;
		await verifyPlausibleConnection(FIELDS, new AbortController().signal, {
			fetchImpl,
		});
		expect(calls[0]).toContain("/api/v1/sites/example.com");
	});

	it("verify maps 403 to INTEGRATION_AUTH_REJECTED", async () => {
		const fetchImpl = fakeFetch([{ status: 403 }]);
		try {
			await verifyPlausibleConnection(FIELDS, new AbortController().signal, {
				fetchImpl,
			});
			throw new Error("expected throw");
		} catch (err) {
			expect((err as { code: string }).code).toBe("INTEGRATION_AUTH_REJECTED");
		}
	});

	it("verify maps 502 to INTEGRATION_VERIFY_FAILED", async () => {
		const fetchImpl = fakeFetch([{ status: 502 }]);
		try {
			await verifyPlausibleConnection(FIELDS, new AbortController().signal, {
				fetchImpl,
			});
			throw new Error("expected throw");
		} catch (err) {
			expect((err as { code: string }).code).toBe("INTEGRATION_VERIFY_FAILED");
		}
	});

	it("encodes the siteId in the URL", async () => {
		let captured = "";
		const fetchImpl = (async (input: RequestInfo | URL) => {
			captured = typeof input === "string" ? input : input.toString();
			return new Response("", { status: 200 });
		}) as typeof fetch;
		await verifyPlausibleConnection(
			{ ...FIELDS, siteId: "site with space" },
			new AbortController().signal,
			{ fetchImpl },
		);
		expect(captured).toContain("site%20with%20space");
	});
});

describe("Cloudflare CDN provider", () => {
	const FIELDS = {
		apiToken: "cfTokenXXXXXXXXXXXXXXXX",
		zoneId: "zone-1",
	};

	it("registers under cdn-purge domain", () => {
		registerCloudflareCdnProvider();
		expect(getProvider("cdn-purge", "cloudflare")?.label).toBe("Cloudflare");
	});

	it("verify probes both tokens/verify and zones/<id>", async () => {
		const calls: string[] = [];
		const fetchImpl = (async (input: RequestInfo | URL) => {
			calls.push(typeof input === "string" ? input : input.toString());
			return new Response("", { status: 200 });
		}) as typeof fetch;
		await verifyCloudflareCdnConnection(FIELDS, new AbortController().signal, {
			fetchImpl,
		});
		expect(calls).toHaveLength(2);
		expect(calls[0]).toContain("/client/v4/user/tokens/verify");
		expect(calls[1]).toContain(`/client/v4/zones/${FIELDS.zoneId}`);
	});

	it("verify maps token-401 to INTEGRATION_AUTH_REJECTED", async () => {
		const fetchImpl = fakeFetch([{ status: 401 }]);
		try {
			await verifyCloudflareCdnConnection(
				FIELDS,
				new AbortController().signal,
				{ fetchImpl },
			);
			throw new Error("expected throw");
		} catch (err) {
			expect((err as { code: string }).code).toBe("INTEGRATION_AUTH_REJECTED");
		}
	});

	it("verify maps zone-403 to INTEGRATION_AUTH_REJECTED", async () => {
		const fetchImpl = fakeFetch([{ status: 200 }, { status: 403 }]);
		try {
			await verifyCloudflareCdnConnection(
				FIELDS,
				new AbortController().signal,
				{ fetchImpl },
			);
			throw new Error("expected throw");
		} catch (err) {
			expect((err as { code: string }).code).toBe("INTEGRATION_AUTH_REJECTED");
		}
	});

	it("verify maps zone-503 to INTEGRATION_VERIFY_FAILED", async () => {
		const fetchImpl = fakeFetch([{ status: 200 }, { status: 503 }]);
		try {
			await verifyCloudflareCdnConnection(
				FIELDS,
				new AbortController().signal,
				{ fetchImpl },
			);
			throw new Error("expected throw");
		} catch (err) {
			expect((err as { code: string }).code).toBe("INTEGRATION_VERIFY_FAILED");
		}
	});
});

describe("GitHub deploy provider", () => {
	const FIELDS = {
		accessToken: "ghpATokenXXXXXXXXXXXXXXX",
	};

	it("registers under deploy-hooks domain", () => {
		registerGithubDeployProvider();
		expect(getProvider("deploy-hooks", "github")?.label).toBe("GitHub");
	});

	it("verify hits /user with bearer auth + GitHub headers", async () => {
		let captured: { url: string; headers: Headers } | null = null;
		const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
			captured = {
				url: typeof input === "string" ? input : input.toString(),
				headers: new Headers(init?.headers),
			};
			return new Response("{}", { status: 200 });
		}) as typeof fetch;
		await verifyGithubDeployConnection(FIELDS, new AbortController().signal, {
			fetchImpl,
		});
		expect(captured).not.toBeNull();
		const c = captured as unknown as { url: string; headers: Headers };
		expect(c.url).toContain("/user");
		expect(c.headers.get("authorization")).toBe(`Bearer ${FIELDS.accessToken}`);
		expect(c.headers.get("x-github-api-version")).toBe("2022-11-28");
	});

	it("verify maps 401 to INTEGRATION_AUTH_REJECTED", async () => {
		const fetchImpl = fakeFetch([{ status: 401 }]);
		try {
			await verifyGithubDeployConnection(FIELDS, new AbortController().signal, {
				fetchImpl,
			});
			throw new Error("expected throw");
		} catch (err) {
			expect((err as { code: string }).code).toBe("INTEGRATION_AUTH_REJECTED");
		}
	});

	it("verify maps 500 to INTEGRATION_VERIFY_FAILED", async () => {
		const fetchImpl = fakeFetch([{ status: 500 }]);
		try {
			await verifyGithubDeployConnection(FIELDS, new AbortController().signal, {
				fetchImpl,
			});
			throw new Error("expected throw");
		} catch (err) {
			expect((err as { code: string }).code).toBe("INTEGRATION_VERIFY_FAILED");
		}
	});
});
