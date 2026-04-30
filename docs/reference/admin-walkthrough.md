# Admin UI walkthrough

A reviewer-facing checklist for manually verifying the Astropress admin shell
end-to-end. Use this when reviewing PRs that touch admin templates, admin
styling, the publish flow, or accessibility tooling.

The checklist mirrors what `tooling/e2e/admin-harness-accessibility.spec.ts`,
`tooling/e2e/admin-touch-targets.spec.ts`, and `tooling/e2e/admin-harness-mobile.spec.ts`
cover automatically. Use this guide when you want eyes-on confirmation, or to
exercise an interaction the test suite cannot model.

---

## 1. Boot the admin harness

```
bun install
bun run --filter astropress-example-admin-harness dev
```

The dev server prints `Local http://127.0.0.1:4321/`. Sign in at
`http://127.0.0.1:4321/ap-admin/login` with:

- `admin@example.com` / `password` (admin role)
- `editor@example.com` / `password` (editor role)

Reset the seeded database between sessions:

```
rm -rf examples/admin-harness/.data/admin-harness.sqlite
```

To exercise the publish flow's success path you also need a deploy hook
configured in the env. The simplest non-destructive option:

```
CF_PAGES_DEPLOY_HOOK_URL=https://httpbin.org/post bun run --filter astropress-example-admin-harness dev
```

---

## 2. Theme + contrast (#39, #58, dark-mode regression)

- [ ] Click the moon/sun toggle in the topbar utility panel. Repeat on every
      route below — the colour palette must invert immediately and persist
      across navigations (the choice is stored in `localStorage["theme"]`).
- [ ] On `/ap-admin/login`, confirm the **Sign in** button has high contrast
      against its background in **both** themes. The known-bad combination was
      white text on a pale-green button (~1.79:1) — it must read as a clearly
      readable filled button in dark mode.
- [ ] On `/ap-admin/reset-password` and `/ap-admin/accept-invite?token=demo`,
      confirm the same for the form submit buttons.
- [ ] On `/ap-admin`, confirm the **Sign out** button (top-right of the
      topbar) is readable in dark mode — it should not be near-grey on
      near-grey.
- [ ] Confirm the footer links (`Report an issue`, `Astropress`) are clearly
      readable in dark mode. They previously inherited a hardcoded `#374151`
      against the dark `#0f1317` background.
- [ ] Confirm the bootstrap-credentials banner ("change your password") link
      is readable against the info-banner background in both themes.
- [ ] Confirm sidebar group labels (`Workspace`, `Content`, `Recent`) are
      legible in dark mode.

Automated coverage: `tooling/e2e/admin-harness-accessibility.spec.ts` runs
axe AA contrast plus AAA `color-contrast-enhanced` against every admin route
in light and dark themes. If a colour change breaks contrast, the spec will
fail before the PR can land.

---

## 3. Touch targets at 375 px (#58)

Open DevTools, switch to mobile emulation at 375 × 812 (iPhone SE).

For each of the seven admin routes — `/ap-admin`, `/ap-admin/posts`,
`/ap-admin/pages`, `/ap-admin/media`, `/ap-admin/redirects`,
`/ap-admin/comments`, `/ap-admin/settings` — confirm:

- [ ] Skip-link reaches at least 44 px tall when focused (Tab from the page
      load).
- [ ] Footer links feel comfortably tappable (no hairline targets).
- [ ] Settings tabs (`General`, `Newsletter`, `Import`) on
      `/ap-admin/settings` are at least 44 px tall.
- [ ] Post-row title links on `/ap-admin/posts` are at least 44 px tall.
- [ ] The newsletter checkbox on `/ap-admin/settings` is large enough to tap
      without precision (≈ 44 × 44).

Automated coverage: `tooling/e2e/admin-touch-targets.spec.ts` uses
`toEqual([])` (strict) — every interactive element on each admin route must
meet WCAG 2.5.5 (AAA) at viewport-375. Per-route baselines were removed once
issue #58 closed.

---

## 4. Publish flow + deployment indicator (#39)

The publish action is wired to whichever deploy hook env var is set. With no
hook, the action records a `deployment.failure` event; with a hook, it records
`deployment.trigger`.

Failure path:

- [ ] Start the dev server **without** any deploy-hook env var.
- [ ] On `/ap-admin`, click **Publish** in the topbar.
- [ ] Confirm the redirect lands back on `/ap-admin` and the "Latest
      Deployment" dashboard panel renders a red **Failed** pill with a
      summary like `cloudflare-pages publish failed: …`.
- [ ] Reload the page — the same record persists, sourced from the trusted
      audit log rather than the redirect query string.

Success path:

- [ ] Restart the dev server with
      `CF_PAGES_DEPLOY_HOOK_URL=https://httpbin.org/post`.
- [ ] Click **Publish**. The button reads `Publishing…` while the hook is
      called, then the redirect lands on `/ap-admin` with the success notice.
- [ ] The "Latest Deployment" panel now shows a green **Triggered** pill,
      timestamp, and actor email.
- [ ] Reload — the trusted record is still there.

Test coverage:
- Unit: `packages/astropress/tests/publish-audit.test.ts` (D1 path).
- Integration: dashboard panel renders from the same `recentAuditEvents` array
  the audit-trail uses, so any drift in `targetType: "deployment"` filtering
  surfaces on the next dashboard render.

---

## 5. Action surfaces

