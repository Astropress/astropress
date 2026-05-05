// stryker-disable-file: data-only — pure interface declarations; no runtime code.
// Admin-shell customization shape for CmsConfig. Extracted from config.ts
// to keep that file under the 400-line arch-lint warning.

export interface CmsAdminBranding {
	appName?: string;
	productName?: string;
	shellName?: string;
	logoSrc?: string;
	logoHref?: string;
	logoAlt?: string;
	faviconHref?: string;
	stylesheetHref?: string;
}

export interface CmsAdminLabels {
	sidebarTitle?: string;
	signedInAsPrefix?: string;
	signOut?: string;
	themeToggleDark?: string;
	themeToggleLight?: string;
	languageToggle?: string;
	languageToggleTitle?: string;
	loginHeading?: string;
	loginDescription?: string;
	loginSubmit?: string;
	loginEmailLabel?: string;
	loginPasswordLabel?: string;
	forgotPassword?: string;
	invalidCredentials?: string;
	rateLimited?: string;
	challengeRequired?: string;
	passwordResetSuccess?: string;
	invitationAcceptedSuccess?: string;
	acceptInvitationHeading?: string;
	acceptInvitationDescription?: string;
	acceptInvitationSubmit?: string;
	resetPasswordRequestHeading?: string;
	resetPasswordRequestDescription?: string;
	resetPasswordTokenHeading?: string;
	resetPasswordTokenDescription?: string;
	resetPasswordRequestSubmit?: string;
	resetPasswordTokenSubmit?: string;
	backToLogin?: string;
}

export type CmsAdminNavigationKey =
	| "dashboard"
	| "contentGroup"
	| "pages"
	| "posts"
	| "authors"
	| "taxonomies"
	| "routePages"
	| "archives"
	| "users"
	| "media"
	| "comments"
	| "redirects"
	| "translations"
	| "seo"
	| "system"
	| "settings"
	| "services"
	| "fundraising"
	| "testimonials"
	| "cms"
	| "host"
	| "groupSite"
	| "groupAudience"
	| "groupDiscoverability"
	| "groupIntegrations"
	| "groupAccess"
	| "groupOperations"
	| "forms"
	| "headlessCmsPanel"
	| "subscribers"
	| "newsletter"
	| "events"
	| "reviews"
	| "referrals"
	| "memberships"
	| "community"
	| "shop"
	| "socialSyndication"
	| "structuredData"
	| "sitemaps"
	| "mapsLocal"
	| "analytics"
	| "heatmaps"
	| "abTesting"
	| "email"
	| "liveChat"
	| "imageCdn"
	| "search"
	| "cdnPurge"
	| "monitoring"
	| "apiTokens"
	| "webhooks"
	| "deployHooks"
	| "plugins"
	| "data"
	| "backups";

export interface CmsAdminConfig {
	branding?: CmsAdminBranding;
	labels?: CmsAdminLabels;
	navigation?: Partial<Record<CmsAdminNavigationKey, string>>;
}
