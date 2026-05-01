import {
	type AdminLabelKey,
	type AdminLocale,
	adminLabels,
} from "./admin-labels";
import { peekCmsConfig } from "./config";
export type { AdminLocale, AdminLabelKey } from "./admin-labels";
export { adminLabels } from "./admin-labels";

// ---------------------------------------------------------------------------
// Multi-locale admin label resolver + admin UI config
// ---------------------------------------------------------------------------

/**
 * Resolve a localised admin UI label.
 *
 * Falls back through: `locale` -> first site locale from config -> `"en"`.
 * Unknown keys return `key` so missing translations are visible rather than blank.
 *
 * @param key    The label key (e.g. `"saveButton"`).
 * @param locale Optional BCP-47 locale tag. When omitted the first locale from
 *               `getCmsConfig().locales` is used, falling back to `"en"`.
 */
export function getAdminLabel(key: AdminLabelKey, locale?: string): string {
	const configLocale = peekCmsConfig()?.locales?.[0] ?? "en";
	const resolvedLocale = (locale ?? configLocale).split("-")[0] as AdminLocale;
	const map = adminLabels[resolvedLocale] ?? adminLabels.en;
	return (map[key] ?? adminLabels.en[key]) || key;
}

export type AstropressAdminNavKey =
	| "dashboard"
	| "contentGroup"
	| "pages"
	| "posts"
	| "authors"
	| "taxonomies"
	| "routePages"
	| "archives"
	| "users"
	| "access"
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
	// Group labels
	| "groupSite"
	| "groupAudience"
	| "groupDiscoverability"
	| "groupIntegrations"
	| "groupComingSoon"
	| "groupAccess"
	| "groupOperations"
	// Site
	| "forms"
	// Content
	| "headlessCmsPanel"
	// Audience
	| "subscribers"
	| "newsletter"
	| "events"
	| "reviews"
	| "referrals"
	| "memberships"
	| "community"
	| "shop"
	| "socialSyndication"
	// Discoverability
	| "structuredData"
	| "sitemaps"
	| "mapsLocal"
	// Integrations
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
	// Operations
	| "data"
	| "backups";

export interface AstropressResolvedAdminUiConfig {
	branding: {
		appName: string;
		productName: string;
		shellName: string;
		logoSrc: string | null;
		logoHref: string;
		logoAlt: string;
		faviconHref: string | null;
		stylesheetHref: string | null;
	};
	labels: {
		sidebarTitle: string;
		signedInAsPrefix: string;
		signOut: string;
		themeToggleDark: string;
		themeToggleLight: string;
		loginHeading: string;
		loginDescription: string;
		loginSubmit: string;
		loginEmailLabel: string;
		loginPasswordLabel: string;
		forgotPassword: string;
		invalidCredentials: string;
		rateLimited: string;
		challengeRequired: string;
		passwordResetSuccess: string;
		invitationAcceptedSuccess: string;
		acceptInvitationHeading: string;
		acceptInvitationDescription: string;
		acceptInvitationSubmit: string;
		resetPasswordRequestHeading: string;
		resetPasswordRequestDescription: string;
		resetPasswordTokenHeading: string;
		resetPasswordTokenDescription: string;
		resetPasswordRequestSubmit: string;
		resetPasswordTokenSubmit: string;
		backToLogin: string;
		changeLanguage: string;
	};
	navigation: Record<AstropressAdminNavKey, string>;
}

