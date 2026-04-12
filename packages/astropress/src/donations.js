export function resolveDonationSnippets(donations, siteUrl, optedOut) {
    const any = !!(donations?.giveLively || donations?.liberapay || donations?.pledgeCrypto);
    const giveLively = !optedOut && donations?.giveLively
        ? buildGiveLivelySnippet(donations.giveLively.orgSlug, donations.giveLively.campaignSlug)
        : "";
    const liberapay = donations?.liberapay
        ? buildLiberapaySnippet(donations.liberapay.username)
        : "";
    const pledgeCrypto = !optedOut && donations?.pledgeCrypto
        ? buildPledgeCryptoSnippet(donations.pledgeCrypto.partnerKey)
        : "";
    const pledgeCryptoHeadScript = !optedOut && donations?.pledgeCrypto
        ? `<script src="https://widget.pledgecrypto.com/pledge-widget.js" defer></script>`
        : "";
    const donateUrl = `${siteUrl.replace(/\/$/, "")}/donate`;
    const jsonLd = any
        ? JSON.stringify({
            "@context": "https://schema.org",
            "@type": "DonateAction",
            "url": donateUrl,
            "target": donateUrl,
        })
        : "";
    return { giveLively, liberapay, pledgeCrypto, pledgeCryptoHeadScript, jsonLd };
}
function escAttr(value) {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function buildGiveLivelySnippet(orgSlug, campaignSlug) {
    const identifier = escAttr(campaignSlug ? `${orgSlug}/${campaignSlug}` : `${orgSlug}/${orgSlug}`);
    return [
        `<script src="https://assets.givelively.org/widget/simple_fundraiser.js" defer></script>`,
        `<div id="give-lively-widget" class="gl-simple-fundraiser-widget"`,
        `  data-campaign-identifier="${identifier}">`,
        `</div>`,
    ].join("\n");
}
function buildLiberapaySnippet(username) {
    const safe = escAttr(username);
    return [
        `<a href="https://liberapay.com/${safe}/donate">`,
        `  <img alt="Donate using Liberapay"`,
        `    src="https://liberapay.com/assets/widgets/donate.svg">`,
        `</a>`,
    ].join("\n");
}
function buildPledgeCryptoSnippet(partnerKey) {
    return `<div class="plg-donate" data-partner-key="${escAttr(partnerKey)}"></div>`;
}
export function buildDonationsEnvExample(donations) {
    if (!donations) return {};
    const result = {};
    if (donations.giveLively) {
        result["GIVELIVELY_ORG_SLUG"] = "replace-with-your-org-slug";
        result["GIVELIVELY_CAMPAIGN_SLUG"] = "replace-with-your-campaign-slug-or-remove";
    }
    if (donations.liberapay) {
        result["LIBERAPAY_USERNAME"] = "replace-with-your-liberapay-username";
    }
    if (donations.pledgeCrypto) {
        result["PLEDGE_PARTNER_KEY"] = "[YOUR_PLEDGE_PARTNER_KEY]";
    }
    return result;
}
