import { afterEach, describe, expect, it } from "vitest";

import {
	OAuthRegistryError,
	_resetOAuthRegistryForTests,
	getOAuthProvider,
	listOAuthProviders,
	registerOAuthProvider,
} from "../../../src/integrations/oauth/registry";

const GITHUB = {
	id: "github",
	domain: "deploy-hooks" as const,
	label: "GitHub",
	authorizationUrl: "https://github.com/login/oauth/authorize",
	tokenUrl: "https://github.com/login/oauth/access_token",
	scopes: ["repo:status", "read:org"] as const,
	clientIdEnv: "GITHUB_OAUTH_CLIENT_ID",
	clientSecretEnv: "GITHUB_OAUTH_CLIENT_SECRET",
	redirectPath: "/ap-admin/oauth/callback/github",
};

afterEach(() => _resetOAuthRegistryForTests());

describe("registerOAuthProvider", () => {
	it("registers and returns the same definition", () => {
		const r = registerOAuthProvider({ ...GITHUB });
		expect(r).toEqual(GITHUB);
	});

	it("getOAuthProvider returns the registered definition for matching (domain, id)", () => {
		registerOAuthProvider({ ...GITHUB });
		expect(getOAuthProvider("deploy-hooks", "github")).toEqual(GITHUB);
	});

	it("getOAuthProvider returns undefined for the wrong domain even if id matches", () => {
		registerOAuthProvider({ ...GITHUB });
		expect(getOAuthProvider("newsletter", "github")).toBeUndefined();
	});

	it("getOAuthProvider returns undefined for the wrong id even if domain matches", () => {
		registerOAuthProvider({ ...GITHUB });
		expect(getOAuthProvider("deploy-hooks", "gitlab")).toBeUndefined();
	});

	it("rejects duplicate (domain, id) pairs with DUPLICATE_PROVIDER", () => {
		registerOAuthProvider({ ...GITHUB });
		let caught: unknown;
		try {
			registerOAuthProvider({ ...GITHUB });
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(OAuthRegistryError);
		const err = caught as OAuthRegistryError;
		expect(err.name).toBe("OAuthRegistryError");
		expect(err.code).toBe("DUPLICATE_PROVIDER");
		expect(err.message).toContain("github");
		expect(err.message).toContain("deploy-hooks");
		expect(err.message).toContain("already registered");
	});

	it("allows the same providerId across different domains", () => {
		registerOAuthProvider({ ...GITHUB });
		expect(() =>
			registerOAuthProvider({ ...GITHUB, domain: "newsletter" }),
		).not.toThrow();
	});

	it("listOAuthProviders is domain-scoped", () => {
		registerOAuthProvider({ ...GITHUB });
		registerOAuthProvider({ ...GITHUB, id: "gitlab" });
		registerOAuthProvider({ ...GITHUB, domain: "newsletter", id: "mailchimp" });
		const deploy = listOAuthProviders("deploy-hooks");
		expect(deploy.map((p) => p.id).sort()).toEqual(["github", "gitlab"]);
		const newsletter = listOAuthProviders("newsletter");
		expect(newsletter.map((p) => p.id)).toEqual(["mailchimp"]);
	});

	it("listOAuthProviders returns an empty array for an unregistered domain", () => {
		expect(listOAuthProviders("analytics")).toEqual([]);
	});
});
