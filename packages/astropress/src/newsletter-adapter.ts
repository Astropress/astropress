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
  listSubscribers?(opts?: ListSubscribersOptions): Promise<ListSubscribersResult | { supported: false }>;
  /** Delete (unsubscribe) a subscriber by ID. Returns `{ supported: false }` when the adapter does not support delete operations. */
  deleteSubscriber?(id: string | number): Promise<{ ok: boolean; error?: string } | { supported: false }>;
}

import { getNewsletterConfig } from "./runtime-env";
import { createLogger } from "./runtime-logger";

const logger = createLogger("Newsletter");

function toBasicAuthToken(value: string) {
  return btoa(value);
}

export const newsletterAdapter: NewsletterAdapter = {
  subscribe: async (email: string, locals?: App.Locals | null) => {
    const { mode, listmonkApiUrl, listmonkApiUsername, listmonkApiPassword, listmonkListId } = getNewsletterConfig(locals);

    if (mode === "listmonk") {
      if (!listmonkApiUrl || !listmonkApiUsername || !listmonkApiPassword || !listmonkListId) {
        logger.error("LISTMONK_* environment is incomplete while listmonk delivery is enabled.");
        return { ok: false, error: "Newsletter signup is temporarily unavailable." };
      }
      try {
        const auth = toBasicAuthToken(`${listmonkApiUsername}:${listmonkApiPassword}`);
        const response = await fetch(`${listmonkApiUrl}/api/subscribers`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            name: email,
            status: "enabled",
            lists: [Number(listmonkListId)],
            preconfirm_subscriptions: true,
          }),
        });
        if (!response.ok) {
          const body = await response.text();
          logger.error("Listmonk API error", { status: response.status, body });
          return { ok: false, error: "Failed to subscribe. Please try again." };
        }
        logger.info("Successfully subscribed to Listmonk", { email });
        return { ok: true };
      } catch (error) {
        logger.error("Listmonk subscription error", { error });
        return { ok: false, error: "Network error. Please try again." };
      }
    }

    // Any mode other than "listmonk" (including "mock" and unrecognized values) returns ok
    // without calling any external API — safe for local dev, CI, and unknown future modes.
    logger.info("Using mock delivery mode.", { mode });
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
      const res = await fetch(`${config.apiUrl}/api/subscribers?${params}`, { headers: headers() });
      if (!res.ok) throw new Error(`Listmonk API error: ${res.status}`);
      const data = await res.json() as { data: { results: Array<{ id: number; email: string; name: string; status: string; created_at: string }>; total: number } };
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
      const res = await fetch(`${config.apiUrl}/api/subscribers/${id}`, { headers: headers() });
      if (!res.ok) throw new Error(`Listmonk API error: ${res.status}`);
      const data = await res.json() as { data: { id: number; email: string; name: string; status: string; created_at: string } };
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