const defaultAdminUiConfig: AstropressResolvedAdminUiConfig = {
	branding: {
		appName: "Astropress",
		productName: "Astropress Admin",
		shellName: "Astropress Admin",
		logoSrc: null,
		logoHref: "/ap-admin",
		logoAlt: "Astropress Admin",
		faviconHref: null,
		stylesheetHref: null,
	},
	labels: {
		sidebarTitle: "Workspace",
		signedInAsPrefix: "Signed in as",
		signOut: "Sign out",
		themeToggleDark: "Switch to dark mode",
		themeToggleLight: "Switch to light mode",
		loginHeading: "Sign in to the admin",
		loginDescription:
			"Use an approved admin account to manage content, media, redirects, and publishing settings.",
		loginSubmit: "Sign in",
		loginEmailLabel: "Email address",
		loginPasswordLabel: "Password",
		forgotPassword: "Forgot your password?",
		invalidCredentials:
			"That email and password combination was not recognized.",
		rateLimited:
			"Too many sign-in attempts were recorded. Wait a minute and try again.",
		challengeRequired:
			"Complete the security challenge and try signing in again.",
		passwordResetSuccess:
			"Your password was reset successfully. Sign in with the new password.",
		invitationAcceptedSuccess:
			"Your invitation was accepted successfully. Sign in with the new password.",
		acceptInvitationHeading: "Accept invitation",
		acceptInvitationDescription:
			"Set a password to activate this invited admin account.",
		acceptInvitationSubmit: "Accept invitation",
		resetPasswordRequestHeading: "Reset password",
		resetPasswordRequestDescription:
			"Enter your admin email address and Astropress will issue a password reset link if the account exists.",
		resetPasswordTokenHeading: "Choose a new password",
		resetPasswordTokenDescription: "Set a new password for this admin account.",
		resetPasswordRequestSubmit: "Issue reset link",
		resetPasswordTokenSubmit: "Save new password",
		backToLogin: "Back to admin login",
		changeLanguage: "Change language",
	},
	navigation: {
		dashboard: "Dashboard",
		contentGroup: "Content",
		pages: "Pages",
		posts: "Posts",
		authors: "Authors",
		taxonomies: "Categories & Tags",
		routePages: "Route Table",
		archives: "Archives",
		users: "Users",
		access: "Access",
		media: "Media",
		comments: "Comments",
		redirects: "Redirects",
		translations: "Translations",
		seo: "SEO",
		system: "System",
		settings: "Settings",
		services: "Services",
		fundraising: "Fundraising",
		testimonials: "Testimonials",
		cms: "CMS",
		host: "Host",
		groupSite: "Site",
		groupAudience: "Audience",
		groupDiscoverability: "Discoverability",
		groupIntegrations: "Integrations",
		groupComingSoon: "Coming soon",
		groupAccess: "Access",
		groupOperations: "Operations",
		forms: "Forms",
		headlessCmsPanel: "Headless CMS Panel",
		subscribers: "Subscribers",
		newsletter: "Newsletter",
		events: "Events",
		reviews: "Reviews",
		referrals: "Referrals",
		memberships: "Memberships",
		community: "Community",
		shop: "Shop",
		socialSyndication: "Social Syndication",
		structuredData: "Structured Data / AEO",
		sitemaps: "Sitemaps",
		mapsLocal: "Maps & Local",
		analytics: "Analytics",
		heatmaps: "Heatmaps & Session Replay",
		abTesting: "A/B Testing & Feature Flags",
		email: "Email",
		liveChat: "Live Chat",
		imageCdn: "Image CDN",
		search: "Search",
		cdnPurge: "CDN Purge",
		monitoring: "Monitoring",
		apiTokens: "API Tokens",
		webhooks: "Webhooks",
		deployHooks: "Deploy Hooks",
		plugins: "Plugins",
		data: "Data",
		backups: "Backups",
	},
};

function mergeWithDefaults() {
	const cmsConfig = peekCmsConfig();
	const admin = cmsConfig?.admin;

	return {
		branding: {
			...defaultAdminUiConfig.branding,
			...admin?.branding,
		},
		labels: {
			...defaultAdminUiConfig.labels,
			...admin?.labels,
		},
		navigation: {
			...defaultAdminUiConfig.navigation,
			...admin?.navigation,
		},
	} satisfies AstropressResolvedAdminUiConfig;
}

/**
 * Merge host-provided CMS config with Astropress defaults to produce a complete
 * admin UI configuration object ready for use in admin layout templates.
 *
 * @example
 * ```ts
 * import { resolveAstropressAdminUiConfig } from "@astropress-diy/astropress";
 *
 * const { branding, labels, navigation } = resolveAstropressAdminUiConfig();
 * console.log(branding.appName); // "Astropress" or host-overridden value
 * ```
 */
