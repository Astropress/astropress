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
		let captured = {
			url: "",
			method: "",
			body: "",
			contentType: "",
			accept: "",
		};
		const fetchImpl = async (
			url: string | URL | Request,
			init?: RequestInit,
		) => {
			const headers = (init?.headers ?? {}) as Record<string, string>;
			captured = {
				url: String(url),
				method: init?.method ?? "",
				body: String(init?.body ?? ""),
				contentType: headers["Content-Type"] ?? "",
				accept: headers.Accept ?? "",
			};
			return jsonResponse({ access_token: "x" });
		};
		await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(captured.url).toBe(ARGS_BASE.tokenUrl);
		expect(captured.method).toBe("POST");
		expect(captured.contentType).toBe("application/x-www-form-urlencoded");
		expect(captured.accept).toBe("application/json");
		const params = new URLSearchParams(captured.body);
		expect(params.get("grant_type")).toBe("authorization_code");
		expect(params.get("code")).toBe(ARGS_BASE.code);
		expect(params.get("redirect_uri")).toBe(ARGS_BASE.redirectUri);
		expect(params.get("client_id")).toBe(ARGS_BASE.clientId);
		expect(params.get("client_secret")).toBe(ARGS_BASE.clientSecret);
	});
});

describe("exchangeCodeForToken — token field coercion", () => {
	it("returns TOKEN_MALFORMED when the JSON body is a non-null primitive", async () => {
		// kills `typeof raw !== 'object' || raw === null` mutated to `false`:
		// a non-object value would otherwise be cast and access access_token.
		const fetchImpl = async () => jsonResponse(42);
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r).toEqual({ ok: false, code: "TOKEN_MALFORMED" });
	});

	it("preserves a non-bearer token_type verbatim", async () => {
		const fetchImpl = async () =>
			jsonResponse({ access_token: "x", token_type: "mac" });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.tokens.tokenType).toBe("mac");
	});

	it("defaults tokenType to 'bearer' when token_type is an empty string", async () => {
		const fetchImpl = async () =>
			jsonResponse({ access_token: "x", token_type: "" });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.tokens.tokenType).toBe("bearer");
	});

	it("defaults tokenType to 'bearer' when token_type is a non-string", async () => {
		const fetchImpl = async () =>
			jsonResponse({ access_token: "x", token_type: 7 });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.tokens.tokenType).toBe("bearer");
	});

	it("omits refreshToken when refresh_token is an empty string", async () => {
		const fetchImpl = async () =>
			jsonResponse({ access_token: "x", refresh_token: "" });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.tokens.refreshToken).toBeUndefined();
	});

	it("omits refreshToken when refresh_token is a non-string", async () => {
		const fetchImpl = async () =>
			jsonResponse({ access_token: "x", refresh_token: 12 });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.tokens.refreshToken).toBeUndefined();
	});

	it("omits expiresIn when expires_in is NaN", async () => {
		const fetchImpl = async () =>
			jsonResponse({ access_token: "x", expires_in: Number.NaN });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.tokens.expiresIn).toBeUndefined();
	});

	it("omits expiresIn when expires_in is Infinity", async () => {
		const fetchImpl = async () =>
			jsonResponse({ access_token: "x", expires_in: Number.POSITIVE_INFINITY });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.tokens.expiresIn).toBeUndefined();
	});

	it("omits scope when scope is a non-string", async () => {
		const fetchImpl = async () => jsonResponse({ access_token: "x", scope: 1 });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.tokens.scope).toBeUndefined();
	});

	it("preserves an empty scope string", async () => {
		const fetchImpl = async () =>
			jsonResponse({ access_token: "x", scope: "" });
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.tokens.scope).toBe("");
	});

	it("returns TOKEN_MALFORMED when response.json() throws on a 2xx", async () => {
		// kills `} catch { return TOKEN_MALFORMED }` block-replaced with {}:
		// without the catch, an unhandled rejection would surface here.
		const bodyStream = new ReadableStream<Uint8Array>({
			start(c) {
				c.enqueue(new TextEncoder().encode("{not-json"));
				c.close();
			},
		});
		const fetchImpl = async () =>
			new Response(bodyStream, {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		const r = await exchangeCodeForToken({ ...ARGS_BASE, fetch: fetchImpl });
		expect(r).toEqual({ ok: false, code: "TOKEN_MALFORMED" });
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
