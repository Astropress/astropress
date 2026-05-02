import { afterEach, describe, expect, it } from "vitest";

import {
	type OAuthProviderDefinition,
	_resetOAuthRegistryForTests,
} from "../../../src/integrations/oauth/registry";
import {
	buildAuthorizeRedirect,
	buildRedirectUri,
} from "../../../src/integrations/oauth/start";
import { verifyOAuthState } from "../../../src/integrations/oauth/state";

const GITHUB: OAuthProviderDefinition = {
	id: "github",
	domain: "deploy-hooks",
	label: "GitHub",
	authorizationUrl: "https://github.com/login/oauth/authorize",
	tokenUrl: "https://github.com/login/oauth/access_token",
	scopes: ["repo:status", "read:org"],
	clientIdEnv: "GITHUB_OAUTH_CLIENT_ID",
	clientSecretEnv: "GITHUB_OAUTH_CLIENT_SECRET",
	redirectPath: "/ap-admin/oauth/callback/github",
};

const NOW = 1_700_000_000_000;
const ROOT = "test-root-secret";

describe("buildRedirectUri", () => {
	it("joins origin and path with one slash", () => {
		expect(buildRedirectUri("https://x.example", "/cb")).toBe(
			"https://x.example/cb",
		);
	});

	it("trims trailing slashes from the origin", () => {
		expect(buildRedirectUri("https://x.example///", "/cb")).toBe(
			"https://x.example/cb",
		);
	});

	it("prepends a slash when the path is missing one", () => {
		expect(buildRedirectUri("https://x.example", "cb")).toBe(
			"https://x.example/cb",
		);
	});

	it("preserves the exact path beyond the leading slash", () => {
		expect(
			buildRedirectUri("https://x.example", "/ap-admin/oauth/callback/github"),
		).toBe("https://x.example/ap-admin/oauth/callback/github");
	});

	it("returns just the prefixed path when origin is empty", () => {
		// kills end > 0 → end >= 0 / true mutants: distinguishes the
		// terminating end===0 case from the always-loop variants.
		expect(buildRedirectUri("", "/cb")).toBe("/cb");
	});

	it("returns just the prefixed path when origin is only slashes", () => {
		expect(buildRedirectUri("///", "/cb")).toBe("/cb");
	});
});

describe("buildAuthorizeRedirect", () => {
	afterEach(() => _resetOAuthRegistryForTests());

	it("returns a URL on the provider's authorize host with the expected query keys", async () => {
		const { redirectUrl } = await buildAuthorizeRedirect({
			provider: GITHUB,
			origin: "https://my.example",
			clientId: "abc123",
			returnTo: "/ap-admin/deploy-hooks",
			rootSecret: ROOT,
			nowMs: NOW,
		});
		const url = new URL(redirectUrl);
		expect(url.origin).toBe("https://github.com");
		expect(url.pathname).toBe("/login/oauth/authorize");
		expect(url.searchParams.get("client_id")).toBe("abc123");
		expect(url.searchParams.get("redirect_uri")).toBe(
			"https://my.example/ap-admin/oauth/callback/github",
		);
		expect(url.searchParams.get("response_type")).toBe("code");
		expect(url.searchParams.get("scope")).toBe("repo:status read:org");
		expect(url.searchParams.get("state")).toBeTruthy();
	});

	it("the issued state verifies under the same rootSecret + provider context", async () => {
		const { state } = await buildAuthorizeRedirect({
			provider: GITHUB,
			origin: "https://my.example",
			clientId: "abc123",
			returnTo: "/ap-admin/deploy-hooks",
			rootSecret: ROOT,
			nowMs: NOW,
		});
		const verified = await verifyOAuthState({
			token: state.token,
			rootSecret: ROOT,
			nowMs: NOW + 1000,
			expectedContext: {
				domain: GITHUB.domain,
				providerId: GITHUB.id,
				returnTo: "/ap-admin/deploy-hooks",
			},
		});
		expect(verified.ok).toBe(true);
	});

	it("does not verify under a different rootSecret", async () => {
		const { state } = await buildAuthorizeRedirect({
			provider: GITHUB,
			origin: "https://my.example",
			clientId: "abc123",
			returnTo: "/ap-admin/deploy-hooks",
			rootSecret: ROOT,
			nowMs: NOW,
		});
		const verified = await verifyOAuthState({
			token: state.token,
			rootSecret: "different-root",
			nowMs: NOW + 1000,
		});
		expect(verified.ok).toBe(false);
	});

	it("space-joins multiple scopes into the scope query parameter", async () => {
		const { redirectUrl } = await buildAuthorizeRedirect({
			provider: { ...GITHUB, scopes: ["a", "b", "c"] },
			origin: "https://my.example",
			clientId: "abc123",
			returnTo: "/x",
			rootSecret: ROOT,
			nowMs: NOW,
		});
		expect(new URL(redirectUrl).searchParams.get("scope")).toBe("a b c");
	});

	it("allows ttlMs to be plumbed through to the state issuer", async () => {
		const { state } = await buildAuthorizeRedirect({
			provider: GITHUB,
			origin: "https://my.example",
			clientId: "abc123",
			returnTo: "/x",
			rootSecret: ROOT,
			nowMs: NOW,
			ttlMs: 60_000,
		});
		expect(state.expiresAt).toBe(NOW + 60_000);
	});
});
