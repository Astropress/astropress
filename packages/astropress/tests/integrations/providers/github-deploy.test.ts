import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	GITHUB_DEPLOY_FIELDS,
	GithubDeployVerifyError,
	buildGithubAuthHeader,
	buildGithubUserUrl,
	classifyGithubStatus,
	registerGithubDeploy,
	verifyGithubDeploy,
} from "../../../src/integrations/providers/github-deploy";
import {
	_resetRegistryForTests,
	getProvider,
} from "../../../src/integrations/registry";

interface CapturedCall {
	url: string;
	method: string | undefined;
	authorization: string | null;
	accept: string | null;
	apiVersion: string | null;
	userAgent: string | null;
	signalIs: AbortSignal | undefined;
}

function makeFetchMock(status: number): {
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
			accept: headers.get("accept"),
			apiVersion: headers.get("x-github-api-version"),
			userAgent: headers.get("user-agent"),
			signalIs: init?.signal ?? undefined,
		});
		return new Response(null, { status });
	};
	return { fetch: f, calls };
}

const FIELDS = { accessToken: "ghp_abcdef" };

afterEach(() => {
	_resetRegistryForTests();
});

describe("GITHUB_DEPLOY_FIELDS schema", () => {
	it("accepts a non-empty accessToken", () => {
		expect(GITHUB_DEPLOY_FIELDS.parse(FIELDS)).toEqual(FIELDS);
	});

	it("rejects an empty accessToken", () => {
		expect(GITHUB_DEPLOY_FIELDS.safeParse({ accessToken: "" }).success).toBe(
			false,
		);
	});
});

describe("buildGithubUserUrl", () => {
	it("pins the /user endpoint on api.github.com", () => {
		expect(buildGithubUserUrl()).toBe("https://api.github.com/user");
	});
});

describe("buildGithubAuthHeader", () => {
	it("prefixes the token with 'Bearer '", () => {
		expect(buildGithubAuthHeader("xyz")).toBe("Bearer xyz");
	});

	it("does not mutate or trim whitespace in the token", () => {
		expect(buildGithubAuthHeader("  abc  ")).toBe("Bearer   abc  ");
	});
});

describe("classifyGithubStatus", () => {
	const r = (status: number) => new Response(null, { status });

	it("returns null on 200", () => {
		expect(classifyGithubStatus(r(200))).toBeNull();
	});

	it("returns null on 204", () => {
		expect(classifyGithubStatus(r(204))).toBeNull();
	});

	it("returns AUTH_REJECTED on 401", () => {
		expect(classifyGithubStatus(r(401))).toBe("INTEGRATION_AUTH_REJECTED");
	});

	it("returns AUTH_REJECTED on 403", () => {
		expect(classifyGithubStatus(r(403))).toBe("INTEGRATION_AUTH_REJECTED");
	});

	it("returns RATE_LIMITED on 429", () => {
		expect(classifyGithubStatus(r(429))).toBe("INTEGRATION_RATE_LIMITED");
	});

	it("returns VERIFY_FAILED on 404", () => {
		expect(classifyGithubStatus(r(404))).toBe("INTEGRATION_VERIFY_FAILED");
	});

	it("returns VERIFY_FAILED on 500", () => {
		expect(classifyGithubStatus(r(500))).toBe("INTEGRATION_VERIFY_FAILED");
	});

	it("returns VERIFY_FAILED on 400 (4xx that isn't 401/403/429)", () => {
		expect(classifyGithubStatus(r(400))).toBe("INTEGRATION_VERIFY_FAILED");
	});
});

