/**
 * Astropress Admin UI i18n groundwork.
 *
 * The admin UI strings are currently hardcoded in English in Astro templates.
 * This module provides a central string-key map that makes future translation
 * possible without requiring template changes — operators can pass a custom
 * `strings` override to `resolveAstropressAdminUiConfig` to localise labels.
 *
 * RTL limitation: see docs/DESIGN_SYSTEM.md for files that need
 * `margin-inline-start` conversions before RTL support can be added.
 */

/** All translatable string keys used in the Astropress admin UI. */
export type AstropressAdminStringKey =
  // Navigation
  | "nav.dashboard"
  | "nav.contentGroup"
  | "nav.pages"
  | "nav.posts"
  | "nav.authors"
  | "nav.taxonomies"
  | "nav.routePages"
  | "nav.archives"
  | "nav.users"
  | "nav.media"
  | "nav.comments"
  | "nav.redirects"
  | "nav.translations"
  | "nav.seo"
  | "nav.system"
  | "nav.settings"
  | "nav.services"
  | "nav.cms"
  | "nav.host"
  // Labels
  | "label.sidebarTitle"
  | "label.signedInAs"
  | "label.signOut"
  | "label.themeToggleDark"
  | "label.themeToggleLight"
  | "label.publish"
  | "label.openNav"
  | "label.closeNav"
  // Status values
  | "status.draft"
  | "status.published"
  | "status.archived"
  | "status.review"
  // Actions
  | "action.save"
  | "action.delete"
  | "action.cancel"
  | "action.confirm"
  | "action.preview"
  // Error messages
  | "error.required"
  | "error.invalidEmail"
  | "error.passwordTooShort"
  | "error.invalidSlug"
  | "error.generic";

/** Default English strings for every key. */
export const defaultAdminStrings: Record<AstropressAdminStringKey, string> = {
  "nav.dashboard": "Dashboard",
  "nav.contentGroup": "Content",
  "nav.pages": "Pages",
  "nav.posts": "Posts",
  "nav.authors": "Authors",
  "nav.taxonomies": "Taxonomies",
  "nav.routePages": "Route pages",
  "nav.archives": "Archives",
  "nav.users": "Users",
  "nav.media": "Media",
  "nav.comments": "Comments",
  "nav.redirects": "Redirects",
  "nav.translations": "Translations",
  "nav.seo": "SEO",
  "nav.system": "System",
  "nav.settings": "Settings",
  "nav.services": "Services",
  "nav.cms": "CMS",
  "nav.host": "Host",
  "label.sidebarTitle": "Admin",
  "label.signedInAs": "Signed in as",
  "label.signOut": "Sign out",
  "label.themeToggleDark": "Switch to dark mode",
  "label.themeToggleLight": "Switch to light mode",
  "label.publish": "Publish",
  "label.openNav": "Open navigation",
  "label.closeNav": "Close navigation",
  "status.draft": "Draft",
  "status.published": "Published",
  "status.archived": "Archived",
  "status.review": "In review",
  "action.save": "Save",
  "action.delete": "Delete",
  "action.cancel": "Cancel",
  "action.confirm": "Confirm",
  "action.preview": "Preview",
  "error.required": "This field is required.",
  "error.invalidEmail": "Enter a valid email address.",
  "error.passwordTooShort": "Password must be at least 12 characters.",
  "error.invalidSlug": "Slug must contain only lowercase letters, numbers, and hyphens.",
  "error.generic": "Something went wrong. Please try again.",
};

/** A partial override map — only the keys you want to translate. */
export type AstropressAdminStringOverrides = Partial<Record<AstropressAdminStringKey, string>>;

/**
 * Resolves a complete string map by merging operator overrides over the English defaults.
 *
 * @param overrides  Optional partial map of key → localised string.
 * @returns          A complete map of all admin UI string keys.
 */
export function resolveAdminStrings(
  overrides?: AstropressAdminStringOverrides,
): Record<AstropressAdminStringKey, string> {
  if (!overrides) return defaultAdminStrings;
  return { ...defaultAdminStrings, ...overrides };
}
