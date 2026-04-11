import { getNewsletterConfig } from "./runtime-env.js";
import { createLogger } from "./runtime-logger.js";

const logger = createLogger("Newsletter");

function toBasicAuthToken(value) {
  return btoa(value);
}

export const newsletterAdapter = {
  subscribe: async (email, locals) => {
    const { mode, apiKey, listId, server, listmonkApiUrl, listmonkApiUsername, listmonkApiPassword, listmonkListId } = getNewsletterConfig(locals);

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

    if (mode !== "mailchimp") {
      logger.info("Using explicit mock delivery mode.");
      return { ok: true };
    }

    if (!apiKey || !listId || !server) {
      logger.error("MAILCHIMP_* environment is incomplete while live delivery is enabled.");
      return {
        ok: false,
        error: "Newsletter signup is temporarily unavailable.",
      };
    }

    try {
      const auth = toBasicAuthToken(`anystring:${apiKey}`);
      const response = await fetch(
        `https://${server}.api.mailchimp.com/3.0/lists/${listId}/members`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email_address: email,
            status: "subscribed",
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        logger.error("Mailchimp API error", { error });
        return {
          ok: false,
          error: error.detail || "Failed to subscribe. Please try again.",
        };
      }

      logger.info("Successfully subscribed to Mailchimp", { email });
      return { ok: true };
    } catch (error) {
      logger.error("Subscription error", { error });
      return {
        ok: false,
        error: "Network error. Please try again.",
      };
    }
  },
};

export const placeholderAdapter = newsletterAdapter;
