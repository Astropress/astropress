import type { DonationsConfig } from "./config";
import type { AstropressDonationsProviders } from "./project-scaffold";

export interface DonationSnippets {
	/** GiveLively widget HTML, or "" when not configured or opted out. */
	giveLively: string;
	/** Liberapay static button HTML, or "" when not configured. Never suppressed by DNT/GPC. */
	liberapay: string;
	/** PledgeCrypto widget HTML, or "" when not configured or opted out. */
	pledgeCrypto: string;
	/** PledgeCrypto head `<script>` tag, or "" when not configured or opted out. */
	pledgeCryptoHeadScript: string;
	/** schema.org DonateAction JSON-LD block, or "" when no providers are configured. */
	jsonLd: string;
}

/**
 * Resolves donation widget snippets for all configured providers.
 *
 * GiveLively and PledgeCrypto snippets are suppressed when the visitor has
 * opted out of tracking (DNT: 1 or Sec-GPC: 1). Liberapay is static HTML
 * with no external JavaScript and is never suppressed.
 *
 * @param donations - The DonationsConfig from registerCms(), or undefined.
 * @param siteUrl - The canonical site URL, used in the JSON-LD DonateAction block.
 * @param optedOut - True when the visitor has sent DNT: 1 or Sec-GPC: 1.
 */
export function resolveDonationSnippets(
	donations: DonationsConfig | undefined,
	siteUrl: string,
	optedOut: boolean,
): DonationSnippets {
	const any = !!(
		donations?.giveLively ||
		donations?.liberapay ||
		donations?.pledgeCrypto
	);

	const giveLively =
		!optedOut && donations?.giveLively
			? buildGiveLivelySnippet(
					donations.giveLively.orgSlug,
					donations.giveLively.campaignSlug,
				)
			: "";

	const liberapay = donations?.liberapay
		? buildLiberapaySnippet(donations.liberapay.username)
		: "";

	const pledgeCrypto =
		!optedOut && donations?.pledgeCrypto
			? buildPledgeCryptoSnippet(donations.pledgeCrypto.partnerKey)
			: "";

	const pledgeCryptoHeadScript =
		!optedOut && donations?.pledgeCrypto
			? `<script src="https://widget.pledgecrypto.com/pledge-widget.js" defer></script>`
			: "";

	const donateUrl = `${siteUrl.replace(/\/$/, "")}/donate`;
	const jsonLd = any
		? JSON.stringify({
				"@context": "https://schema.org",
				"@type": "DonateAction",
				url: donateUrl,
				target: donateUrl,
			})
		: "";

	return {
		giveLively,
		liberapay,
		pledgeCrypto,
		pledgeCryptoHeadScript,
		jsonLd,
	};
}

function escAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;");
}

function buildGiveLivelySnippet(
	orgSlug: string,
	campaignSlug?: string,
): string {
	const identifier = escAttr(
		campaignSlug ? `${orgSlug}/${campaignSlug}` : `${orgSlug}/${orgSlug}`,
	);
	return [
		`<script src="https://assets.givelively.org/widget/simple_fundraiser.js" defer></script>`,
		`<div id="give-lively-widget" class="gl-simple-fundraiser-widget"`,
		`  data-campaign-identifier="${identifier}">`,
		"</div>",
	].join("\n");
}

function buildLiberapaySnippet(username: string): string {
	const safe = escAttr(username);
	return [
		`<a href="https://liberapay.com/${safe}/donate">`,
		`  <img alt="Donate using Liberapay"`,
		`    src="https://liberapay.com/assets/widgets/donate.svg">`,
		"</a>",
	].join("\n");
}

function buildPledgeCryptoSnippet(partnerKey: string): string {
	return `<div class="plg-donate" data-partner-key="${escAttr(partnerKey)}"></div>`;
}

/**
 * Returns a Record of env-example key/value pairs for the enabled donation providers.
 * Used by the scaffold to populate `.env.example`.
 */
export function buildDonationsEnvExample(
	donations: AstropressDonationsProviders | undefined,
): Record<string, string> {
	if (!donations) return {};
	const result: Record<string, string> = {};
	if (donations.giveLively) {
		result.GIVELIVELY_ORG_SLUG = "replace-with-your-org-slug";
		result.GIVELIVELY_CAMPAIGN_SLUG =
			"replace-with-your-campaign-slug-or-remove";
	}
	if (donations.liberapay) {
		result.LIBERAPAY_USERNAME = "replace-with-your-liberapay-username";
	}
	if (donations.pledgeCrypto) {
		result.PLEDGE_PARTNER_KEY = "[YOUR_PLEDGE_PARTNER_KEY]";
	}
	return result;
}
