/**
 * Security-critical tests for the OAuth callback persistence half.
 *
 * Two layers are exercised here:
 *
 *   1. {@link sealOAuthCallbackTokens} as a unit — driven against an
 *      in-memory SQLite IntegrationsRepository (the same one production
 *      uses for the local-store path). These tests prove that on the
 *      happy path the *exact* token field set lands in
 *      `integration_secrets` under the verified `(domain, provider)`
 *      context, and that on every failure path no token byte escapes
 *      the helper.
 *
 *   2. The Astro APIRoute `GET` at
 *      `pages/ap-admin/oauth/callback/[provider].ts` driven through a
 *      mocked `loadLocalAdminStore` + mocked `fetch` so we can assert
 *      the route as a whole — including the redirect — never embeds
 *      a token in the response.
 *
 * These tests are deliberately verbose: each negative path is a
 * separate `it` block so a future regression that, say, starts echoing
 * the structured error code with `result.tokens.accessToken`
 * concatenated will be reported as exactly one targeted failure.
 *
 * Plaintext-leak invariants — repeated across every negative-path
 * test — are the core security guarantee. The CANARY strings are
 * wired through `OAuthTokenSet` so a single grep over the response
 * body / redirect URL is sufficient to detect leakage of *any*
 * token field.
 */

