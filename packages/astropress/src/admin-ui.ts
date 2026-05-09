import { type AdminLabelKey, type AdminLocale, adminLabels } from "./admin-labels";
import { defaultAdminUiConfig } from "./admin-ui-defaults";
import { LABEL_TRANSLATION_KEYS, NAVIGATION_TRANSLATION_KEYS } from "./admin-ui-translation-keys";
import { peekCmsConfig } from "./config";

export type { AdminLabelKey, AdminLocale } from "./admin-labels";
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
			shellName: translated.branding.shellName || translated.branding.productName,
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
	// English instead of "undefined" — this is the i18n leak guard. The
	// per-property key tables live in admin-ui-translation-keys.ts so the
	// mutation surface in this file stays focused on logic rather than the
	// long list of literal key names.
	const tr = (key: AdminLabelKey, fallback: string): string =>
		getAdminLabel(key, locale) || fallback;
	const labels = { ...merged.labels } as Record<string, string>;
	for (const [outKey, labelKey] of LABEL_TRANSLATION_KEYS) {
		labels[outKey] = tr(labelKey, labels[outKey] ?? "");
	}
	const navigation = { ...merged.navigation } as Record<string, string>;
	for (const [outKey, labelKey] of NAVIGATION_TRANSLATION_KEYS) {
		navigation[outKey] = tr(labelKey, navigation[outKey] ?? "");
	}
	return {
		branding: merged.branding,
		labels: labels as AstropressResolvedAdminUiConfig["labels"],
		navigation: navigation as AstropressResolvedAdminUiConfig["navigation"],
	};
}
