import { getNewsletterConfig } from "./runtime-env.js";
import { createLogger } from "./runtime-logger.js";
const logger = createLogger("Newsletter");
function toBasicAuthToken(value) {
    return btoa(value);
}
export const newsletterAdapter = {
    subscribe: async (email, locals) => {
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
            }
            catch (error) {
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
export function createListmonkOps(config) {
    const auth = () => btoa(`${config.apiUsername}:${config.apiPassword}`);
    const headers = () => ({
        Authorization: `Basic ${auth()}`,
        "Content-Type": "application/json",
    });
    return {
        async listSubscribers(opts = {}) {
            const { page = 1, perPage = 25, query = "" } = opts;
            const params = new URLSearchParams({
                page: String(page),
                per_page: String(perPage),
                ...(query ? { query } : {}),
            });
            const res = await fetch(`${config.apiUrl}/api/subscribers?${params}`, { headers: headers() });
            if (!res.ok)
                throw new Error(`Listmonk API error: ${res.status}`);
            const data = await res.json();
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
        async getSubscriber(id) {
            const res = await fetch(`${config.apiUrl}/api/subscribers/${id}`, { headers: headers() });
            if (!res.ok)
                throw new Error(`Listmonk API error: ${res.status}`);
            const data = await res.json();
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
        async deleteSubscriber(id) {
            const res = await fetch(`${config.apiUrl}/api/subscribers/${id}`, {
                method: "DELETE",
                headers: headers(),
            });
            if (!res.ok)
                return { ok: false, error: `Listmonk API error: ${res.status}` };
            return { ok: true };
        },
    };
}
