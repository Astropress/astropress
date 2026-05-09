/**
 * Resolve a CDN-purge configuration from the available sources.
 *
 * The runtime can find CDN-purge config in three places, listed in
 * descending priority:
 *
 *   1. **Registry** — admin connected a Cloudflare provider via the
 *      Phase 3/4 connect flow. Phase 2 unsealed the API token + zone
 *      id from `connected_integrations`.
 *   2. **Process env** — legacy `CLOUDFLARE_API_TOKEN` +
 *      `CLOUDFLARE_ZONE_ID` pair. Both must be set; partial config is
 *      treated as absent.
 *   3. **Static CmsConfig** — legacy generic `cdnPurgeWebhook` URL
 *      that hosts wired in their `registerCms()` call.
 *
 * The resolver is pure: it consumes a snapshot of all three sources
 * and emits a tagged `ResolvedCdnPurge` value (or `{ kind: "none" }`
 * when no source has data). The cache-purge runtime adapter then
 * branches on `kind` to decide what call to make.
 *
 * The architectural intent is single-source-of-truth: the imperative
 * purge function only takes a resolved value, so its tests can pin
 * the runtime branches without re-coupling to env/config plumbing.
 */

export type CdnPurgeSource = "registry" | "env" | "config";

export type ResolvedCdnPurge =
	| {
			readonly kind: "cloudflare";
			readonly apiToken: string;
			readonly zoneId: string;
			readonly source: CdnPurgeSource;
	  }
	| {
			readonly kind: "webhook";
			readonly url: string;
			readonly source: "config";
	  }
	| { readonly kind: "none" };

export interface ResolveCdnPurgeInput {
	readonly registry?: {
		readonly apiToken: string;
		readonly zoneId: string;
	} | null;
	readonly env?: {
		readonly CLOUDFLARE_API_TOKEN?: string;
		readonly CLOUDFLARE_ZONE_ID?: string;
	} | null;
	readonly config?: { readonly cdnPurgeWebhook?: string | null } | null;
}

function nonEmptyString(value: string | undefined | null): value is string {
	return typeof value === "string" && value.length > 0;
}

export function resolveCdnPurge(input: ResolveCdnPurgeInput): ResolvedCdnPurge {
	const registry = input.registry;
	if (registry) {
		return {
			kind: "cloudflare",
			apiToken: registry.apiToken,
			zoneId: registry.zoneId,
			source: "registry",
		};
	}
	const env = input.env ?? {};
	if (nonEmptyString(env.CLOUDFLARE_API_TOKEN) && nonEmptyString(env.CLOUDFLARE_ZONE_ID)) {
		return {
			kind: "cloudflare",
			apiToken: env.CLOUDFLARE_API_TOKEN,
			zoneId: env.CLOUDFLARE_ZONE_ID,
			source: "env",
		};
	}
	const config = input.config ?? {};
	if (nonEmptyString(config.cdnPurgeWebhook)) {
		return {
			kind: "webhook",
			url: config.cdnPurgeWebhook,
			source: "config",
		};
	}
	return { kind: "none" };
}
