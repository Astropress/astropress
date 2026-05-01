/**
 * Catalog of admin-page stubs shown by leaves whose backing integration is
 * not yet configured. One entry per stub page; the page reads its entry,
 * checks whether the relevant config is present, and either renders the
 * real UI or <RequiresIntegration> with these values.
 *
 * Provider ordering: free / open-source first, SaaS after. "Recommended"
 * tag marks the lowest-friction option for a new install.
 */

export interface StubProvider {
	name: string;
	href?: string;
	tag?: "Recommended" | "Self-hosted" | "OSS" | "SaaS";
}

export interface StubEntry {
	capability: string;
	description: string;
	configHint: string;
	providers: StubProvider[];
	docsHref?: string;
}

export const adminStubs = {
	forms: {
		capability: "Forms",
		description:
			"Receive form submissions from your site. Configure a provider to capture, store, and notify on submissions.",
		configHint:
			'registerCms({\n  forms: { provider: "tally", apiKey: process.env.TALLY_API_KEY },\n});',
		providers: [
			{ name: "Web3Forms", href: "https://web3forms.com", tag: "Recommended" },
			{ name: "Formspree", href: "https://formspree.io", tag: "SaaS" },
			{ name: "Tally", href: "https://tally.so", tag: "SaaS" },
			{ name: "Typeform", href: "https://typeform.com", tag: "SaaS" },
			{
				name: "Netlify Forms",
				href: "https://www.netlify.com/products/forms/",
				tag: "SaaS",
			},
		],
	},
	newsletter: {
		capability: "Newsletter",
		description:
			"Compose and send newsletter campaigns to your subscribers. Subscribers are managed under Audience › Subscribers.",
		configHint:
			'registerCms({\n  newsletter: { provider: "listmonk", url: process.env.LISTMONK_URL },\n});',
		providers: [
			{ name: "Listmonk", href: "https://listmonk.app", tag: "Recommended" },
			{ name: "Mailchimp", href: "https://mailchimp.com", tag: "SaaS" },
			{ name: "ConvertKit", href: "https://convertkit.com", tag: "SaaS" },
			{ name: "Beehiiv", href: "https://beehiiv.com", tag: "SaaS" },
			{ name: "Buttondown", href: "https://buttondown.com", tag: "SaaS" },
		],
	},
	events: {
		capability: "Events",
		description:
			"Schedule events, manage RSVPs, and embed booking widgets. Choose a provider to enable an events page.",
		configHint:
			'registerCms({\n  events: { provider: "cal", url: "https://cal.com/your-team" },\n});',
		providers: [
			{ name: "Cal.com", href: "https://cal.com", tag: "Recommended" },
			{ name: "Calendly", href: "https://calendly.com", tag: "SaaS" },
			{ name: "Eventbrite", href: "https://eventbrite.com", tag: "SaaS" },
			{ name: "Luma", href: "https://lu.ma", tag: "SaaS" },
		],
	},
	reviews: {
		capability: "Reviews",
		description:
			"Aggregate reviews from third-party platforms and surface them on the site. Connect a provider to pull review data.",
		configHint:
			'registerCms({\n  reviews: { provider: "google", placeId: process.env.GOOGLE_PLACE_ID },\n});',
		providers: [
			{
				name: "Google Business Profile",
				href: "https://business.google.com",
				tag: "SaaS",
			},
			{
				name: "Trustpilot",
				href: "https://business.trustpilot.com",
				tag: "SaaS",
			},
			{
				name: "Yelp Fusion",
				href: "https://docs.developer.yelp.com",
				tag: "SaaS",
			},
		],
	},
	referrals: {
		capability: "Referrals",
		description:
			"Run a refer-a-friend or affiliate program. Track referrers, payouts, and attribution.",
		configHint:
			'registerCms({\n  referrals: { provider: "rewardful", apiKey: process.env.REWARDFUL_API_KEY },\n});',
		providers: [
			{ name: "Rewardful", href: "https://rewardful.com", tag: "SaaS" },
			{ name: "FirstPromoter", href: "https://firstpromoter.com", tag: "SaaS" },
			{ name: "GrowSurf", href: "https://growsurf.com", tag: "SaaS" },
			{ name: "ReferralCandy", href: "https://referralcandy.com", tag: "SaaS" },
		],
	},
	memberships: {
		capability: "Memberships",
		description:
			"Gate content behind subscriptions or membership tiers. Manage member access and billing.",
		configHint:
			'registerCms({\n  memberships: { provider: "memberstack", siteId: process.env.MEMBERSTACK_SITE_ID },\n});',
		providers: [
			{ name: "Memberstack", href: "https://memberstack.com", tag: "SaaS" },
			{ name: "Outseta", href: "https://outseta.com", tag: "SaaS" },
			{ name: "Patreon", href: "https://patreon.com", tag: "SaaS" },
			{
				name: "Stripe Customer Portal",
				href: "https://stripe.com/billing",
				tag: "SaaS",
			},
		],
	},
	community: {
		capability: "Community",
		description:
			"Embed a forum or discussion platform inside the admin shell. Configure a service URL to render an iframe panel.",
		configHint:
			'registerAstropressService({\n  provider: "community",\n  label: "Discourse",\n  proxyTarget: "https://forum.example.com",\n  adminPath: "/ap-admin/community",\n});',
		providers: [
			{ name: "Discourse", href: "https://discourse.org", tag: "OSS" },
			{ name: "Flarum", href: "https://flarum.org", tag: "OSS" },
			{ name: "Discord", href: "https://discord.com", tag: "SaaS" },
		],
	},
	shop: {
		capability: "Shop",
		description:
			"Embed a commerce admin inside the shell. Configure a service URL to render an iframe panel.",
		configHint:
			'registerAstropressService({\n  provider: "shop",\n  label: "Snipcart",\n  proxyTarget: "https://app.snipcart.com",\n  adminPath: "/ap-admin/shop",\n});',
		providers: [
			{ name: "Snipcart", href: "https://snipcart.com", tag: "SaaS" },
			{ name: "Shopify", href: "https://shopify.com", tag: "SaaS" },
			{ name: "Lemon Squeezy", href: "https://lemonsqueezy.com", tag: "SaaS" },
			{
				name: "Stripe Payment Links",
				href: "https://stripe.com/payments/payment-links",
				tag: "SaaS",
			},
		],
	},
	socialSyndication: {
		capability: "Social Syndication",
		description:
			"Auto-post on publish to social networks. Configure a provider to enable cross-posting.",
		configHint:
			'registerCms({\n  socialSyndication: { providers: ["bluesky", "mastodon"] },\n});',
		providers: [
			{ name: "Bluesky", href: "https://bsky.app", tag: "OSS" },
			{ name: "Mastodon", href: "https://joinmastodon.org", tag: "OSS" },
			{ name: "LinkedIn", href: "https://linkedin.com", tag: "SaaS" },
			{ name: "X / Twitter", href: "https://x.com", tag: "SaaS" },
		],
	},
	structuredData: {
		capability: "Structured Data / AEO",
		description:
			"Configure JSON-LD generation, llms.txt, and answer-engine optimization signals so AI assistants and search crawlers correctly attribute your content.",
		configHint:
			'registerCms({\n  structuredData: { llmsTxt: true, jsonLdDefaults: { orgName: "Acme" } },\n});',
		providers: [
			{ name: "JSON-LD (built-in)", tag: "Recommended" },
			{ name: "llms.txt (built-in)", tag: "Recommended" },
			{ name: "Schema.org docs", href: "https://schema.org" },
		],
	},
	sitemaps: {
		capability: "Sitemaps",
		description:
			"Generate and submit XML sitemaps to search engines. View sitemap coverage and last submission status.",
		configHint:
			'registerCms({\n  sitemaps: { enabled: true, submit: ["google", "bing"] },\n});',
		providers: [
			{ name: "Built-in XML sitemap", tag: "Recommended" },
			{
				name: "Google Search Console",
				href: "https://search.google.com/search-console",
			},
			{ name: "Bing Webmaster Tools", href: "https://www.bing.com/webmasters" },
		],
	},
	mapsLocal: {
		capability: "Maps & Local",
		description:
			"Manage your business presence on map and local-search platforms. Sync hours, photos, and posts where supported.",
		configHint:
			"registerCms({\n  mapsLocal: { google: { placeId: process.env.GOOGLE_PLACE_ID } },\n});",
		providers: [
			{
				name: "Google Business Profile",
				href: "https://business.google.com",
				tag: "SaaS",
			},
			{
				name: "Apple Business Connect",
				href: "https://businessconnect.apple.com",
				tag: "SaaS",
			},
			{ name: "Bing Places", href: "https://www.bingplaces.com", tag: "SaaS" },
		],
	},
	analytics: {
		capability: "Analytics",
		description:
			"Site traffic and product analytics. Configure a provider to embed dashboards and snippets.",
		configHint:
			'registerCms({\n  analytics: { provider: "umami", url: process.env.UMAMI_URL },\n});',
		providers: [
			{ name: "Umami", href: "https://umami.is", tag: "Recommended" },
			{ name: "Plausible", href: "https://plausible.io", tag: "OSS" },
			{ name: "Matomo", href: "https://matomo.org", tag: "OSS" },
			{ name: "PostHog", href: "https://posthog.com", tag: "OSS" },
		],
	},
	heatmaps: {
		capability: "Heatmaps & Session Replay",
		description:
			"Visualise on-page user behavior with click-maps and session replay. Configure a provider to embed.",
		configHint:
			'registerCms({\n  heatmaps: { provider: "openreplay", url: process.env.OPENREPLAY_URL },\n});',
		providers: [
			{ name: "OpenReplay", href: "https://openreplay.com", tag: "OSS" },
			{
				name: "PostHog Session Replay",
				href: "https://posthog.com",
				tag: "OSS",
			},
		],
	},
	abTesting: {
		capability: "A/B Testing & Feature Flags",
		description:
			"Roll out features behind flags and split traffic between variants. Configure a provider to enable.",
		configHint:
			'registerCms({\n  abTesting: { provider: "growthbook", url: process.env.GROWTHBOOK_URL },\n});',
		providers: [
			{ name: "GrowthBook", href: "https://growthbook.io", tag: "Recommended" },
			{ name: "Unleash", href: "https://getunleash.io", tag: "OSS" },
			{
				name: "PostHog Feature Flags",
				href: "https://posthog.com",
				tag: "OSS",
			},
		],
	},
	email: {
		capability: "Email",
		description:
			"Transactional email — password resets, invitations, contact form notifications. Configure a provider to send mail.",
		configHint: "# .env\nEMAIL_PROVIDER=resend\nRESEND_API_KEY=re_...",
		providers: [
			{ name: "Resend", href: "https://resend.com", tag: "Recommended" },
			{ name: "SMTP (any server)", tag: "Self-hosted" },
			{ name: "Postmark", href: "https://postmarkapp.com", tag: "SaaS" },
			{ name: "SendGrid", href: "https://sendgrid.com", tag: "SaaS" },
		],
	},
	liveChat: {
		capability: "Live Chat",
		description:
			"Real-time customer chat embedded on the site. Configure a provider to render the widget.",
		configHint:
			'registerCms({\n  liveChat: { provider: "crisp", websiteId: process.env.CRISP_WEBSITE_ID },\n});',
		providers: [
			{ name: "Crisp", href: "https://crisp.chat", tag: "Recommended" },
			{ name: "Chatwoot", href: "https://chatwoot.com", tag: "OSS" },
			{ name: "Intercom", href: "https://intercom.com", tag: "SaaS" },
			{ name: "HelpScout", href: "https://helpscout.com", tag: "SaaS" },
		],
	},
	imageCdn: {
		capability: "Image CDN",
		description:
			"Offload image transforms and delivery to a CDN. Configure a provider to enable image-pipeline routing.",
		configHint:
			'registerCms({\n  imageCdn: { provider: "cloudinary", cloudName: process.env.CLOUDINARY_CLOUD },\n});',
		providers: [
			{
				name: "Cloudflare Images",
				href: "https://www.cloudflare.com/products/cloudflare-images/",
				tag: "Recommended",
			},
			{ name: "Bunny.net", href: "https://bunny.net", tag: "SaaS" },
			{ name: "Cloudinary", href: "https://cloudinary.com", tag: "SaaS" },
			{ name: "imgix", href: "https://imgix.com", tag: "SaaS" },
		],
	},
	search: {
		capability: "Search",
		description:
			"Site-wide content search. The built-in SQLite FTS5 index works out of the box; switch to a hosted provider for larger catalogs.",
		configHint: "registerCms({\n  search: { enabled: true },\n});",
		providers: [
			{ name: "SQLite FTS5 (built-in)", tag: "Recommended" },
			{ name: "Pagefind", href: "https://pagefind.app", tag: "OSS" },
			{ name: "Typesense", href: "https://typesense.org", tag: "OSS" },
			{ name: "Meilisearch", href: "https://meilisearch.com", tag: "OSS" },
			{ name: "Algolia", href: "https://algolia.com", tag: "SaaS" },
		],
	},
	cdnPurge: {
		capability: "CDN Purge",
		description:
			"Invalidate CDN caches when content publishes. Configure a webhook URL or vendor API token to enable.",
		configHint:
			"# Either: registerCms({ cdnPurgeWebhook: process.env.NETLIFY_BUILD_HOOK_URL });\n# Or env vars: CLOUDFLARE_ZONE_ID + CLOUDFLARE_API_TOKEN",
		providers: [
			{
				name: "Cloudflare Cache API",
				href: "https://developers.cloudflare.com/cache/",
				tag: "Recommended",
			},
			{
				name: "Vercel Deploy Hook",
				href: "https://vercel.com/docs/deployments/deploy-hooks",
				tag: "SaaS",
			},
			{
				name: "Netlify Build Hook",
				href: "https://docs.netlify.com/configure-builds/build-hooks/",
				tag: "SaaS",
			},
		],
	},
	monitoring: {
		capability: "Monitoring",
		description:
			"Metrics, uptime, and alerting. Enable Prometheus to scrape /ap/metrics, or wire a SaaS uptime monitor.",
		configHint:
			"registerCms({\n  monitoring: { prometheusEnabled: true },\n});",
		providers: [
			{ name: "Prometheus (built-in)", tag: "Recommended" },
			{ name: "Grafana Cloud", href: "https://grafana.com", tag: "SaaS" },
			{ name: "Better Stack", href: "https://betterstack.com", tag: "SaaS" },
			{ name: "Sentry", href: "https://sentry.io", tag: "SaaS" },
		],
	},
	deployHooks: {
		capability: "Deploy Hooks",
		description:
			"Trigger production builds from CI or vendor webhooks. Configure URLs for the platforms you ship to.",
		configHint:
			"# Set deploy hook URLs as env vars; admin Publish action will POST on demand.\nCLOUDFLARE_PAGES_DEPLOY_HOOK=...\nVERCEL_DEPLOY_HOOK=...",
		providers: [
			{
				name: "Cloudflare Pages",
				href: "https://developers.cloudflare.com/pages/",
				tag: "SaaS",
			},
			{ name: "Vercel", href: "https://vercel.com", tag: "SaaS" },
			{ name: "Netlify", href: "https://netlify.com", tag: "SaaS" },
			{ name: "Render", href: "https://render.com", tag: "SaaS" },
			{
				name: "GitHub Actions",
				href: "https://docs.github.com/en/actions",
				tag: "SaaS",
			},
		],
	},
	plugins: {
		capability: "Plugins",
		description:
			"Inspect lifecycle plugins registered via registerCms({ plugins: [...] }). Plugins extend Astropress with hooks and admin nav contributions.",
		configHint:
			'import type { AstropressPlugin } from "@astropress-diy/astropress";\n\nconst myPlugin: AstropressPlugin = {\n  name: "my-plugin",\n  async onContentSave({ slug }) { /* … */ },\n};\n\nregisterCms({ plugins: [myPlugin] });',
		providers: [
			{
				name: "Plugin authoring guide",
				href: "https://github.com/Astropress/astropress",
			},
		],
	},
	data: {
		capability: "Data",
		description:
			"Backing data store — Cloudflare D1, Supabase, Neon, Turso, or others. Inspect connection health and migration status.",
		configHint:
			"# Configured by your deployment target; see deployment-matrix.ts.\n# Example: Cloudflare D1 binding name in wrangler.toml.",
		providers: [
			{
				name: "Cloudflare D1",
				href: "https://developers.cloudflare.com/d1/",
				tag: "Recommended",
			},
			{ name: "Supabase", href: "https://supabase.com", tag: "OSS" },
			{ name: "Neon", href: "https://neon.tech", tag: "SaaS" },
			{ name: "Turso (LibSQL)", href: "https://turso.tech", tag: "SaaS" },
			{ name: "PocketBase", href: "https://pocketbase.io", tag: "OSS" },
			{ name: "Appwrite", href: "https://appwrite.io", tag: "OSS" },
			{ name: "Nhost", href: "https://nhost.io", tag: "OSS" },
		],
	},
	backups: {
		capability: "Backups",
		description:
			"Schedule snapshots of the data store and exports of the media bucket. View recent backup runs and restore points.",
		configHint:
			'registerCms({\n  backups: { schedule: "daily", target: "r2://backups" },\n});',
		providers: [
			{
				name: "Cloudflare D1 + R2",
				href: "https://developers.cloudflare.com/d1/",
				tag: "Recommended",
			},
			{
				name: "Supabase Backups",
				href: "https://supabase.com/docs/guides/platform/backups",
				tag: "SaaS",
			},
		],
	},
} as const satisfies Record<string, StubEntry>;