describe("verifyGithubDeploy", () => {
	let signal: AbortSignal;

	beforeEach(() => {
		signal = new AbortController().signal;
	});

	it("resolves on 200", async () => {
		const { fetch, calls } = makeFetchMock(200);
		await expect(
			verifyGithubDeploy(FIELDS, { signal }, { fetch }),
		).resolves.toBeUndefined();
		expect(calls).toHaveLength(1);
	});

	it("hits /user with GET", async () => {
		const { fetch, calls } = makeFetchMock(200);
		await verifyGithubDeploy(FIELDS, { signal }, { fetch });
		expect(calls[0].url).toBe("https://api.github.com/user");
		expect(calls[0].method).toBe("GET");
	});

	it("attaches Bearer auth header", async () => {
		const { fetch, calls } = makeFetchMock(200);
		await verifyGithubDeploy(FIELDS, { signal }, { fetch });
		expect(calls[0].authorization).toBe("Bearer ghp_abcdef");
	});

	it("attaches the GitHub Accept and API version headers", async () => {
		const { fetch, calls } = makeFetchMock(200);
		await verifyGithubDeploy(FIELDS, { signal }, { fetch });
		expect(calls[0].accept).toBe("application/vnd.github+json");
		expect(calls[0].apiVersion).toBe("2022-11-28");
	});

	it("attaches a User-Agent header (GitHub requires it)", async () => {
		const { fetch, calls } = makeFetchMock(200);
		await verifyGithubDeploy(FIELDS, { signal }, { fetch });
		expect(calls[0].userAgent).toBe("astropress-deploy-hooks");
	});

	it("forwards the AbortSignal", async () => {
		const { fetch, calls } = makeFetchMock(200);
		await verifyGithubDeploy(FIELDS, { signal }, { fetch });
		expect(calls[0].signalIs).toBe(signal);
	});

	it("throws AUTH_REJECTED on 401", async () => {
		const { fetch } = makeFetchMock(401);
		await expect(
			verifyGithubDeploy(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_AUTH_REJECTED" });
	});

	it("throws AUTH_REJECTED on 403", async () => {
		const { fetch } = makeFetchMock(403);
		await expect(
			verifyGithubDeploy(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_AUTH_REJECTED" });
	});

	it("throws RATE_LIMITED on 429", async () => {
		const { fetch } = makeFetchMock(429);
		await expect(
			verifyGithubDeploy(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_RATE_LIMITED" });
	});

	it("throws VERIFY_FAILED on 500", async () => {
		const { fetch } = makeFetchMock(500);
		await expect(
			verifyGithubDeploy(FIELDS, { signal }, { fetch }),
		).rejects.toMatchObject({ code: "INTEGRATION_VERIFY_FAILED" });
	});

	it("GithubDeployVerifyError subclasses Error and carries the typed code", async () => {
		const { fetch } = makeFetchMock(403);
		try {
			await verifyGithubDeploy(FIELDS, { signal }, { fetch });
			throw new Error("expected verify to throw");
		} catch (err) {
			expect(err).toBeInstanceOf(GithubDeployVerifyError);
			expect(err).toBeInstanceOf(Error);
			expect((err as GithubDeployVerifyError).code).toBe(
				"INTEGRATION_AUTH_REJECTED",
			);
		}
	});
});

describe("registerGithubDeploy", () => {
	it("registers under deploy-hooks with id 'github' and label 'GitHub'", () => {
		const entry = registerGithubDeploy();
		expect(entry.domain).toBe("deploy-hooks");
		expect(entry.id).toBe("github");
		expect(entry.label).toBe("GitHub");
		const looked = getProvider("deploy-hooks", "github");
		expect(looked?.label).toBe("GitHub");
	});

	it("registers GITHUB_DEPLOY_FIELDS schema", () => {
		registerGithubDeploy();
		const provider = getProvider("deploy-hooks", "github");
		expect(provider?.fields.safeParse({ accessToken: "" }).success).toBe(false);
	});

	it("wires verifyGithubDeploy so connect-flow gets a callable verify", () => {
		registerGithubDeploy();
		const provider = getProvider("deploy-hooks", "github");
		expect(typeof provider?.verify).toBe("function");
	});

	it("wires defaultErrorCode to AUTH_REJECTED (most common verify failure)", () => {
		registerGithubDeploy();
		const provider = getProvider("deploy-hooks", "github");
		expect(provider?.defaultErrorCode).toBe("INTEGRATION_AUTH_REJECTED");
	});
});