export function resolveAstropressAdminUiConfig(
	locale?: AdminLocale,
): AstropressResolvedAdminUiConfig {
	const merged = mergeWithDefaults();
	const translated = locale ? applyTranslations(merged, locale) : merged;
	return {
		branding: {
			...translated.branding,
			shellName:
				translated.branding.shellName || translated.branding.productName,
			logoAlt: translated.branding.logoAlt || translated.branding.productName,
			logoHref: translated.branding.logoHref || "/ap-admin",
			stylesheetHref: translated.branding.stylesheetHref || null,
		},
		labels: translated.labels,
		navigation: translated.navigation,
	};
}

function applyTranslations(
	merged: AstropressResolvedAdminUiConfig,
	locale: AdminLocale,
): AstropressResolvedAdminUiConfig {
	// Pull every value through getAdminLabel so missing keys fall back to
	// English instead of "undefined" — this is the i18n leak guard.
	const tr = (key: AdminLabelKey, fallback: string): string =>
		getAdminLabel(key, locale) || fallback;
	return {
		branding: merged.branding,
		labels: {
			...merged.labels,
			sidebarTitle: tr("sidebarTitle", merged.labels.sidebarTitle),
			signedInAsPrefix: tr("signedInAsPrefix", merged.labels.signedInAsPrefix),
			signOut: tr("signOut", merged.labels.signOut),
			themeToggleDark: tr("themeToggleDark", merged.labels.themeToggleDark),
			themeToggleLight: tr("themeToggleLight", merged.labels.themeToggleLight),
			loginHeading: tr("loginHeading", merged.labels.loginHeading),
			loginDescription: tr("loginDescription", merged.labels.loginDescription),
			loginSubmit: tr("loginSubmit", merged.labels.loginSubmit),
			loginEmailLabel: tr("loginEmailLabel", merged.labels.loginEmailLabel),
			loginPasswordLabel: tr(
				"loginPasswordLabel",
				merged.labels.loginPasswordLabel,
			),
			forgotPassword: tr("forgotPassword", merged.labels.forgotPassword),
			invalidCredentials: tr(
				"invalidCredentials",
				merged.labels.invalidCredentials,
			),
			rateLimited: tr("rateLimited", merged.labels.rateLimited),
			challengeRequired: tr(
				"challengeRequired",
				merged.labels.challengeRequired,
			),
			passwordResetSuccess: tr(
				"passwordResetSuccess",
				merged.labels.passwordResetSuccess,
			),
			invitationAcceptedSuccess: tr(
				"invitationAcceptedSuccess",
				merged.labels.invitationAcceptedSuccess,
			),
			acceptInvitationHeading: tr(
				"acceptInvitationHeading",
				merged.labels.acceptInvitationHeading,
			),
			acceptInvitationDescription: tr(
				"acceptInvitationDescription",
				merged.labels.acceptInvitationDescription,
			),
			acceptInvitationSubmit: tr(
				"acceptInvitationSubmit",
				merged.labels.acceptInvitationSubmit,
			),
			resetPasswordRequestHeading: tr(
				"resetPasswordRequestHeading",
				merged.labels.resetPasswordRequestHeading,
			),
			resetPasswordRequestDescription: tr(
				"resetPasswordRequestDescription",
				merged.labels.resetPasswordRequestDescription,
			),
			resetPasswordTokenHeading: tr(
				"resetPasswordTokenHeading",
				merged.labels.resetPasswordTokenHeading,
			),
			resetPasswordTokenDescription: tr(
				"resetPasswordTokenDescription",
				merged.labels.resetPasswordTokenDescription,
			),
			resetPasswordRequestSubmit: tr(
				"resetPasswordRequestSubmit",
				merged.labels.resetPasswordRequestSubmit,
			),
			resetPasswordTokenSubmit: tr(
				"resetPasswordTokenSubmit",
				merged.labels.resetPasswordTokenSubmit,
			),
			backToLogin: tr("backToLogin", merged.labels.backToLogin),
			changeLanguage: tr("changeLanguage", merged.labels.changeLanguage),
		},
		navigation: {
			...merged.navigation,
			dashboard: tr("navDashboard", merged.navigation.dashboard),
			contentGroup: tr("navContentGroup", merged.navigation.contentGroup),
			pages: tr("navPages", merged.navigation.pages),
			posts: tr("navPosts", merged.navigation.posts),
			authors: tr("navAuthors", merged.navigation.authors),
			taxonomies: tr("navTaxonomies", merged.navigation.taxonomies),
			routePages: tr("navRoutePages", merged.navigation.routePages),
			archives: tr("navArchives", merged.navigation.archives),
			users: tr("navUsers", merged.navigation.users),
			access: tr("navAccess", merged.navigation.access),
			media: tr("navMedia", merged.navigation.media),
			comments: tr("navComments", merged.navigation.comments),
			redirects: tr("navRedirects", merged.navigation.redirects),
			translations: tr("navTranslations", merged.navigation.translations),
			seo: tr("navSeo", merged.navigation.seo),
			system: tr("navSystem", merged.navigation.system),
			settings: tr("navSettings", merged.navigation.settings),
			services: tr("navServices", merged.navigation.services),
			fundraising: tr("navFundraising", merged.navigation.fundraising),
			testimonials: tr("navTestimonials", merged.navigation.testimonials),
			cms: tr("navCms", merged.navigation.cms),
			host: tr("navHost", merged.navigation.host),
			groupSite: tr("navGroupSite", merged.navigation.groupSite),
			groupAudience: tr("navGroupAudience", merged.navigation.groupAudience),
			groupDiscoverability: tr(
				"navGroupDiscoverability",
				merged.navigation.groupDiscoverability,
			),
			groupIntegrations: tr(
				"navGroupIntegrations",
				merged.navigation.groupIntegrations,
			),
			groupComingSoon: tr(
				"navGroupComingSoon",
				merged.navigation.groupComingSoon,
			),
			groupAccess: tr("navGroupAccess", merged.navigation.groupAccess),
			groupOperations: tr(
				"navGroupOperations",
				merged.navigation.groupOperations,
			),
			forms: tr("navForms", merged.navigation.forms),
			headlessCmsPanel: tr(
				"navHeadlessCmsPanel",
				merged.navigation.headlessCmsPanel,
			),
			subscribers: tr("navSubscribers", merged.navigation.subscribers),
			newsletter: tr("navNewsletter", merged.navigation.newsletter),
			events: tr("navEvents", merged.navigation.events),
			reviews: tr("navReviews", merged.navigation.reviews),
			referrals: tr("navReferrals", merged.navigation.referrals),
			memberships: tr("navMemberships", merged.navigation.memberships),
			community: tr("navCommunity", merged.navigation.community),
			shop: tr("navShop", merged.navigation.shop),
			socialSyndication: tr(
				"navSocialSyndication",
				merged.navigation.socialSyndication,
			),
			structuredData: tr("navStructuredData", merged.navigation.structuredData),
			sitemaps: tr("navSitemaps", merged.navigation.sitemaps),
			mapsLocal: tr("navMapsLocal", merged.navigation.mapsLocal),
			analytics: tr("navAnalytics", merged.navigation.analytics),
			heatmaps: tr("navHeatmaps", merged.navigation.heatmaps),
			abTesting: tr("navAbTesting", merged.navigation.abTesting),
			email: tr("navEmail", merged.navigation.email),
			liveChat: tr("navLiveChat", merged.navigation.liveChat),
			imageCdn: tr("navImageCdn", merged.navigation.imageCdn),
			search: tr("navSearch", merged.navigation.search),
			cdnPurge: tr("navCdnPurge", merged.navigation.cdnPurge),
			monitoring: tr("navMonitoring", merged.navigation.monitoring),
			apiTokens: tr("navApiTokens", merged.navigation.apiTokens),
			webhooks: tr("navWebhooks", merged.navigation.webhooks),
			deployHooks: tr("navDeployHooks", merged.navigation.deployHooks),
			plugins: tr("navPlugins", merged.navigation.plugins),
			data: tr("navData", merged.navigation.data),
			backups: tr("navBackups", merged.navigation.backups),
		},
	};
}