export type AdminStubKey = keyof typeof adminStubs;

/**
 * Per-route metadata for the 25 admin stub pages rendered through the
 * dynamic `pages/ap-admin/[stub].astro` route. Each entry binds a URL
 * slug (the path segment) to:
 *
 *   - `stubKey`: which `adminStubs` entry holds the copy/providers.
 *   - `navKey`:  which `adminUi.navigation` label to render.
 *   - `action`:  the ABAC action enforced by `requiresAccess` before
 *                the page renders. Mirrors the per-page guard the
 *                old hand-written stubs each ran.
 *   - `variant`: optional. `"coming-soon"` makes RequiresIntegration
 *                drop env-var hints and surface the roadmap link;
 *                omitted for env-gated pages whose configHint is the
 *                whole point. Must agree with the integration manifest
 *                + `audit:integration-honesty` allowlist.
 *
 * Adding a new stub: append here and `audit:integration-honesty` will
 * verify the slug matches a real `adminStubs` entry. The dynamic route
 * 404s on unknown slugs so a typo never silently renders.
 */
export interface AdminStubPageEntry {
	readonly stubKey: AdminStubKey;
	readonly navKey: string;
	readonly action: string;
	readonly variant?: "coming-soon";
	readonly roadmapHref?: string;
}

const ROADMAP_ISSUE = "https://github.com/Astropress/astropress/issues/76";

