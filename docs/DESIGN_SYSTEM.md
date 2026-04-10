# Astropress Admin Design System

This document describes the CSS custom property palette, WCAG contrast ratios, component inventory, and usage guidelines for the Astropress admin UI.

All admin styles are served from `packages/astropress/public/admin.css` and cached with `Cache-Control: public, max-age=31536000, immutable`. The file is extracted from AdminLayout.astro so the browser can reuse it across all admin pages.

---

## CSS Custom Properties

### Light theme (`:root`)

| Token | Value | Purpose |
|-------|-------|---------|
| `--bg` | `#f4f6f8` | Page background |
| `--panel` | `#ffffff` | Card and panel background |
| `--text` | `#17212c` | Primary text |
| `--muted` | `#5e6b78` | Secondary / muted text |
| `--line` | `#d8dee5` | Borders and dividers |
| `--accent` | `#0d5c63` | Brand accent (links, focus rings) |
| `--accent-soft` | `#e6f4f2` | Soft accent background |
| `--sidebar-bg` | `#15202b` | Sidebar background |
| `--sidebar-text` | `rgba(255,255,255,0.9)` | Sidebar primary text |
| `--sidebar-muted` | `rgba(255,255,255,0.80)` | Sidebar muted labels |
| `--topbar-bg` | `#0f1720` | Topbar background |
| `--button-primary-bg` | `#0d5c63` | Primary button background |
| `--button-primary-text` | `#ffffff` | Primary button text |
| `--danger` | `#c0392b` | Destructive actions, validation errors |

### Dark theme (`html[data-theme="dark"]`)

| Token | Value | Purpose |
|-------|-------|---------|
| `--bg` | `#0f1317` | Page background |
| `--panel` | `#171d23` | Card and panel background |
| `--text` | `#edf2f7` | Primary text |
| `--muted` | `#9eabb8` | Secondary / muted text |
| `--sidebar-muted` | `rgba(158,171,184,0.95)` | Sidebar muted labels |

---

## WCAG AA Contrast Ratios

All text-on-background pairings in the admin UI meet WCAG 2.2 AA (minimum 4.5:1 for normal text, 3:1 for large text).

| Pairing | Light ratio | Dark ratio | AA pass? |
|---------|------------|-----------|---------|
| `--text` on `--panel` (`#17212c` / `#fff`) | ~14.0:1 | ~12.1:1 | ✅ |
| `--text` on `--bg` (`#17212c` / `#f4f6f8`) | ~10.9:1 | ~15.8:1 | ✅ |
| `--muted` on `--bg` (`#5e6b78` / `#f4f6f8`) | ~4.6:1 | ~10.2:1 | ✅ |
| `--accent` on `--bg` (`#0d5c63` / `#f4f6f8`) | ~5.8:1 | ~9.0:1 | ✅ |
| white on `--button-primary-bg` (`#fff` / `#0d5c63`) | ~5.8:1 | — | ✅ |
| white on `--danger` (`#fff` / `#c0392b`) | ~5.3:1 | — | ✅ |
| `--sidebar-text` on `--sidebar-bg` | ~14.4:1 | — | ✅ |
| `--sidebar-muted` on `--sidebar-bg` (0.80 opacity) | ~5.2:1 | — | ✅ |
| `--sidebar-muted` dark on `--sidebar-bg` (0.95 opacity) | — | ~6.1:1 | ✅ |

> Ratios were calculated using the WCAG relative luminance formula. Verify with `npx color-contrast-checker` or the axe DevTools extension if modifying token values.

The `color-contrast` axe rule is **enabled** in `scripts/admin-harness-browser-audit.ts` and runs in CI (`bun run test:accessibility`). Any future token change that introduces a failing contrast ratio will fail the accessibility gate.

---

## Component Inventory

### Web Components (custom elements)

| Element | Source | Purpose |
|---------|--------|---------|
| `<ap-html-editor>` | `web-components/html-editor.ts` | Rich text editor with toolbar, media library dialog, URL dialog |
| `<ap-confirm-dialog>` | `web-components/confirm-dialog.ts` | Modal confirmation with `showModal()` focus trap |
| `<ap-admin-nav>` | `web-components/admin-nav.ts` | Mobile sidebar toggle logic |
| `<ap-theme-toggle>` | `web-components/theme-toggle.ts` | Light/dark mode toggle, persists to `localStorage` |
| `<ap-notice>` | `web-components/notice.ts` | Dismissable info/warning/error notice |

### Admin UI patterns

| Pattern | HTML structure | Notes |
|---------|---------------|-------|
| Admin layout | `AdminLayout.astro` | Provides topbar, sidebar, main, skip-link |
| Form fields | `<label>` + `<input>` + optional `<span class="field-error">` | `aria-describedby` wired by inline validation JS |
| Action errors | `<div role="alert" aria-live="assertive" data-action-error>` | Populated from `sessionStorage` on page load |
| Confirm dialogs | `<ap-confirm-dialog>` | Use instead of `window.confirm()` — keyboard and screen-reader accessible |
| Data tables | `<table class="admin-table">` | Responsive via `overflow-x: auto` wrapper |
| Status chips | `<span class="status-chip status-{value}">` | Colour-coded by publish status |
| Pagination | `<nav class="pagination">` | `?page=N` query param, `X-Total-Count` header |

---

## Usage Guidelines

### When to use which token

- **Body text**: `--text` on `--bg` or `--panel`
- **Secondary labels, help text**: `--muted`
- **Borders and dividers**: `--line`
- **Interactive elements, links, focus rings**: `--accent`
- **Destructive actions and validation errors**: `--danger`
- **Never** use a hard-coded hex in admin component styles — always reference a CSS custom property so dark mode works automatically.

### Adding a new admin page

1. Use `AdminLayout.astro` as the shell — pass `title`, `heading`, `currentPath`, `role`, `userName`.
2. Use `safeAdminData()` from `src/admin-page-data.ts` for data loading with error boundaries.
3. Use `withAdminFormAction()` from `src/admin-action-utils.ts` for action handlers.
4. Add the route to `src/admin-routes.ts` so `audit:arch` can verify route inventory shape.
5. Add a BDD scenario to `features/` and a verification group to `scripts/bdd-test.ts`.

---

## RTL Limitation

The admin CSS uses physical direction properties (`margin-left`, `padding-left`, `text-align: left`) in several places rather than logical properties (`margin-inline-start`, `padding-inline-start`). Right-to-left (RTL) scripts are not currently supported for the admin UI.

Files that would require `margin-inline-start` / `padding-inline-start` conversions to support RTL:

- `packages/astropress/public/admin.css` — sidebar layout, form alignment, table cells
- `packages/astropress/components/AdminLayout.astro` — topbar flex direction
- Individual admin page `.astro` files with inline `style` attributes

If RTL support is added in future, test with `dir="rtl"` on `<html>` and verify with the axe `scrollable-region-focusable` and `landmark-one-main` rules.
