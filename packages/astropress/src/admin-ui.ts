import { peekCmsConfig } from "./config";

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
  | "settings";

export interface AstropressResolvedAdminUiConfig {
  branding: {
    appName: string;
    productName: string;
    shellName: string;
    logoSrc: string | null;
    logoHref: string;
    logoAlt: string;
    faviconHref: string | null;
  };
  labels: {
    sidebarTitle: string;
    signedInAsPrefix: string;
    signOut: string;
    themeToggleDark: string;
    themeToggleLight: string;
    languageToggle: string;
    languageToggleTitle: string;
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
  };
  navigation: Record<AstropressAdminNavKey, string>;
}

const defaultAdminUiConfig: AstropressResolvedAdminUiConfig = {
  branding: {
    appName: "Astropress",
    productName: "Astropress Admin",
    shellName: "Astropress Admin",
    logoSrc: null,
    logoHref: "/wp-admin",
    logoAlt: "Astropress Admin",
    faviconHref: null,
  },
  labels: {
    sidebarTitle: "Workspace",
    signedInAsPrefix: "Signed in as",
    signOut: "Sign out",
    themeToggleDark: "Switch to dark mode",
    themeToggleLight: "Switch to light mode",
    languageToggle: "EN/ES",
    languageToggleTitle: "Bilingual admin interface coming in Phase 2",
    loginHeading: "Admin Login",
    loginDescription: "Use an authorized admin account to access the editorial workspace.",
    loginSubmit: "Sign in",
    loginEmailLabel: "Email",
    loginPasswordLabel: "Password",
    forgotPassword: "Forgot your password?",
    invalidCredentials: "The email or password was not recognized.",
    rateLimited: "Too many sign-in attempts. Wait a minute and try again.",
    challengeRequired: "Complete the security challenge and try signing in again.",
    passwordResetSuccess: "Your password was reset successfully. Sign in with the new password.",
    invitationAcceptedSuccess: "Your invitation was accepted successfully. Sign in with the new password.",
    acceptInvitationHeading: "Accept invitation",
    acceptInvitationDescription: "Set your password to activate this invited admin account.",
    acceptInvitationSubmit: "Accept invitation",
    resetPasswordRequestHeading: "Reset password",
    resetPasswordRequestDescription: "Enter your admin email address and we will issue a password reset link.",
    resetPasswordTokenHeading: "Choose a new password",
    resetPasswordTokenDescription: "Set a new password for this admin account.",
    resetPasswordRequestSubmit: "Issue reset link",
    resetPasswordTokenSubmit: "Save new password",
    backToLogin: "Back to admin login",
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

export function resolveAstropressAdminUiConfig(): AstropressResolvedAdminUiConfig {
  const merged = mergeWithDefaults();
  return {
    branding: {
      ...merged.branding,
      shellName: merged.branding.shellName || merged.branding.productName,
      logoAlt: merged.branding.logoAlt || merged.branding.productName,
      logoHref: merged.branding.logoHref || "/wp-admin",
    },
    labels: merged.labels,
    navigation: merged.navigation,
  };
}
