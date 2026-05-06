export interface SubscriberRecord {
	id: string | number;
	email: string;
	name?: string;
	status: "enabled" | "disabled" | "blocklisted" | "subscribed" | "unsubscribed" | string;
	createdAt?: string;
}

export interface ListSubscribersOptions {
	page?: number;
	perPage?: number;
	query?: string;
}

export interface ListSubscribersResult {
	subscribers: SubscriberRecord[];
	total: number;
	page: number;
	perPage: number;
}

export interface GetSubscriberResult {
	subscriber: SubscriberRecord;
}

export interface NewsletterAdapter {
	subscribe(email: string, locals?: App.Locals | null): Promise<{ ok: boolean; error?: string }>;
	/** List subscribers. Returns `{ supported: false }` when the adapter does not support list operations. */
	listSubscribers?(
		opts?: ListSubscribersOptions,
	): Promise<ListSubscribersResult | { supported: false }>;
	/** Delete (unsubscribe) a subscriber by ID. Returns `{ supported: false }` when the adapter does not support delete operations. */
	deleteSubscriber?(
		id: string | number,
	): Promise<{ ok: boolean; error?: string } | { supported: false }>;
}

import {
	type ResolvedNewsletter,
	resolveNewsletter,
} from "./integrations/resolvers/newsletter-resolver.js";
import { getNewsletterConfig } from "./runtime-env";
import { createLogger } from "./runtime-logger";

const logger = createLogger("Newsletter");

export function buildListmonkBasicAuthHeader(apiUser: string, apiKey: string): string {
	return `Basic ${btoa(`${apiUser}:${apiKey}`)}`;
}

export function buildListmonkSubscribeUrl(baseUrl: string): string {
	return `${baseUrl}/api/subscribers`;
}

export interface SubscribeViaListmonkDeps {
	readonly fetch?: typeof fetch;
}

/**
 * Issue a single Listmonk `/api/subscribers` POST against an
 * already-resolved `{kind: "listmonk", ...}` configuration. Pure
 * on the resolved value + injected fetch so each response-status
 * branch is independently mutation-testable.
 */
export async function subscribeViaListmonk(
	resolved: Extract<ResolvedNewsletter, { kind: "listmonk" }>,
	email: string,
	deps: SubscribeViaListmonkDeps = {},
): Promise<{ ok: boolean; error?: string }> {
	const fetchImpl = deps.fetch ?? fetch;
	try {
		const response = await fetchImpl(buildListmonkSubscribeUrl(resolved.baseUrl), {
			method: "POST",
			headers: {
				Authorization: buildListmonkBasicAuthHeader(resolved.apiUser, resolved.apiKey),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				email,
				name: email,
				status: "enabled",
				lists: [Number(resolved.listId)],
				preconfirm_subscriptions: true,
			}),
		});
		if (!response.ok) {
			const body = await response.text();
			logger.error("Listmonk API error", { status: response.status, body });
			return {
				ok: false,
				error: "Subscription could not be saved. Confirm the list settings and retry.",
			};
		}
		logger.info("Successfully subscribed to Listmonk", { email });
		return { ok: true };
	} catch (error) {
		logger.error("Listmonk subscription error", { error });
		return {
			ok: false,
			error:
				"The newsletter provider could not be reached. Check the network connection or provider status.",
		};
	}
}

export const newsletterAdapter: NewsletterAdapter = {
	subscribe: async (email: string, locals?: App.Locals | null) => {
		const cfg = getNewsletterConfig(locals);
		const resolved = resolveNewsletter({
			env: {
				NEWSLETTER_DELIVERY_MODE: cfg.mode,
				LISTMONK_API_URL: cfg.listmonkApiUrl,
				LISTMONK_API_USERNAME: cfg.listmonkApiUsername,
				LISTMONK_API_PASSWORD: cfg.listmonkApiPassword,
				LISTMONK_LIST_ID: cfg.listmonkListId,
			},
		});
		if (resolved.kind === "listmonk") {
			return subscribeViaListmonk(resolved, email);
		}
		if (resolved.kind === "misconfigured") {
			logger.error("Newsletter is misconfigured", { reason: resolved.reason });
			return {
				ok: false,
				error: "The newsletter is not fully configured. Check the provider settings and try again.",
			};
		}
		// kind === "mock" — safe for local dev, CI, and unknown future modes.
		logger.info("Using mock delivery mode.", { mode: cfg.mode });
		return { ok: true };
	},
};

export const placeholderAdapter = newsletterAdapter;

/**
 * Listmonk-specific subscriber list operations.
 * These are exposed separately so host apps that use listmonk can access
 * full CRUD without needing to re-implement the API client.
 */
export function createListmonkOps(config: {
	apiUrl: string;
	apiUsername: string;
	apiPassword: string;
	listId: number;
}) {
	const auth = () => btoa(`${config.apiUsername}:${config.apiPassword}`);
	const headers = () => ({
		Authorization: `Basic ${auth()}`,
		"Content-Type": "application/json",
	});

	return {
		async listSubscribers(opts: ListSubscribersOptions = {}): Promise<ListSubscribersResult> {
			const { page = 1, perPage = 25, query = "" } = opts;
			const params = new URLSearchParams({
				page: String(page),
				per_page: String(perPage),
				...(query ? { query } : {}),
			});
			const res = await fetch(`${config.apiUrl}/api/subscribers?${params}`, {
				headers: headers(),
			});
			if (!res.ok) throw new Error(`Listmonk API error: ${res.status}`);
			const data = (await res.json()) as {
				data: {
					results: Array<{
						id: number;
						email: string;
						name: string;
						status: string;
						created_at: string;
					}>;
					total: number;
				};
			};
			return {
				subscribers: data.data.results.map((r) => ({
					id: r.id,
					email: r.email,
					name: r.name,
					status: r.status,
					createdAt: r.created_at,
				})),
				total: data.data.total,
				page,
				perPage,
			};
		},

		async getSubscriber(id: string | number): Promise<GetSubscriberResult> {
			const res = await fetch(`${config.apiUrl}/api/subscribers/${id}`, {
				headers: headers(),
			});
			if (!res.ok) throw new Error(`Listmonk API error: ${res.status}`);
			const data = (await res.json()) as {
				data: {
					id: number;
					email: string;
					name: string;
					status: string;
					created_at: string;
				};
			};
			return {
				subscriber: {
					id: data.data.id,
					email: data.data.email,
					name: data.data.name,
					status: data.data.status,
					createdAt: data.data.created_at,
				},
			};
		},

		async deleteSubscriber(id: string | number): Promise<{ ok: boolean; error?: string }> {
			const res = await fetch(`${config.apiUrl}/api/subscribers/${id}`, {
				method: "DELETE",
				headers: headers(),
			});
			if (!res.ok) return { ok: false, error: `Listmonk API error: ${res.status}` };
			return { ok: true };
		},
	};
}
