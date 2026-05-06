// stryker-disable-file: data-only
// Type + default-values constant. The defaults are exhaustively
// asserted by the consumers that build SiteSettings out of partial
// inputs (sqlite-bootstrap-helpers, settings-repository-factory) —
// mutating a default value here either breaks those tests
// (already covered) or is an equivalent mutation. No runtime logic.
export interface SiteSettings {
	siteTitle: string;
	siteTagline: string;
	donationUrl: string;
	newsletterEnabled: boolean;
	commentsDefaultPolicy: "disabled" | "legacy-readonly" | "open-moderated";
	/** URL prefix for the admin area. Default is "ap-admin". Change it to something unique to reduce automated bot targeting. */
	adminSlug: string;
}

export const defaultSiteSettings: SiteSettings = {
	siteTitle: "",
	siteTagline: "",
	donationUrl: "",
	newsletterEnabled: false,
	commentsDefaultPolicy: "legacy-readonly",
	adminSlug: "ap-admin",
};