export const ADMIN_STUB_PAGES = {
	// Coming-soon (status="coming-soon" in INTEGRATIONS or allowlist).
	"social-syndication": {
		stubKey: "socialSyndication",
		navKey: "socialSyndication",
		action: "services:manage",
		variant: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
	},
	referrals: {
		stubKey: "referrals",
		navKey: "referrals",
		action: "services:manage",
		variant: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
	},
	events: {
		stubKey: "events",
		navKey: "events",
		action: "events:manage",
		variant: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
	},
	reviews: {
		stubKey: "reviews",
		navKey: "reviews",
		action: "testimonials:manage",
		variant: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
	},
	memberships: {
		stubKey: "memberships",
		navKey: "memberships",
		action: "services:manage",
		variant: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
	},
	community: {
		stubKey: "community",
		navKey: "community",
		action: "services:manage",
		variant: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
	},
	plugins: {
		stubKey: "plugins",
		navKey: "plugins",
		action: "plugins:view",
		variant: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
	},
	heatmaps: {
		stubKey: "heatmaps",
		navKey: "heatmaps",
		action: "services:manage",
		variant: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
	},
	email: {
		stubKey: "email",
		navKey: "email",
		action: "services:manage",
		variant: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
	},
	"live-chat": {
		stubKey: "liveChat",
		navKey: "liveChat",
		action: "services:manage",
		variant: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
	},
	"image-cdn": {
		stubKey: "imageCdn",
		navKey: "imageCdn",
		action: "services:manage",
		variant: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
	},
	"deploy-hooks": {
		stubKey: "deployHooks",
		navKey: "deployHooks",
		action: "settings:edit",
		variant: "coming-soon",
		roadmapHref: ROADMAP_ISSUE,
	},
	// Env-gated (manifest status="env-gated" or unconfigured allowlist).
	data: {
		stubKey: "data",
		navKey: "data",
		action: "data:view",
	},
	backups: {
		stubKey: "backups",
		navKey: "backups",
		action: "backups:manage",
	},
	"maps-local": {
		stubKey: "mapsLocal",
		navKey: "mapsLocal",
		action: "seo:edit",
	},
	"structured-data": {
		stubKey: "structuredData",
		navKey: "structuredData",
		action: "seo:edit",
	},
	shop: {
		stubKey: "shop",
		navKey: "shop",
		action: "services:manage",
	},
	sitemaps: {
		stubKey: "sitemaps",
		navKey: "sitemaps",
		action: "sitemaps:view",
	},
	newsletter: {
		stubKey: "newsletter",
		navKey: "newsletter",
		action: "newsletter:send",
	},
	analytics: {
		stubKey: "analytics",
		navKey: "analytics",
		action: "services:manage",
	},
	"ab-testing": {
		stubKey: "abTesting",
		navKey: "abTesting",
		action: "services:manage",
	},
	search: {
		stubKey: "search",
		navKey: "search",
		action: "services:manage",
	},
	"cdn-purge": {
		stubKey: "cdnPurge",
		navKey: "cdnPurge",
		action: "settings:edit",
	},
	monitoring: {
		stubKey: "monitoring",
		navKey: "monitoring",
		action: "services:manage",
	},
	forms: {
		stubKey: "forms",
		navKey: "forms",
		action: "forms:view",
	},
} as const satisfies Record<string, AdminStubPageEntry>;

export type AdminStubPageSlug = keyof typeof ADMIN_STUB_PAGES;

export function getAdminStubPage(slug: string): AdminStubPageEntry | undefined {
	return (ADMIN_STUB_PAGES as Record<string, AdminStubPageEntry>)[slug];
}
