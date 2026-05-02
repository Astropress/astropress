/**
 * Resolve a server-to-server analytics-stats configuration.
 *
 * Distinct from `resolveAnalyticsSnippet` (which emits a client-side
 * `<script>` tag for tracking) — this resolver answers "where do I
 * pull aggregated stats from for the AnalyticsPanel?".
 *
 * Today the only supported source is Plausible's `/api/v1/stats`
 * endpoint, surfaced via the Phase 4 `analytics/plausible` provider
 * registered against `connected_integrations`. There is no env-var or
 * static-config fallback — admin connection is the only path. This
 * matches reality: a Plausible Stats API key is a sensitive
 * credential that should always go through the Phase 2 envelope, not
 * sit in plaintext in `app.toml`.
 *
 * The resolver is pure: it consumes a snapshot of the registry data
 * and emits a tagged `ResolvedAnalyticsStats`. Same architectural
 * shape as `resolveCdnPurge` and `resolveNewsletter` so the runtime
 * call sites compose identically.
 */

export type ResolvedAnalyticsStats =
	| {
			readonly kind: "plausible";
			readonly host: string;
			readonly siteId: string;
			readonly apiKey: string;
	  }
	| { readonly kind: "none" };

export interface ResolveAnalyticsStatsInput {
	readonly registry?: {
		readonly host: string;
		readonly siteId: string;
		readonly apiKey: string;
	} | null;
}

function nonEmpty(v: string | undefined | null): v is string {
	return typeof v === "string" && v.length > 0;
}

export function resolveAnalyticsStats(
	input: ResolveAnalyticsStatsInput,
): ResolvedAnalyticsStats {
	const registry = input.registry;
	if (!registry) return { kind: "none" };
	if (!nonEmpty(registry.host)) return { kind: "none" };
	if (!nonEmpty(registry.siteId)) return { kind: "none" };
	if (!nonEmpty(registry.apiKey)) return { kind: "none" };
	return {
		kind: "plausible",
		host: registry.host,
		siteId: registry.siteId,
		apiKey: registry.apiKey,
	};
}
