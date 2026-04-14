import { peekCmsConfig } from "./config";
import { adminLabels } from "./admin-labels";
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
  | "host";

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
    loginDescription: "Use an approved admin account to manage content, media, redirects, and publishing settings.",
    loginSubmit: "Sign in",
    loginEmailLabel: "Email address",
    loginPasswordLabel: "Password",
    forgotPassword: "Forgot your password?",
    invalidCredentials: "That email and password combination was not recognized.",
    rateLimited: "Too many sign-in attempts were recorded. Wait a minute and try again.",
    challengeRequired: "Complete the security challenge and try signing in again.",
    passwordResetSuccess: "Your password was reset successfully. Sign in with the new password.",
    invitationAcceptedSuccess: "Your invitation was accepted successfully. Sign in with the new password.",
    acceptInvitationHeading: "Accept invitation",
    acceptInvitationDescription: "Set a password to activate this invited admin account.",
    acceptInvitationSubmit: "Accept invitation",
    resetPasswordRequestHeading: "Reset password",
    resetPasswordRequestDescription: "Enter your admin email address and Astropress will issue a password reset link if the account exists.",
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
export function resolveAstropressAdminUiConfig(): AstropressResolvedAdminUiConfig {
  const merged = mergeWithDefaults();
  return {
    branding: {
      ...merged.branding,
      shellName: merged.branding.shellName || merged.branding.productName,
      logoAlt: merged.branding.logoAlt || merged.branding.productName,
      logoHref: merged.branding.logoHref || "/ap-admin",
      stylesheetHref: merged.branding.stylesheetHref || null,
    },
    labels: merged.labels,
    navigation: merged.navigation,
  };
}
