/**
 * Cloudflare CDN purge provider — push-button registration for the
 * cdn-purge domain.
 *
 * verify() is a two-step probe:
 *
 *   1. GET /client/v4/user/tokens/verify — confirms the token itself
 *      is valid (Cloudflare returns 401 for revoked / malformed
 *      tokens here).
 *   2. GET /client/v4/zones/{zoneId} — confirms the token has scope
 *      for the configured zone (a token without zone:read on this
 *      zone returns 403 here even though step 1 succeeded).
 *
 * The classifier (classifyCloudflareStatus) is shared between both
 * steps so the mapping stays consistent and is unit-testable as a
 * pure function.
 */

import { z } from "zod";

import type { IntegrationErrorCode } from "../../integration-error-sanitizer.js";
import { registerCdnPurge } from "../domains.js";
import type { RegisteredProvider } from "../registry.js";

export const CLOUDFLARE_CDN_FIELDS = z.object({
	apiToken: z.string().min(1),
	zoneId: z.string().min(1),
});

export type CloudflareCdnFields = z.infer<typeof CLOUDFLARE_CDN_FIELDS>;

const HOST = "https://api.cloudflare.com";
const TOKEN_VERIFY_PATH = "/client/v4/user/tokens/verify";
const ZONES_PATH = "/client/v4/zones/";

export class CloudflareCdnVerifyError extends Error {
	constructor(public readonly code: IntegrationErrorCode) {
		super(code);
		this.name = "CloudflareCdnVerifyError";
	}
}

export interface CloudflareCdnVerifyDeps {
	readonly fetch?: typeof fetch;
}

export function buildCloudflareTokenVerifyUrl(): string {
	return new URL(TOKEN_VERIFY_PATH, HOST).toString();
}

export function buildCloudflareZoneUrl(zoneId: string): string {
	return new URL(ZONES_PATH + encodeURIComponent(zoneId), HOST).toString();
}

export function buildCloudflareAuthHeader(apiToken: string): string {
	return `Bearer ${apiToken}`;
}

/**
 * Map an upstream Cloudflare API response to either `null` (success)
 * or an integration error code. Pure — relies only on `res.status`
 * and `res.ok`. Exported so tests pin the mapping independently of
 * the fetch wiring above.
 */
export function classifyCloudflareStatus(
	res: Response,
): IntegrationErrorCode | null {
	if (res.status === 401 || res.status === 403) {
		return "INTEGRATION_AUTH_REJECTED";
	}
	if (res.status === 404) {
		return "INTEGRATION_NOT_FOUND";
	}
	if (res.status === 429) {
		return "INTEGRATION_RATE_LIMITED";
	}
	if (res.ok) {
		return null;
	}
	return "INTEGRATION_VERIFY_FAILED";
}

export async function verifyCloudflareCdn(
	fields: CloudflareCdnFields,
	ctx: { signal: AbortSignal },
	deps: CloudflareCdnVerifyDeps = {},
): Promise<void> {
	const fetchImpl = deps.fetch ?? fetch;
	const init: RequestInit = {
		method: "GET",
		headers: { Authorization: buildCloudflareAuthHeader(fields.apiToken) },
		signal: ctx.signal,
	};
	const tokenRes = await fetchImpl(buildCloudflareTokenVerifyUrl(), init);
	const tokenCode = classifyCloudflareStatus(tokenRes);
	if (tokenCode !== null) {
		throw new CloudflareCdnVerifyError(tokenCode);
	}
	const zoneRes = await fetchImpl(buildCloudflareZoneUrl(fields.zoneId), init);
	const zoneCode = classifyCloudflareStatus(zoneRes);
	if (zoneCode !== null) {
		throw new CloudflareCdnVerifyError(zoneCode);
	}
}

export function registerCloudflareCdn(): RegisteredProvider<CloudflareCdnFields> {
	return registerCdnPurge<CloudflareCdnFields>({
		id: "cloudflare",
		label: "Cloudflare",
		fields: CLOUDFLARE_CDN_FIELDS,
		verify: verifyCloudflareCdn,
		defaultErrorCode: "INTEGRATION_VERIFY_FAILED",
	});
}
