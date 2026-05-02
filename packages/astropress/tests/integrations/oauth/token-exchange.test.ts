import { describe, expect, it } from "vitest";

import { exchangeCodeForToken } from "../../../src/integrations/oauth/token-exchange";

const ARGS_BASE = {
	tokenUrl: "https://github.example/login/oauth/access_token",
	clientId: "cid",
	clientSecret: "csecret",
	code: "auth-code",
	redirectUri: "https://my.example/cb",
};

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("exchangeCodeForToken — happy path", () => {
	it("returns ok with the parsed token set on a 200", async () => {
		const fetchImpl = async () =>
			jsonResponse({
				access_token: "ghu_xxx",
				token_type: "bearer",
				refresh_token: "rt_yyy",
				expires_in: 28800,
				scope: "repo:status",
			});
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r).toEqual({
			ok: true,
			tokens: {
				accessToken: "ghu_xxx",
				tokenType: "bearer",
				refreshToken: "rt_yyy",
				expiresIn: 28800,
				scope: "repo:status",
			},
		});
	});

	it("defaults tokenType to 'bearer' when the IdP omits token_type", async () => {
		const fetchImpl = async () => jsonResponse({ access_token: "x" });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.tokens.tokenType).toBe("bearer");
	});

	it("omits refreshToken when the IdP doesn't return one", async () => {
		const fetchImpl = async () => jsonResponse({ access_token: "x" });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.tokens.refreshToken).toBeUndefined();
	});

	it("omits expiresIn when expires_in is not a finite number", async () => {
		const fetchImpl = async () =>
			jsonResponse({ access_token: "x", expires_in: "30" });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.tokens.expiresIn).toBeUndefined();
	});
});

describe("exchangeCodeForToken — payload encoding", () => {
	it("posts application/x-www-form-urlencoded with the OAuth 2.0 fields", async () => {
		let captured = { url: "", body: "", contentType: "" };
		const fetchImpl = async (
			url: string | URL | Request,
			init?: RequestInit,
		) => {
			captured = {
				url: String(url),
				body: String(init?.body ?? ""),
				contentType:
					(init?.headers as Record<string, string>)["Content-Type"] ?? "",
			};
			return jsonResponse({ access_token: "x" });
		};
		await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(captured.url).toBe(ARGS_BASE.tokenUrl);
		expect(captured.contentType).toBe("application/x-www-form-urlencoded");
		const params = new URLSearchParams(captured.body);
		expect(params.get("grant_type")).toBe("authorization_code");
		expect(params.get("code")).toBe(ARGS_BASE.code);
		expect(params.get("redirect_uri")).toBe(ARGS_BASE.redirectUri);
		expect(params.get("client_id")).toBe(ARGS_BASE.clientId);
		expect(params.get("client_secret")).toBe(ARGS_BASE.clientSecret);
	});
});

describe("exchangeCodeForToken — error branches", () => {
	it("returns TOKEN_HTTP_ERROR with status on a non-2xx response", async () => {
		const fetchImpl = async () => new Response("bad creds", { status: 401 });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r).toEqual({ ok: false, code: "TOKEN_HTTP_ERROR", status: 401 });
	});

	it("returns TOKEN_NETWORK_ERROR when fetch throws", async () => {
		const fetchImpl = async () => {
			throw new Error("ECONNREFUSED");
		};
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r).toEqual({ ok: false, code: "TOKEN_NETWORK_ERROR" });
	});

	it("returns TOKEN_MALFORMED when the body is not valid JSON", async () => {
		const fetchImpl = async () =>
			new Response("not-json", {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r).toEqual({ ok: false, code: "TOKEN_MALFORMED" });
	});

	it("returns TOKEN_MALFORMED when access_token is missing", async () => {
		const fetchImpl = async () => jsonResponse({ token_type: "bearer" });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r).toEqual({ ok: false, code: "TOKEN_MALFORMED" });
	});

	it("returns TOKEN_MALFORMED when access_token is an empty string", async () => {
		const fetchImpl = async () => jsonResponse({ access_token: "" });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r).toEqual({ ok: false, code: "TOKEN_MALFORMED" });
	});

	it("returns TOKEN_MALFORMED when the JSON body is null", async () => {
		const fetchImpl = async () => jsonResponse(null);
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r).toEqual({ ok: false, code: "TOKEN_MALFORMED" });
	});
});