import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` is hoisted to the top of the module, so any state it
// captures must come from `vi.hoisted` — that runs first.
const mockState = vi.hoisted(() => ({
	store: { integrations: undefined } as {
		integrations:
			| import("../../../src/sqlite-runtime/integrations").IntegrationsRepository
			| undefined;
	},
}));
vi.mock("../../../src/local-runtime-modules", () => ({
	loadLocalAdminStore: async () => mockState.store,
}));
vi.mock("../../../src/local-runtime-modules.js", () => ({
	loadLocalAdminStore: async () => mockState.store,
}));

import { issueOAuthState } from "../../../index";
// Imported after the mock so the route's transitive imports of
// `local-runtime-modules` resolve to our hoisted stub.
import { GET } from "../../../pages/ap-admin/oauth/callback/[provider].js";
import {
	_resetOAuthRegistryForTests,
	type OAuthProviderDefinition,
	registerOAuthProvider,
} from "../../../src/integrations/oauth/registry";
import {
	type SealOAuthCallbackResult,
	sealOAuthCallbackTokens,
	tokensToSecretFields,
} from "../../../src/integrations/oauth/seal-callback";
import type { OAuthTokenSet } from "../../../src/integrations/oauth/token-exchange";
import {
	createIntegrationsRepository,
	type IntegrationsRepository,
} from "../../../src/sqlite-runtime/integrations";
import { makeDb } from "../../helpers/make-db.js";
import { SqliteBackedD1Database } from "../../helpers/provider-test-fixtures.js";

// -----------------------------------------------------------------------------
// CANARIES — every leak assertion below scans for these literals. Keep them
// distinctive so a future grep-based regression check can find them too.
// -----------------------------------------------------------------------------
const CANARY_ACCESS = "CANARY-access-9f3a2d1c";
const CANARY_REFRESH = "CANARY-refresh-7b8e4f6a";
const CANARY_SCOPE = "CANARY-scope-read:write";
const ROOT = "test-root-current";
const PREV_ROOT = "test-root-previous";
const NOW = "2026-05-18T12:00:00.000Z";
const DOMAIN = "newsletter";
const PROVIDER_ID = "listmonk";

const TOKENS: OAuthTokenSet = {
	accessToken: CANARY_ACCESS,
	tokenType: "Bearer",
	refreshToken: CANARY_REFRESH,
	expiresIn: 3600,
	scope: CANARY_SCOPE,
};

function assertNoTokenLeak(haystack: string): void {
	expect(haystack).not.toContain(CANARY_ACCESS);
	expect(haystack).not.toContain(CANARY_REFRESH);
	expect(haystack).not.toContain(CANARY_SCOPE);
}

const REGISTERED_PROVIDER: OAuthProviderDefinition = {
	id: PROVIDER_ID,
	domain: DOMAIN,
	label: "Listmonk OAuth",
	authorizationUrl: "https://idp.example.test/authorize",
	tokenUrl: "https://idp.example.test/token",
	scopes: ["read:subs"],
	clientIdEnv: "LISTMONK_OAUTH_CLIENT_ID",
	clientSecretEnv: "LISTMONK_OAUTH_CLIENT_SECRET",
	redirectPath: "/ap-admin/oauth/callback/listmonk",
};

let db: DatabaseSync;
let repo: IntegrationsRepository;

beforeEach(() => {
	db = makeDb();
	db.exec("PRAGMA foreign_keys = ON");
	repo = createIntegrationsRepository({
		getDb: () => db as never,
		now: () => NOW,
	});
	mockState.store = { integrations: repo };
	_resetOAuthRegistryForTests();
	registerOAuthProvider(REGISTERED_PROVIDER);
});

afterEach(() => {
	_resetOAuthRegistryForTests();
	vi.unstubAllGlobals();
});

// -----------------------------------------------------------------------------
// Layer 1: helper-level tests
// -----------------------------------------------------------------------------

describe("tokensToSecretFields", () => {
	it("projects every OAuthTokenSet field that is present", () => {
		expect(tokensToSecretFields(TOKENS)).toEqual({
			accessToken: CANARY_ACCESS,
			tokenType: "Bearer",
			refreshToken: CANARY_REFRESH,
			expiresIn: "3600",
			scope: CANARY_SCOPE,
		});
	});

	it("omits optional fields when absent (no 'undefined' literal sealed)", () => {
		const fields = tokensToSecretFields({
			accessToken: CANARY_ACCESS,
			tokenType: "Bearer",
		});
		expect(fields).toEqual({ accessToken: CANARY_ACCESS, tokenType: "Bearer" });
		expect("refreshToken" in fields).toBe(false);
		expect("expiresIn" in fields).toBe(false);
		expect("scope" in fields).toBe(false);
	});

	it("stringifies expiresIn so the secret store sees Record<string,string>", () => {
		const fields = tokensToSecretFields({
			accessToken: CANARY_ACCESS,
			tokenType: "Bearer",
			expiresIn: 0,
		});
		// Even the falsy 0 must be preserved as "0" — a regression that drops
		// expiresIn when it equals zero would silently lose expiry telemetry.
		expect(fields.expiresIn).toBe("0");
	});
});

describe("sealOAuthCallbackTokens — helper-level success", () => {
	it("persists a sealed row that round-trips to the exact token field set", async () => {
		const result = await sealOAuthCallbackTokens(undefined, {
			domain: DOMAIN,
			provider: PROVIDER_ID,
			tokens: TOKENS,
			rootSecret: ROOT,
			now: NOW,
		});
		expect(result).toEqual({ ok: true });

		const opened = await repo.findSecret(DOMAIN, PROVIDER_ID, { current: ROOT });
		expect(opened).toEqual({
			accessToken: CANARY_ACCESS,
			tokenType: "Bearer",
			refreshToken: CANARY_REFRESH,
			expiresIn: "3600",
			scope: CANARY_SCOPE,
		});

		const status = repo.findStatus(DOMAIN, PROVIDER_ID);
		expect(status).toMatchObject({
			domain: DOMAIN,
			provider: PROVIDER_ID,
			status: "connected",
			connectedAt: NOW,
			// configJson must be the literal "{}" — the row is OAuth-managed
			// and has no per-host provider config; a regression that wrote
			// e.g. "" would still be valid JSON-ish but break the runtime
			// JSON.parse path on read.
			configJson: "{}",
		});
	});

	it("never writes the plaintext access token into any column", async () => {
		await sealOAuthCallbackTokens(undefined, {
			domain: DOMAIN,
			provider: PROVIDER_ID,
			tokens: TOKENS,
			rootSecret: ROOT,
			now: NOW,
		});
		const allRows = [
			...(db.prepare("SELECT * FROM connected_integrations").all() as Record<string, unknown>[]),
			...(db.prepare("SELECT * FROM integration_secrets").all() as Record<string, unknown>[]),
		];
		assertNoTokenLeak(JSON.stringify(allRows));
	});

	it("rotation: a row sealed under PREV_ROOT is opened and resealed under ROOT", async () => {
		// 1. Seal under PREV_ROOT, then flip the row's kid to mimic a
		//    pre-rotation record — matches integrations-repository.test
		//    rotation pattern.
		await sealOAuthCallbackTokens(undefined, {
			domain: DOMAIN,
			provider: PROVIDER_ID,
			tokens: TOKENS,
			rootSecret: PREV_ROOT,
			now: NOW,
		});
		db.prepare("UPDATE integration_secrets SET kid='previous' WHERE domain=? AND provider=?").run(
			DOMAIN,
			PROVIDER_ID,
		);

		// 2. findSecret with {current: ROOT, previous: PREV_ROOT}: the
		//    "previous" candidate decrypts and reseal-on-read upgrades.
		const opened = await repo.findSecret(DOMAIN, PROVIDER_ID, {
			current: ROOT,
			previous: PREV_ROOT,
		});
		expect(opened).toMatchObject({ accessToken: CANARY_ACCESS });

		const after = db
			.prepare("SELECT kid FROM integration_secrets WHERE domain=? AND provider=?")
			.get(DOMAIN, PROVIDER_ID) as { kid: string };
		expect(after.kid).toBe("current");
	});
});

describe("sealOAuthCallbackTokens — failure paths never leak tokens", () => {
	it("returns INTEGRATIONS_NOT_AVAILABLE when the local store has no integrations repo", async () => {
		mockState.store = { integrations: undefined };
		const result = await sealOAuthCallbackTokens(undefined, {
			domain: DOMAIN,
			provider: PROVIDER_ID,
			tokens: TOKENS,
			rootSecret: ROOT,
			now: NOW,
		});
		expect(result).toEqual({ ok: false, code: "INTEGRATIONS_NOT_AVAILABLE" });
		assertNoTokenLeak(JSON.stringify(result));
	});

	it("returns SEAL_FAILED when repo.connect throws, with no token bytes in the result", async () => {
		const throwingRepo: IntegrationsRepository = {
			...repo,
			connect: async () => {
				// Deliberately include the access-token canary in the
				// thrown message — the helper must NOT surface it.
				throw new Error(`db write failed for token=${CANARY_ACCESS}`);
			},
		};
		mockState.store = { integrations: throwingRepo };

		const result: SealOAuthCallbackResult = await sealOAuthCallbackTokens(undefined, {
			domain: DOMAIN,
			provider: PROVIDER_ID,
			tokens: TOKENS,
			rootSecret: ROOT,
			now: NOW,
		});
		expect(result).toEqual({ ok: false, code: "SEAL_FAILED" });
		assertNoTokenLeak(JSON.stringify(result));
	});

	it("D1 path: seal lands in the D1-backed integration_secrets row atomically", async () => {
		// Live D1-shape database (sqlite-backed) so the onD1 branch
		// runs to completion. The batched connect must write both the
		// status row and the sealed-secret row.
		const d1Db = new SqliteBackedD1Database(db);
		const localsWithD1 = { runtime: { env: { DB: d1Db } } } as unknown as App.Locals;
		const result = await sealOAuthCallbackTokens(localsWithD1, {
			domain: DOMAIN,
			provider: PROVIDER_ID,
			tokens: TOKENS,
			rootSecret: ROOT,
			now: NOW,
		});
		expect(result).toEqual({ ok: true });
		// Roundtrip via the sqlite repo (same underlying tables) to
		// confirm the D1 write produced an openable envelope.
		const opened = await repo.findSecret(DOMAIN, PROVIDER_ID, { current: ROOT });
		expect(opened).toMatchObject({ accessToken: CANARY_ACCESS });
		// configJson pin (same invariant as the local-store path):
		// OAuth-managed rows have no provider-supplied config, so the
		// status row must hold the literal "{}". A regression that
		// wrote `""` here would corrupt later JSON.parse reads.
		expect(repo.findStatus(DOMAIN, PROVIDER_ID)?.configJson).toBe("{}");
		assertNoTokenLeak(JSON.stringify(result));
	});

	it("D1 path: SEAL_FAILED when the batch fails — no token bytes in the result", async () => {
		const localsWithD1 = {
			runtime: {
				env: {
					DB: {
						prepare: () => ({
							bind: () => ({
								first: async () => null,
								all: async () => ({ success: true, results: [] }),
								run: async () => {
									throw new Error(`d1 batch failed for token=${CANARY_ACCESS}`);
								},
							}),
						}),
						batch: async () => {
							throw new Error(`d1 batch failed for token=${CANARY_ACCESS}`);
						},
					},
				},
			},
		} as unknown as App.Locals;
		const result = await sealOAuthCallbackTokens(localsWithD1, {
			domain: DOMAIN,
			provider: PROVIDER_ID,
			tokens: TOKENS,
			rootSecret: ROOT,
			now: NOW,
		});
		expect(result).toEqual({ ok: false, code: "SEAL_FAILED" });
		assertNoTokenLeak(JSON.stringify(result));
	});
});

// -----------------------------------------------------------------------------
// Layer 2: end-to-end through the Astro APIRoute GET handler
// -----------------------------------------------------------------------------

function makeLocals(overrides?: Partial<Record<string, string>>): App.Locals {
	return {
		runtime: {
			env: {
				ASTROPRESS_ROOT_SECRET: ROOT,
				LISTMONK_OAUTH_CLIENT_ID: "cid-test",
				LISTMONK_OAUTH_CLIENT_SECRET: "csec-test",
				...overrides,
			},
		},
	} as unknown as App.Locals;
}

async function buildContext(opts: {
	stateToken?: string;
	code?: string;
	providerSlug?: string;
	locals?: App.Locals;
}) {
	const url = new URL(
		`https://host.example.test/ap-admin/oauth/callback/${opts.providerSlug ?? "listmonk"}?code=${
			opts.code ?? "code-abc"
		}&state=${opts.stateToken ?? ""}`,
	);
	const redirects: string[] = [];
	const redirect = (path: string) => {
		redirects.push(path);
		return new Response(null, { status: 302, headers: { Location: path } });
	};
	const context = {
		url,
		params: { provider: opts.providerSlug ?? "listmonk" },
		locals: opts.locals ?? makeLocals(),
		redirect,
	};
	return { context, redirects };
}

function mockTokenExchangeFetch(tokens: OAuthTokenSet | "network-error" | { status: number }) {
	const fetchMock = vi.fn(async () => {
		if (tokens === "network-error") {
			throw new Error("ECONNREFUSED");
		}
		if (typeof tokens === "object" && "status" in tokens) {
			return new Response("err", { status: tokens.status });
		}
		const body: Record<string, unknown> = {
			access_token: tokens.accessToken,
			token_type: tokens.tokenType,
		};
		if (tokens.refreshToken) body.refresh_token = tokens.refreshToken;
		if (tokens.expiresIn !== undefined) body.expires_in = tokens.expiresIn;
		if (tokens.scope) body.scope = tokens.scope;
		return new Response(JSON.stringify(body), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

async function makeValidState(overrides?: { providerId?: string; domain?: string }) {
	const issued = await issueOAuthState({
		context: {
			domain: overrides?.domain ?? DOMAIN,
			providerId: overrides?.providerId ?? PROVIDER_ID,
			returnTo: "/ap-admin/services",
		},
		rootSecret: ROOT,
		nowMs: Date.now(),
	});
	return issued.token;
}

describe("ap-admin/oauth/callback/[provider] GET — security regression suite", () => {
	it("happy path: persists the sealed row and redirects to returnTo with no token in the URL", async () => {
		mockTokenExchangeFetch(TOKENS);
		const state = await makeValidState();
		const { context, redirects } = await buildContext({ stateToken: state });

		const response = await GET(context as never);
		expect(response.status).toBe(302);
		expect(redirects).toHaveLength(1);

		// Redirect target must NOT contain any token field — neither
		// as a query param nor anywhere in the URL.
		assertNoTokenLeak(redirects[0]);
		// The legacy `oauth_pending_seal` query flag must be gone — the
		// issue's acceptance criterion explicitly requires it removed.
		expect(redirects[0]).not.toContain("oauth_pending_seal");
		expect(redirects[0]).toBe("/ap-admin/services");

		// Row in DB matches the token set we mocked back from fetch.
		const opened = await repo.findSecret(DOMAIN, PROVIDER_ID, { current: ROOT });
		expect(opened).toMatchObject({ accessToken: CANARY_ACCESS });
	});

	it("seal failure surfaces 500 with the structured code and zero token bytes in the body", async () => {
		mockState.store = {
			integrations: {
				...repo,
				connect: async () => {
					throw new Error(`db unavailable, token=${CANARY_ACCESS}`);
				},
			},
		};
		mockTokenExchangeFetch(TOKENS);
		const state = await makeValidState();
		const { context } = await buildContext({ stateToken: state });

		const response = await GET(context as never);
		expect(response.status).toBe(500);
		const body = await response.text();
		expect(body).toContain("SEAL_FAILED");
		assertNoTokenLeak(body);
	});

	it("INTEGRATIONS_NOT_AVAILABLE: 500 with code, no token bytes in body, no DB write", async () => {
		mockState.store = { integrations: undefined };
		mockTokenExchangeFetch(TOKENS);
		const state = await makeValidState();
		const { context } = await buildContext({ stateToken: state });

		const response = await GET(context as never);
		expect(response.status).toBe(500);
		const body = await response.text();
		expect(body).toContain("INTEGRATIONS_NOT_AVAILABLE");
		assertNoTokenLeak(body);
		expect(repo.findStatus(DOMAIN, PROVIDER_ID)).toBeUndefined();
	});

	it("state token missing → 400, never invokes fetch", async () => {
		const fetchMock = mockTokenExchangeFetch(TOKENS);
		const { context } = await buildContext({ stateToken: "" });
		const response = await GET(context as never);
		expect(response.status).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
		assertNoTokenLeak(await response.text());
	});

	it("state token forged (bad signature) → 400, never invokes fetch, never seals", async () => {
		const fetchMock = mockTokenExchangeFetch(TOKENS);
		const forged = Buffer.from(
			JSON.stringify({
				n: "abc",
				c: { domain: DOMAIN, providerId: PROVIDER_ID, returnTo: "/x" },
				e: Date.now() + 60_000,
				s: "deadbeef",
			}),
			"utf-8",
		).toString("hex");
		const { context } = await buildContext({ stateToken: forged });
		const response = await GET(context as never);
		expect(response.status).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(repo.findStatus(DOMAIN, PROVIDER_ID)).toBeUndefined();
		assertNoTokenLeak(await response.text());
	});

	it("provider slug mismatch (state says listmonk, URL says github) → 404, never seals", async () => {
		const fetchMock = mockTokenExchangeFetch(TOKENS);
		const state = await makeValidState();
		const { context } = await buildContext({ stateToken: state, providerSlug: "github" });
		const response = await GET(context as never);
		expect(response.status).toBe(404);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(repo.findStatus(DOMAIN, PROVIDER_ID)).toBeUndefined();
		assertNoTokenLeak(await response.text());
	});

	it("missing client credentials → 500, never invokes fetch, never seals", async () => {
		const fetchMock = mockTokenExchangeFetch(TOKENS);
		const state = await makeValidState();
		const localsNoCreds = {
			runtime: { env: { ASTROPRESS_ROOT_SECRET: ROOT } },
		} as unknown as App.Locals;
		const { context } = await buildContext({ stateToken: state, locals: localsNoCreds });
		const response = await GET(context as never);
		expect(response.status).toBe(500);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(repo.findStatus(DOMAIN, PROVIDER_ID)).toBeUndefined();
		assertNoTokenLeak(await response.text());
	});

	it("token-exchange 5xx → 502, never seals (no partial state in DB)", async () => {
		mockTokenExchangeFetch({ status: 502 });
		const state = await makeValidState();
		const { context } = await buildContext({ stateToken: state });
		const response = await GET(context as never);
		expect(response.status).toBe(502);
		expect(repo.findStatus(DOMAIN, PROVIDER_ID)).toBeUndefined();
		assertNoTokenLeak(await response.text());
	});

	it("token-exchange network error → 502, never seals", async () => {
		mockTokenExchangeFetch("network-error");
		const state = await makeValidState();
		const { context } = await buildContext({ stateToken: state });
		const response = await GET(context as never);
		expect(response.status).toBe(502);
		expect(repo.findStatus(DOMAIN, PROVIDER_ID)).toBeUndefined();
		assertNoTokenLeak(await response.text());
	});

	it("after a successful seal, findSecret roundtrips the access token (no plaintext leak path)", async () => {
		mockTokenExchangeFetch(TOKENS);
		const state = await makeValidState();
		const { context } = await buildContext({ stateToken: state });
		await GET(context as never);

		const opened = await repo.findSecret<Record<string, string>>(DOMAIN, PROVIDER_ID, {
			current: ROOT,
		});
		expect(opened?.accessToken).toBe(CANARY_ACCESS);
		expect(opened?.refreshToken).toBe(CANARY_REFRESH);

		// Belt and braces: a raw row scan must not contain any canary
		// even though decryption succeeded.
		const dump = JSON.stringify(
			db.prepare("SELECT * FROM integration_secrets").all() as Record<string, unknown>[],
		);
		assertNoTokenLeak(dump);
	});
});
