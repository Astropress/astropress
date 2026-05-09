/**
 * astropress/web-components — registers all built-in custom elements.
 *
 * Import as a side-effect to register all elements at once:
 *   import "astropress/web-components";
 *
 * Or import individual elements:
 *   import "astropress/web-components/admin-nav";
 *   import "astropress/web-components/theme-toggle";
 *   import "astropress/web-components/confirm-dialog";
 *   import "astropress/web-components/html-editor";
 *   import "astropress/web-components/ap-stale-tab-warning";
 */

export { ApAdminNav } from "./admin-nav";
export { ApLockIndicator } from "./ap-lock-indicator";
export { ApStaleTabWarning } from "./ap-stale-tab-warning";
export { ApCommandPalette } from "./command-palette";
export { ApConfirmDialog } from "./confirm-dialog";
export { ApHtmlEditor } from "./html-editor";
export { ApMediaPicker } from "./media-picker";
export { ApNotice } from "./notice";
export { ApPagePreview } from "./page-preview";
export { ApPendingForm } from "./pending-form";
export { ApSectionEditor } from "./section-editor";
export { ApThemeToggle } from "./theme-toggle";
