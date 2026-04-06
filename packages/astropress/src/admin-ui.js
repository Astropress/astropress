import { peekCmsConfig } from "./config.js";
const defaultAdminUiConfig = {
  branding: {
    appName: "Astropress",
    productName: "Astropress Admin",
    shellName: "Astropress Admin",
    logoSrc: null,
    logoHref: "/wp-admin",
    logoAlt: "Astropress Admin",
    faviconHref: null,
    stylesheetHref: null
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
    backToLogin: "Back to admin login"
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
    settings: "Settings"
  }
};
function mergeWithDefaults() {
  const cmsConfig = peekCmsConfig();
  const admin = cmsConfig?.admin;
  return {
    branding: {
      ...defaultAdminUiConfig.branding,
      ...admin?.branding
    },
    labels: {
      ...defaultAdminUiConfig.labels,
      ...admin?.labels
    },
    navigation: {
      ...defaultAdminUiConfig.navigation,
      ...admin?.navigation
    }
  };
}
export function resolveAstropressAdminUiConfig() {
  const merged = mergeWithDefaults();
  return {
    branding: {
      ...merged.branding,
      shellName: merged.branding.shellName || merged.branding.productName,
      logoAlt: merged.branding.logoAlt || merged.branding.productName,
      logoHref: merged.branding.logoHref || "/wp-admin",
      stylesheetHref: merged.branding.stylesheetHref || null
    },
    labels: merged.labels,
    navigation: merged.navigation
  };
}
