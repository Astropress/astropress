export interface AnalyticsConfig {
	/** Analytics provider identifier. */
	type: "umami" | "plausible" | "matomo" | "posthog" | "custom";
	/**
	 * "iframe" — embed the dashboard URL in a full-screen iframe in /ap-admin/services/analytics.
	 * "link"   — show a branded open-in-new-tab button.
	 * "snippet-only" — inject tracker script into site <head> only; no admin panel.
	 */
	mode: "iframe" | "link" | "snippet-only";
	/** Dashboard URL for iframe/link mode. */
	url?: string;
	/** Tracker script src for snippet injection (e.g. "https://analytics.example.com/script.js"). */
	snippetSrc?: string;
	/** Provider-specific site/website ID (Umami: website ID, Plausible: domain). */
	siteId?: string;
	/** Override the display label shown in the sidebar. */
	label?: string;
}

export interface GiveLivelyConfig {
	/** GiveLively organization slug (GIVELIVELY_ORG_SLUG). */
	orgSlug: string;
	/** GiveLively campaign slug (GIVELIVELY_CAMPAIGN_SLUG). Falls back to orgSlug when omitted. */
	campaignSlug?: string;
}

export interface LiberapayConfig {
	/** Liberapay username (LIBERAPAY_USERNAME). */
	username: string;
}

export interface PledgeCryptoConfig {
	/** PledgeCrypto partner key (PLEDGE_PARTNER_KEY). Carbon offsets are applied automatically per transaction. */
	partnerKey: string;
}

/**
 * Testimonials and referral capture.
 *
 * Astropress is a two-site framework: admin server and public static site run on
 * separate origins. Collection flows through Formbricks or Typebot — the widget
 * runs on the tool's origin, the user submits there, and the tool webhooks to
 * /ap-api/v1/testimonials/ingest on the admin server. The admin server URL goes
 * in the tool's webhook config, never in public HTML.
 */
export interface TestimonialsConfig {
	/** The collection tool in use. */
	type: "formbricks" | "typebot";
	/** Self-hosted instance URL. When set, surfaces the tool's admin as an iframe in /ap-admin/services/testimonials. */
	url?: string;
	/** Public embed key (Formbricks environment ID or Typebot bot ID) for the widget snippet. */
	embedKey?: string;
	/** HMAC-SHA256 secret for webhook signature verification. Required in production. */
	webhookSecret?: string;
	/** Admin sidebar label override. Default: "Testimonials". */
	label?: string;
}

export interface DonationsConfig {
	/** GiveLively widget for fiat donations (US nonprofits). */
	giveLively?: GiveLivelyConfig;
	/** Liberapay recurring donation button (no external JS, always shown). */
	liberapay?: LiberapayConfig;
	/** PledgeCrypto widget for crypto donations with automatic carbon offsets. */
	pledgeCrypto?: PledgeCryptoConfig;
}

export interface AbTestingConfig {
	/** A/B testing / feature flag provider identifier. */
	type: "growthbook" | "unleash" | "custom";
	/** "iframe" — embed dashboard. "link" — open-in-new-tab button. */
	mode: "iframe" | "link";
	/** Dashboard URL for iframe/link mode. */
	url?: string;
	/** API endpoint for flag loading at runtime (e.g. GrowthBook API host). */
	apiEndpoint?: string;
	/** Override the display label shown in the sidebar. */
	label?: string;
}

export interface AstropressApiConfig {
	/** Enable /ap-api/v1/* REST endpoints. When false (default), all API routes return 404. */
	enabled: boolean;
	/** Require HTTPS for token auth in production. Default: true. */
	requireHttps?: boolean;
	/** Max requests per token per minute before rate-limiting. Default: 60. */
	rateLimit?: number;
	/**
	 * Optional CORS configuration for the REST API.
	 * Set `origin` to `"*"` to allow all origins, a single origin string, or an array of allowed origins.
	 * When unset, no CORS headers are added.
	 *
	 * @example
	 * ```ts
	 * registerCms({ api: { enabled: true, cors: { origin: "https://app.example.com" } } });
	 * ```
	 */
	cors?: {
		origin: string | string[] | "*";
	};
}
