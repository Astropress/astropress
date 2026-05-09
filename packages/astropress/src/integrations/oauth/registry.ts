/**
 * In-memory registry of OAuth provider definitions. Phase 6 of
 * integration-honesty.
 *
 * Each registered provider declares the static endpoints + scope set
 * needed to start an authorization-code flow. Client credentials are
 * NOT held in the registry — they live in the running process's env
 * (per-deploy, never sealed) so the registry stays cheap to enumerate
 * and is safe to serialise into the admin UI's "available providers"
 * picker.
 *
 * The actual access/refresh tokens that come back from the IdP are
 * sealed via the Phase 2 envelope into `integration_secrets`, just
 * like Phase 4's bearer-token providers.
 *
 * Domain-pairing: every OAuth provider belongs to a single
 * `IntegrationDomain` (e.g. `"deploy-hooks"` for the GitHub deploy
 * provider) so the same `connected_integrations` row can describe
 * either a bearer-token or an OAuth-token connection. Callers route
 * by `(domain, providerId)` exactly as they do for non-OAuth
 * providers.
 */

import type { IntegrationDomain } from "../registry.js";

export interface OAuthProviderDefinition {
	readonly id: string;
	readonly domain: IntegrationDomain;
	readonly label: string;
	readonly authorizationUrl: string;
	readonly tokenUrl: string;
	readonly scopes: readonly string[];
	readonly clientIdEnv: string;
	readonly clientSecretEnv: string;
	/** Path the IdP should redirect to. Combined with the request origin at start time. */
	readonly redirectPath: string;
}

export class OAuthRegistryError extends Error {
	constructor(
		public readonly code: "DUPLICATE_PROVIDER" | "UNKNOWN_PROVIDER",
		message: string,
	) {
		super(message);
		this.name = "OAuthRegistryError";
	}
}

const registry = new Map<string, OAuthProviderDefinition>();

function key(domain: IntegrationDomain, providerId: string): string {
	return `${domain}|${providerId}`;
}

export function registerOAuthProvider(def: OAuthProviderDefinition): OAuthProviderDefinition {
	const k = key(def.domain, def.id);
	if (registry.has(k)) {
		throw new OAuthRegistryError(
			"DUPLICATE_PROVIDER",
			`OAuth provider ${def.id} already registered for domain ${def.domain}`,
		);
	}
	registry.set(k, def);
	return def;
}

export function getOAuthProvider(
	domain: IntegrationDomain,
	providerId: string,
): OAuthProviderDefinition | undefined {
	return registry.get(key(domain, providerId));
}

export function listOAuthProviders(domain: IntegrationDomain): readonly OAuthProviderDefinition[] {
	const out: OAuthProviderDefinition[] = [];
	for (const [k, v] of registry) {
		if (k.startsWith(`${domain}|`)) out.push(v);
	}
	return out;
}

export function _resetOAuthRegistryForTests(): void {
	registry.clear();
}
