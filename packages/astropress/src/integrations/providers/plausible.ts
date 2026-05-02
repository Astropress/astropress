/**
 * Plausible analytics provider — push-button registration for the
 * analytics domain.
 *
 * verify() runs a GET against `${host}/api/v1/sites/${siteId}` with a
 * Bearer token. Plausible's stats API responds:
 *
 *   200          → token valid for this site → connected
 *   401          → token invalid          → INTEGRATION_AUTH_REJECTED
 *   403          → token valid but lacks scope for this site
 *                   → INTEGRATION_AUTH_REJECTED (provider-level
 *                   defaultErrorCode keeps this as the verify
 *                   default for unknown shapes too)
 *   404          → siteId does not exist  → INTEGRATION_NOT_FOUND
 *   429          → rate-limited           → INTEGRATION_RATE_LIMITED
 *   other ¬ok    → INTEGRATION_VERIFY_FAILED
 *
 * Self-hosted Plausible runs on a different host (we accept any
 * https origin); the SaaS default is documented in the connect form
 * but not encoded here so the schema stays tight.
 */

import { z } from "zod";

import type { IntegrationErrorCode } from "../../integration-error-sanitizer.js";
import { registerAnalytics } from "../domains.js";
import type { RegisteredProvider } from "../registry.js";

export const PLAUSIBLE_FIELDS = z.object({
	host: z.string().url(),
	siteId: z.string().min(1),
	apiKey: z.string().min(1),
});

export type PlausibleFields = z.infer<typeof PLAUSIBLE_FIELDS>;

const SITES_PATH = "/api/v1/sites/";

export class PlausibleVerifyError extends Error {
	constructor(public readonly code: IntegrationErrorCode) {
		super(code);
		this.name = "PlausibleVerifyError";
	}
}

export interface PlausibleVerifyDeps {
	readonly fetch?: typeof fetch;
}

export function buildPlausibleSiteUrl(host: string, siteId: string): string {
	return new URL(SITES_PATH + encodeURIComponent(siteId), host).toString();
}

export function buildPlausibleAuthHeader(apiKey: string): string {
	return `Bearer ${apiKey}`;
}

export async function verifyPlausible(
	fields: PlausibleFields,
	ctx: { signal: AbortSignal },
	deps: PlausibleVerifyDeps = {},
): Promise<void> {
	const fetchImpl = deps.fetch ?? fetch;
	const url = buildPlausibleSiteUrl(fields.host, fields.siteId);
	const auth = buildPlausibleAuthHeader(fields.apiKey);
	const res = await fetchImpl(url, {
		method: "GET",
		headers: { Authorization: auth },
		signal: ctx.signal,
	});
	if (res.status === 401 || res.status === 403) {
		throw new PlausibleVerifyError("INTEGRATION_AUTH_REJECTED");
	}
	if (res.status === 404) {
		throw new PlausibleVerifyError("INTEGRATION_NOT_FOUND");
	}
	if (res.status === 429) {
		throw new PlausibleVerifyError("INTEGRATION_RATE_LIMITED");
	}
	if (!res.ok) {
		throw new PlausibleVerifyError("INTEGRATION_VERIFY_FAILED");
	}
}

export function registerPlausible(): RegisteredProvider<PlausibleFields> {
	return registerAnalytics<PlausibleFields>({
		id: "plausible",
		label: "Plausible",
		fields: PLAUSIBLE_FIELDS,
		verify: verifyPlausible,
		defaultErrorCode: "INTEGRATION_AUTH_REJECTED",
	});
}
