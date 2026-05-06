/**
 * Resolve a newsletter configuration from the available sources.
 *
 * The runtime can find newsletter config in two places, in priority
 * order:
 *
 *   1. **Registry** — admin connected a Listmonk provider via the
 *      Phase 3/4 connect flow. Phase 2 unsealed the
 *      `{baseUrl, apiUser, apiKey}` triple from
 *      `connected_integrations`. Note that `listId` is NOT stored in
 *      the provider record — it is a per-deployment list-target, so
 *      it always comes from `LISTMONK_LIST_ID`.
 *   2. **Process env** — `LISTMONK_API_URL` / `LISTMONK_API_USERNAME` /
 *      `LISTMONK_API_PASSWORD` / `LISTMONK_LIST_ID`. All four must be
 *      set; partial config falls through to mock.
 *
 * `NEWSLETTER_DELIVERY_MODE=mock` always wins (forces mock for local
 * dev / CI even if env credentials happen to be set).
 *
 * The resolver is pure: it consumes a snapshot of all sources and
 * emits a tagged `ResolvedNewsletter` value. The newsletter adapter
 * branches on `kind`.
 */

export type NewsletterCredentialSource = "registry" | "env";

export type ResolvedNewsletter =
	| {
			readonly kind: "listmonk";
			readonly baseUrl: string;
			readonly apiUser: string;
			readonly apiKey: string;
			readonly listId: string;
			readonly credentialSource: NewsletterCredentialSource;
	  }
	| { readonly kind: "mock" }
	| { readonly kind: "misconfigured"; readonly reason: string };

export interface ResolveNewsletterInput {
	readonly registry?: {
		readonly baseUrl: string;
		readonly apiUser: string;
		readonly apiKey: string;
	} | null;
	readonly env?: {
		readonly NEWSLETTER_DELIVERY_MODE?: string;
		readonly LISTMONK_API_URL?: string;
		readonly LISTMONK_API_USERNAME?: string;
		readonly LISTMONK_API_PASSWORD?: string;
		readonly LISTMONK_LIST_ID?: string;
	} | null;
}

function nonEmpty(v: string | undefined | null): v is string {
	return typeof v === "string" && v.length > 0;
}

export function resolveNewsletter(input: ResolveNewsletterInput): ResolvedNewsletter {
	const env = input.env ?? {};
	if (env.NEWSLETTER_DELIVERY_MODE === "mock") {
		return { kind: "mock" };
	}
	const explicitListmonk = env.NEWSLETTER_DELIVERY_MODE === "listmonk";
	const listId = env.LISTMONK_LIST_ID;
	const registry = input.registry;
	if (!nonEmpty(listId)) {
		if (explicitListmonk) {
			return {
				kind: "misconfigured",
				reason: "LISTMONK_LIST_ID is required when NEWSLETTER_DELIVERY_MODE=listmonk",
			};
		}
		return { kind: "mock" };
	}
	if (registry) {
		return {
			kind: "listmonk",
			baseUrl: registry.baseUrl,
			apiUser: registry.apiUser,
			apiKey: registry.apiKey,
			listId,
			credentialSource: "registry",
		};
	}
	if (
		nonEmpty(env.LISTMONK_API_URL) &&
		nonEmpty(env.LISTMONK_API_USERNAME) &&
		nonEmpty(env.LISTMONK_API_PASSWORD)
	) {
		return {
			kind: "listmonk",
			baseUrl: env.LISTMONK_API_URL,
			apiUser: env.LISTMONK_API_USERNAME,
			apiKey: env.LISTMONK_API_PASSWORD,
			listId,
			credentialSource: "env",
		};
	}
	if (explicitListmonk) {
		return {
			kind: "misconfigured",
			reason: "Listmonk mode set but credentials are not fully configured",
		};
	}
	return { kind: "mock" };
}
