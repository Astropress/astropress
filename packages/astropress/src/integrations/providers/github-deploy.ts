/**
 * GitHub OAuth provider for the deploy-hooks domain.
 *
 * Phase 6 wires GitHub through the OAuth state-token issuance and
 * callback flow. The provider keeps the connect path symmetrical
 * with the static-API-token providers (Listmonk, Plausible, etc.):
 *
 *   - The connect screen redirects to GitHub via the OAuth start
 *     route (state + scopes).
 *   - On callback, the access token (and optional refresh token if
 *     present — GitHub rarely issues one) is sealed via the Phase 2
 *     envelope under `(domain="deploy-hooks", provider="github")`.
 *   - `verify()` calls `/user` to make sure the token has access.
 *   - The runtime read returns `{ accessToken, refreshToken? }` and
 *     the deploy-hook fire path uses it for `repos/.../dispatches`.
 */

import { z } from "zod";

import { registerDeployHooks } from "../domains.js";
import type { RegisteredProvider } from "../registry.js";

export const GITHUB_DEPLOY_PROVIDER_ID = "github";

export const githubDeployFieldsSchema = z.object({
	accessToken: z.string().min(20),
	refreshToken: z.string().optional(),
	scope: z.string().optional(),
	tokenType: z.string().optional(),
});

export type GithubDeployFields = z.infer<typeof githubDeployFieldsSchema>;

export interface GithubVerifyDeps {
	readonly fetchImpl?: typeof fetch;
	readonly apiBase?: string;
}

const DEFAULT_API_BASE = "https://api.github.com";

export async function verifyGithubDeployConnection(
	fields: GithubDeployFields,
	signal: AbortSignal,
	deps: GithubVerifyDeps = {},
): Promise<void> {
	const fetchImpl = deps.fetchImpl ?? fetch;
	const base = deps.apiBase ?? DEFAULT_API_BASE;
	const res = await fetchImpl(new URL("/user", base), {
		method: "GET",
		signal,
		headers: {
			Authorization: `Bearer ${fields.accessToken}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "astropress-deploy-hooks",
		},
	});
	if (res.ok) return;
	const err = new Error(`github verify failed: ${res.status}`);
	(err as Error & { code?: string }).code =
		res.status === 401 || res.status === 403
			? "INTEGRATION_AUTH_REJECTED"
			: "INTEGRATION_VERIFY_FAILED";
	throw err;
}

let registered: RegisteredProvider<GithubDeployFields> | null = null;

export function registerGithubDeployProvider(
	deps: GithubVerifyDeps = {},
): RegisteredProvider<GithubDeployFields> {
	if (registered) return registered;
	// Cast through unknown because the registry types Field maps as
	// Record<string, string>, but GitHub stores optional fields. The
	// shape is enforced by the Zod schema at runtime; this cast
	// only papers over the encoder/decoder type variance.
	registered = registerDeployHooks({
		id: GITHUB_DEPLOY_PROVIDER_ID,
		label: "GitHub",
		fields: githubDeployFieldsSchema as unknown as z.ZodType<
			Record<string, string>
		>,
		verify: (fields, { signal }) =>
			verifyGithubDeployConnection(
				fields as unknown as GithubDeployFields,
				signal,
				deps,
			),
		defaultErrorCode: "INTEGRATION_AUTH_REJECTED",
	}) as unknown as RegisteredProvider<GithubDeployFields>;
	return registered;
}

export function _resetGithubDeployProviderForTests(): void {
	registered = null;
}
