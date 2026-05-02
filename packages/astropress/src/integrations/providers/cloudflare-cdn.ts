/**
 * Cloudflare CDN-purge provider.
 *
 * Verify is a two-step probe:
 *
 *   1. GET /client/v4/user/tokens/verify with the API token —
 *      proves the token is valid;
 *   2. GET /client/v4/zones/${zoneId} with the same token —
 *      proves the token has access to the configured zone.
 *
 * The runtime read returns `{ apiToken, zoneId }`; the cache-purge
 * adapter posts to /client/v4/zones/${zoneId}/purge_cache directly.
 */

import { z } from "zod";

import { registerCdnPurge } from "../domains.js";
import type { RegisteredProvider } from "../registry.js";

export const CLOUDFLARE_CDN_PROVIDER_ID = "cloudflare";

const API_BASE = "https://api.cloudflare.com";

export const cloudflareCdnFieldsSchema = z.object({
	apiToken: z.string().min(20),
	zoneId: z.string().min(1),
});

export type CloudflareCdnFields = z.infer<typeof cloudflareCdnFieldsSchema>;

export interface CloudflareCdnVerifyDeps {
	readonly fetchImpl?: typeof fetch;
	readonly apiBase?: string;
}

async function probe(
	url: URL,
	apiToken: string,
	signal: AbortSignal,
	fetchImpl: typeof fetch,
): Promise<void> {
	const res = await fetchImpl(url, {
		method: "GET",
		signal,
		headers: { Authorization: `Bearer ${apiToken}` },
	});
	if (res.ok) return;
	const err = new Error(`cloudflare probe failed: ${res.status}`);
	(err as Error & { code?: string }).code =
		res.status === 401 || res.status === 403
			? "INTEGRATION_AUTH_REJECTED"
			: "INTEGRATION_VERIFY_FAILED";
	throw err;
}

export async function verifyCloudflareCdnConnection(
	fields: CloudflareCdnFields,
	signal: AbortSignal,
	deps: CloudflareCdnVerifyDeps = {},
): Promise<void> {
	const fetchImpl = deps.fetchImpl ?? fetch;
	const base = deps.apiBase ?? API_BASE;
	await probe(
		new URL("/client/v4/user/tokens/verify", base),
		fields.apiToken,
		signal,
		fetchImpl,
	);
	await probe(
		new URL(`/client/v4/zones/${encodeURIComponent(fields.zoneId)}`, base),
		fields.apiToken,
		signal,
		fetchImpl,
	);
}

let registered: RegisteredProvider<CloudflareCdnFields> | null = null;

export function registerCloudflareCdnProvider(
	deps: CloudflareCdnVerifyDeps = {},
): RegisteredProvider<CloudflareCdnFields> {
	if (registered) return registered;
	registered = registerCdnPurge<CloudflareCdnFields>({
		id: CLOUDFLARE_CDN_PROVIDER_ID,
		label: "Cloudflare",
		fields: cloudflareCdnFieldsSchema,
		verify: (fields, { signal }) =>
			verifyCloudflareCdnConnection(fields, signal, deps),
		defaultErrorCode: "INTEGRATION_AUTH_REJECTED",
	});
	return registered;
}

export function _resetCloudflareCdnProviderForTests(): void {
	registered = null;
}
