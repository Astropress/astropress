/**
 * Static label-key tables consumed by `applyTranslations` in admin-ui.ts.
 *
 * Split out so the long lists of literal label/navigation key names live in
 * a pure-data file (excluded from mutation testing). Each tuple is
 * `[outputProperty, AdminLabelKey]`; `applyTranslations` iterates these and
 * fills the resolved labels/navigation maps via `getAdminLabel`.
 */

import type { AdminLabelKey } from "./admin-labels";

export const LABEL_TRANSLATION_KEYS: ReadonlyArray<
	readonly [string, AdminLabelKey]
> = [
	["sidebarTitle", "sidebarTitle"],
	["signedInAsPrefix", "signedInAsPrefix"],
	["signOut", "signOut"],
	["themeToggleDark", "themeToggleDark"],
	["themeToggleLight", "themeToggleLight"],
	["loginHeading", "loginHeading"],
	["loginDescription", "loginDescription"],
	["loginSubmit", "loginSubmit"],
	["loginEmailLabel", "loginEmailLabel"],
	["loginPasswordLabel", "loginPasswordLabel"],
	["forgotPassword", "forgotPassword"],
	["invalidCredentials", "invalidCredentials"],
	["rateLimited", "rateLimited"],
	["challengeRequired", "challengeRequired"],
	["passwordResetSuccess", "passwordResetSuccess"],
	["invitationAcceptedSuccess", "invitationAcceptedSuccess"],
	["acceptInvitationHeading", "acceptInvitationHeading"],
	["acceptInvitationDescription", "acceptInvitationDescription"],
	["acceptInvitationSubmit", "acceptInvitationSubmit"],
	["resetPasswordRequestHeading", "resetPasswordRequestHeading"],
	["resetPasswordRequestDescription", "resetPasswordRequestDescription"],
	["resetPasswordTokenHeading", "resetPasswordTokenHeading"],
	["resetPasswordTokenDescription", "resetPasswordTokenDescription"],
	["resetPasswordRequestSubmit", "resetPasswordRequestSubmit"],
	["resetPasswordTokenSubmit", "resetPasswordTokenSubmit"],
	["backToLogin", "backToLogin"],
	["changeLanguage", "changeLanguage"],
];

export const NAVIGATION_TRANSLATION_KEYS: ReadonlyArray<
	readonly [string, AdminLabelKey]
> = [
	["dashboard", "navDashboard"],
	["contentGroup", "navContentGroup"],
	["pages", "navPages"],
	["posts", "navPosts"],
	["authors", "navAuthors"],
	["taxonomies", "navTaxonomies"],
	["routePages", "navRoutePages"],
	["archives", "navArchives"],
	["users", "navUsers"],
	["access", "navAccess"],
	["media", "navMedia"],
	["comments", "navComments"],
	["redirects", "navRedirects"],
	["translations", "navTranslations"],
	["seo", "navSeo"],
	["system", "navSystem"],
	["settings", "navSettings"],
	["services", "navServices"],
	["fundraising", "navFundraising"],
	["testimonials", "navTestimonials"],
	["cms", "navCms"],
	["host", "navHost"],
	["groupSite", "navGroupSite"],
	["groupAudience", "navGroupAudience"],
	["groupDiscoverability", "navGroupDiscoverability"],
	["groupIntegrations", "navGroupIntegrations"],
	["groupAccess", "navGroupAccess"],
	["groupOperations", "navGroupOperations"],
	["forms", "navForms"],
	["headlessCmsPanel", "navHeadlessCmsPanel"],
	["subscribers", "navSubscribers"],
	["newsletter", "navNewsletter"],
	["events", "navEvents"],
	["reviews", "navReviews"],
	["referrals", "navReferrals"],
	["memberships", "navMemberships"],
	["community", "navCommunity"],
	["shop", "navShop"],
	["socialSyndication", "navSocialSyndication"],
	["structuredData", "navStructuredData"],
	["sitemaps", "navSitemaps"],
	["mapsLocal", "navMapsLocal"],
	["analytics", "navAnalytics"],
	["heatmaps", "navHeatmaps"],
	["abTesting", "navAbTesting"],
	["email", "navEmail"],
	["liveChat", "navLiveChat"],
	["imageCdn", "navImageCdn"],
	["search", "navSearch"],
	["cdnPurge", "navCdnPurge"],
	["monitoring", "navMonitoring"],
	["apiTokens", "navApiTokens"],
	["webhooks", "navWebhooks"],
	["deployHooks", "navDeployHooks"],
	["plugins", "navPlugins"],
	["data", "navData"],
	["backups", "navBackups"],
];
