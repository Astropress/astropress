/**
 * GitHub OAuth provider for the deploy-hooks domain.
 *
 * Phase 6 lands GitHub as the first OAuth-flow provider. The connect
 * surface here pins only the access token — the OAuth start/callback
 * routes (Phase 6b) seal the token via the Phase 2 envelope after a
 * successful state verification, then call this provider's verify()
 * to make sure the token actually has access before persisting.
 *
 * verify() runs a GET against `/user` and classifies the response:
 *
 *   200          → token valid                  → connected
 *   401          → token rejected               → INTEGRATION_AUTH_REJECTED
 *   403          → token lacks scope            → INTEGRATION_AUTH_REJECTED
 *   404          → unexpected (api shape)       → INTEGRATION_VERIFY_FAILED
 *   429          → rate-limited                 → INTEGRATION_RATE_LIMITED
 *   other ¬ok    → INTEGRATION_VERIFY_FAILED
 */

import { z } from "zod";

import type { IntegrationErrorCode } from "../../integration-error-sanitizer.js";
import { registerDeployHooks } from "../domains.js";
import type { RegisteredProvider } from "../registry.js";

export const GITHUB_DEPLOY_FIELDS = z.object({
	accessToken: z.string().min(1),
});

export type GithubDeployFields = z.infer<typeof GITHUB_DEPLOY_FIELDS>;

const HOST = "https://api.github.com";
const USER_PATH = "/user";

export class GithubDeployVerifyError extends Error {
	constructor(public readonly code: IntegrationErrorCode) {
		super(code);
		this.name = "GithubDeployVerifyError";
	}
}

export interface GithubDeployVerifyDeps {
	readonly fetch?: typeof fetch;
}

export function buildGithubUserUrl(): string {
	return new URL(USER_PATH, HOST).toString();
}

export function buildGithubAuthHeader(accessToken: string): string {
	return `Bearer ${accessToken}`;
}

/**
 * Pure mapping from a `/user` response to either `null` (success) or
 * a typed integration error code. Pinned independently so a typo in
 * the status table is caught by a unit test.
 */
export function classifyGithubStatus(res: Response): IntegrationErrorCode | null {
	if (res.status === 401 || res.status === 403) {
		return "INTEGRATION_AUTH_REJECTED";
	}
	if (res.status === 429) {
		return "INTEGRATION_RATE_LIMITED";
	}
	if (res.ok) {
		return null;
	}
	return "INTEGRATION_VERIFY_FAILED";
}

export async function verifyGithubDeploy(
	fields: GithubDeployFields,
	ctx: { signal: AbortSignal },
	deps: GithubDeployVerifyDeps = {},
): Promise<void> {
	const fetchImpl = deps.fetch ?? fetch;
	const res = await fetchImpl(buildGithubUserUrl(), {
		method: "GET",
		headers: {
			Authorization: buildGithubAuthHeader(fields.accessToken),
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "astropress-deploy-hooks",
		},
		signal: ctx.signal,
	});
	const code = classifyGithubStatus(res);
	if (code !== null) {
		throw new GithubDeployVerifyError(code);
	}
}

export function registerGithubDeploy(): RegisteredProvider<GithubDeployFields> {
	return registerDeployHooks<GithubDeployFields>({
		id: "github",
		label: "GitHub",
		fields: GITHUB_DEPLOY_FIELDS,
		verify: verifyGithubDeploy,
		defaultErrorCode: "INTEGRATION_AUTH_REJECTED",
	});
}