For each interactive surface listed below, confirm the listed behaviour. The
admin shell's progressive-enhancement script disables form buttons on submit
to prevent double-submission — verify this fires.

- [ ] **Sign out** (`form action="/ap-admin/session?logout=1"`) — clicking
      logs out and bounces to `/ap-admin/login`. Button momentarily disables.
- [ ] **Theme toggle** — keyboard accessible (Tab + Enter), persists across
      reloads, syncs across all `<ap-theme-toggle>` instances on the page.
- [ ] **Command palette** (Ctrl+K / Cmd+K) — opens a dialog, search filters
      nav items, Esc closes.
- [ ] **Keyboard shortcuts popover** (`?` key) — opens a popover listing the
      shortcuts.
- [ ] **Locale select** (compact `EN/ES/FR/…` dropdown in the topbar utility
      panel) — choosing a locale sets the `astropress_admin_locale` cookie,
      reloads the page, and the SSR-rendered labels (Sign out, sidebar
      titles, nav items, etc.) appear in that language. `<html lang>` reflects
      the choice.
- [ ] **System-language default** — clear the `astropress_admin_locale`
      cookie and set browser language to e.g. French; the login page
      should render in French (Accept-Language drives the initial pick).

---

## 6. Editor + listing flows

These are the most user-facing flows; the e2e suite covers the happy paths
but reviewers should still smoke them when admin templates change.

- [ ] `/ap-admin/posts` — table loads, pagination works, status chips render,
      title link opens the editor at `/ap-admin/posts/<slug>`.
- [ ] `/ap-admin/posts/hello-world` — edit body, click **Save draft** /
      **Publish**, `<ap-notice type="success">` appears with the result.
- [ ] **Open media library** in the post editor — modal opens, Esc closes,
      focus returns to the trigger button.
- [ ] `/ap-admin/redirects` — confirm-delete dialog opens, Cancel restores
      focus and dismisses without deleting.
- [ ] `/ap-admin/comments` — reject-comment dialog stays axe-clean and
      restores focus on cancel.
- [ ] `/ap-admin/settings` — change a value (e.g. site title), submit, return
      to the same tab with the success notice and the new value persisted.

---

## 7. Access control (`/ap-admin/access`)

The Access page is the admin-only break-glass surface for the ABAC engine.
Authorization is decided server-side by `requiresAccess(Astro, "<action>")` at
the page level and `requireAction: "<action>"` at the form-action level — the
nav-level filter is a UI mirror, not a security boundary.

- [ ] Sign in as `admin@example.com`. The **Access** leaf appears in the
      sidebar; sign in as `editor@example.com` and confirm it is hidden
      (the leaf has `requiredAction: "roles:manage"` so non-admins never
      see it). Even if you guess the URL, the page redirects to
      `/ap-admin?error=insufficient-permissions&reason=...` and the deny is
      logged to `audit_events` with `action='access:deny'`.
- [ ] **Users tab** — every admin user lists with a checkbox per role.
      Toggling a checkbox auto-submits the form (data-access-role-toggle
      script wiring; no inline event handlers). The "Direct grants"
      column shows a count badge and an "Add grant" disclosure that
      surfaces a datalist of every action registered through
      `listAccessActions()`.
- [ ] **Last-admin safeguard** — confirm the warning notice appears when
      only one active admin remains. Try to demote yourself: the action
      handler refuses with the safeguard's message via the URL `message=`
      param, surfaced into the AdminLayout aria-live region.
- [ ] **Roles tab** — the Editor / Author / Moderator / Translator
      starter roles are listed and marked with a "System" badge. Their
      name fields are read-only (system roles cannot be renamed) but
      description is editable. Create a custom role; add a policy
      (action picker datalist + allow/deny + priority); verify it
      appears under the role and that **Remove** drops it. Delete the
      custom role; verify the row disappears. Try to delete a system
      role — the server refuses with a banner.
- [ ] **My Permissions tab** — for an admin viewer the table shows the
      computed effective policies (admins still bypass evaluation but
      the snapshot is rendered for transparency). For an editor with one
      role assigned, the rows reflect the role's bundled policies plus
      any direct grants, with the source column tagging each row as
      `Role: <name>` or `Direct grant`.

Authorization model invariants (worth re-reading before reviewing any
PR that touches the access surface):

- `subject.isAdmin` is the canonical break-glass flag. The legacy
  `AuthUser.role` enum is now display-only and derived from `isAdmin`;
  do not branch on it for authorization decisions.
- DENY beats ALLOW regardless of priority. Priority orders matched
  reasons within an effect tier; it does not flip safety.
- Plugins register their own actions via the action registry —
  `listAccessActions()` is the single source of truth for the role
  builder + direct-grant picker.
- Every `engine.can()` deny that hits a page guard or form action
  writes to `audit_events` (action='access:deny', resource_type='access',
  resource_id=<action id>, summary=<engine reason>).

---

## 8. After a UI-touching PR is merged

- [ ] `bun run tooling/scripts/run-playwright.ts --project=admin-harness-a11y`
- [ ] `bun run tooling/scripts/run-playwright.ts --project=admin-touch-targets`
- [ ] `bun run --filter astropress-example-admin-harness check` (Astro type
      check against the consumer harness — catches template prop drift)

If any new admin template introduces its own `<style>` block (rather than
using `admin.css`), add it to `admin-harness-accessibility.spec.ts` so dark-
and light-mode contrast are gated automatically.
