import { peekCmsConfig } from "./config.js";

export const adminLabels = {
  en: {
    loginHeading: "Sign in to the admin",
    themeToggleDark: "Switch to dark mode",
    themeToggleLight: "Switch to light mode",
    saveButton: "Save",
    publishButton: "Publish",
    discardButton: "Discard",
    deleteButton: "Delete",
    cancelButton: "Cancel",
    signOut: "Sign out",
    sidebarTitle: "Workspace",
  },
  es: {
    loginHeading: "Acceder al panel de administración",
    themeToggleDark: "Cambiar a modo oscuro",
    themeToggleLight: "Cambiar a modo claro",
    saveButton: "Guardar",
    publishButton: "Publicar",
    discardButton: "Descartar",
    deleteButton: "Eliminar",
    cancelButton: "Cancelar",
    signOut: "Cerrar sesión",
    sidebarTitle: "Espacio de trabajo",
  },
  fr: {
    loginHeading: "Se connecter à l'administration",
    themeToggleDark: "Passer en mode sombre",
    themeToggleLight: "Passer en mode clair",
    saveButton: "Enregistrer",
    publishButton: "Publier",
    discardButton: "Ignorer",
    deleteButton: "Supprimer",
    cancelButton: "Annuler",
    signOut: "Se déconnecter",
    sidebarTitle: "Espace de travail",
  },
  de: {
    loginHeading: "Beim Admin anmelden",
    themeToggleDark: "Zum Dunkelmodus wechseln",
    themeToggleLight: "Zum Hellmodus wechseln",
    saveButton: "Speichern",
    publishButton: "Veröffentlichen",
    discardButton: "Verwerfen",
    deleteButton: "Löschen",
    cancelButton: "Abbrechen",
    signOut: "Abmelden",
    sidebarTitle: "Arbeitsbereich",
  },
  pt: {
    loginHeading: "Entrar no painel de administração",
    themeToggleDark: "Mudar para modo escuro",
    themeToggleLight: "Mudar para modo claro",
    saveButton: "Salvar",
    publishButton: "Publicar",
    discardButton: "Descartar",
    deleteButton: "Excluir",
    cancelButton: "Cancelar",
    signOut: "Sair",
    sidebarTitle: "Área de trabalho",
  },
  ja: {
    loginHeading: "管理パネルにサインイン",
    themeToggleDark: "ダークモードに切り替え",
    themeToggleLight: "ライトモードに切り替え",
    saveButton: "保存",
    publishButton: "公開",
    discardButton: "破棄",
    deleteButton: "削除",
    cancelButton: "キャンセル",
    signOut: "サインアウト",
    sidebarTitle: "ワークスペース",
  },
};

export function getAdminLabel(key, locale) {
  const configLocale = peekCmsConfig()?.locales?.[0] ?? "en";
  const resolvedLocale = (locale ?? configLocale).split("-")[0];
  const map = adminLabels[resolvedLocale] ?? adminLabels.en;
  return (map[key] ?? adminLabels.en[key]) || key;
}
const defaultAdminUiConfig = {
  branding: {
    appName: "Astropress",
    productName: "Astropress Admin",
    shellName: "Astropress Admin",
    logoSrc: null,
    logoHref: "/ap-admin",
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
    settings: "Settings",
    services: "Services",
    cms: "CMS",
    host: "Host"
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
/**
 * Merge host-provided CMS config with Astropress defaults to produce a complete
 * admin UI configuration object ready for use in admin layout templates.
 *
 * @example
 * ```ts
 * import { resolveAstropressAdminUiConfig } from "astropress";
 *
 * const { branding, labels, navigation } = resolveAstropressAdminUiConfig();
 * console.log(branding.appName); // "Astropress" or host-overridden value
 * ```
 */
export function resolveAstropressAdminUiConfig() {
  const merged = mergeWithDefaults();
  return {
    branding: {
      ...merged.branding,
      shellName: merged.branding.shellName || merged.branding.productName,
      logoAlt: merged.branding.logoAlt || merged.branding.productName,
      logoHref: merged.branding.logoHref || "/ap-admin",
      stylesheetHref: merged.branding.stylesheetHref || null
    },
    labels: merged.labels,
    navigation: merged.navigation
  };
}
