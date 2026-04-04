export interface NewsletterAdapter {
  subscribe(email: string, locals?: App.Locals | null): Promise<{ ok: boolean; error?: string }>;
}

import { getNewsletterConfig } from "./runtime-env";

function toBasicAuthToken(value: string) {
  return btoa(value);
}

/**
 * Mailchimp adapter for newsletter subscriptions.
 *
 * REQUIRES:
 * - MAILCHIMP_API_KEY: Your Mailchimp API key (from Account > Extras > API keys)
 * - MAILCHIMP_LIST_ID: Your audience/list ID from Mailchimp
 * - MAILCHIMP_SERVER: Your server prefix (e.g., 'us1' from API key us1-xxxx)
 *
 * Set these in .env.local to enable newsletter subscriptions.
 *
 * API endpoint: https://{server}.api.mailchimp.com/3.0/lists/{list_id}/members
 * Auth: Base64("anystring:{api_key}")
 * Body: { email_address, status: 'subscribed' }
 */
export const newsletterAdapter: NewsletterAdapter = {
  subscribe: async (email: string, locals?: App.Locals | null) => {
    const { mode, apiKey, listId, server } = getNewsletterConfig(locals);

    if (mode !== "mailchimp") {
      console.info("[Newsletter] Using explicit mock delivery mode.");
      return { ok: true };
    }

    if (!apiKey || !listId || !server) {
      console.error("[Newsletter] MAILCHIMP_* environment is incomplete while live delivery is enabled.");
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
        console.error("[Newsletter] Mailchimp API error:", error);
        return {
          ok: false,
          error: error.detail || "Failed to subscribe. Please try again.",
        };
      }

      console.log(`[Newsletter] Successfully subscribed ${email} to Mailchimp`);
      return { ok: true };
    } catch (error) {
      console.error("[Newsletter] Subscription error:", error);
      return {
        ok: false,
        error: "Network error. Please try again.",
      };
    }
  },
};

export const placeholderAdapter = newsletterAdapter;
