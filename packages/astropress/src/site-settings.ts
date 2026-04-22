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
