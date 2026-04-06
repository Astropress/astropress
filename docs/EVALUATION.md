# Astropress Evaluation

Baseline: all 164 Vitest tests pass, 21 Rust CLI tests pass, 10 Playwright accessibility tests pass, 20 BDD scenarios pass. Security audit clean across 57 source files. Coverage: 91.33% statements, 71.71% branches.

---

## Axis 1: Spec Fidelity

**Grade: B**

**Summary:** The framework delivers on its core contractual claims — a database-first admin that doesn't require Git, a WordPress import pipeline, and a working provider abstraction model. The GitHub Pages + SQLite path is the complete reference path; hosted provider paths (Cloudflare, Supabase, Runway, Firebase) have working adapters but are marked as requiring account-based validation. The CLI passes all 21 unit tests, including import staging, snapshot export/restore, and project scaffolding.

**Strengths:**
- All 20 BDD scenarios pass, covering admin editing, WordPress import, provider portability, CLI bootstrap, and backup/health
- The host-runtime seam pattern (`local-runtime-modules` Vite alias) enforces the "git is not required" contract at the framework level — editors never touch it
- WordPress import is staged and resumable (`stages_wordpress_imports` CLI test); import artifacts are typed, inspectable, and produce remediation reports
- Provider differences are confined to adapter implementations — admin templates never fork by provider (verified by `admin-customization` BDD and runtime design)
- Deploy and sync contracts pass for the supported matrix (GitHub Pages, Cloudflare, Supabase, Runway)

**Gaps:**
- Firebase and Appwrite paths are documented in the setup matrix but the hosted runtime adapter work is stated as partial in `README.md`
- "One-click hosted migration from WordPress" is explicitly not claimed — but the staged CLI import is multi-step and requires manual apply to SQLite
- The CLI delivers the v1 command set but it lives in a 3,148-line single file (`crates/astropress-cli/src/main.rs`); this is a maintainability risk, not a spec gap
- `SPEC.md` says first-party adapters are required for v1 but doesn't define a completion criteria for "account-based validation"

**Recommendations:**
- Define measurable acceptance criteria for each hosted provider path (CI test matrix with live sandbox accounts, or clearly staged gates)
- Document the WordPress import as a multi-step CLI workflow in `docs/OPERATIONS.md`, since it isn't a one-command migration
- Break `crates/astropress-cli/src/main.rs` into modules as a near-term quality gate

---

## Axis 2: Architecture Quality

**Grade: A−**

**Summary:** The separation of concerns is exceptionally clear. The host-runtime seam pattern, provider adapter contracts, and package extraction goal are well-designed and consistently applied. The main code smell is the single 3,148-line Rust file. The dual JS/TS file pattern is intentional and documented, but adds real maintenance overhead.

**Strengths:**
- The Vite alias (`local-runtime-modules` → host app file) is an elegant way to let the package be reusable without hard-coding host-specific code — it enforces the boundary at build time
- 95 export paths are large but each is justified by the package contract (`packages/astropress/SPEC.md`) and organized by concern
- `astropress/adapters/project` automatically selects local vs hosted runtime from env — consumers don't write branching logic
- Admin templates import only from package-owned paths; the `admin-safety.test.ts` structurally enforces no inline event handlers (`/\son[a-z]+=/`) and no `contenteditable` in admin `.astro` files
- `astropress/project-launch` centralizes bootstrap planning so CLI and consumers share one decision path

**Gaps:**
- `crates/astropress-cli/src/main.rs` at 3,148 lines is a single-file monolith; while the 21 tests cover the surface, adding commands or debugging failures will become harder as the file grows
- Dual `.ts`/`.js` source files (e.g., `config.ts` + `config.js`) require keeping two files in sync; there's no build step to enforce they match — a divergence would be silent
- `security-middleware.ts` has a `resolveArea` hook that enables custom area resolution, but 0% of that path is tested — the custom resolver branch is dead from a test perspective

**Recommendations:**
- Split `crates/astropress-cli/src/main.rs` into a module tree (`src/commands/`, `src/env/`, etc.) behind a `main.rs` dispatcher
- Add a build-time check (e.g., a Vitest test or CI step) that the `.js` files agree with the corresponding `.ts` exports — or migrate to a build step that generates them
- Add a test for the `resolveArea` custom resolver path in `security-middleware.ts`

---

## Axis 3: Test Quality

**Grade: B+**

**Summary:** 48 Vitest test files covering 164 tests, with a 91% statement and 72% branch coverage. The test pyramid is genuinely multi-layer: BDD specs, contract/integration tests, unit tests, and Playwright accessibility tests all run and pass. The `admin-safety.test.ts` structural enforcement approach is a standout pattern. Branch coverage at 72% is the meaningful gap.

**Strengths:**
- BDD specs in Gherkin are executable (run by `scripts/bdd-test.ts`) — they're not documentation-only
- `admin-safety.test.ts` enforces DOM structure constraints (no inline event handlers, no contenteditable, aria labels, sandbox iframes) — this is a genuinely valuable structural gate
- Adapter tests use real SQLite (not mocks) — the `local-provider.integration.test.ts` and `cloudflare-provider.integration.test.ts` tests hit real code paths
- WordPress import is tested at both the contract level (2 Vitest tests) and the BDD level (3 scenarios), including resumable media download state
- Playwright accessibility tests cover 7 admin routes with axe-core at WCAG 2.2 AA level

**Gaps:**
- Branch coverage at 71.71% — `wordpress.js` branches are at 56.72%, `cloudflare.js` at 45.52%, `project-scaffold.js` at 70%
- `security-middleware.js` statement coverage is 60% (lines 24–37 uncovered — the `resolveArea` custom resolver branch)
- Color contrast is explicitly disabled in the Playwright axe config (`.disableRules(["color-contrast"])`) — this removes the most common WCAG failure from the accessibility gate
- No tests for the `window.prompt()` call in `post-editor.ts` — it can be bypassed, cancelled, or blocked by browser policies

**Recommendations:**
- Add branch tests for WordPress import edge cases (malformed XML, missing media, duplicate slugs)
- Re-enable `color-contrast` in axe audits with a baseline report to track regressions separately from blocking violations
- Add the `resolveArea` custom resolver to the security middleware test suite
- The `window.prompt()` in `post-editor.ts:66` should be replaced with a native `<dialog>` (covered in WC plan)

---

## Axis 4: Security Posture

**Grade: B+**

**Summary:** The security foundations are solid and thoughtful — CSRF via origin checking (not just a token), `__Host-` prefixed cookies, well-structured CSP by area, rate limiting, HTML sanitization with a custom allowlist parser. Two notable gaps: `allowInlineStyles` defaults to `true` globally (weakens CSP), and `window.prompt()` in the post editor is a mild phishing concern in a trusted admin context.

**Strengths:**
- `isTrustedRequestOrigin()` in `security-headers.ts:92` checks Origin header and falls back to Referer — more robust than a bare CSRF token because it validates the origin rather than just a value the attacker could steal
- `__Host-` cookie prefix (`__Host-astropress_admin_session`) prevents subdomain attacks and requires Secure flag + path `/` — correct implementation
- CSP is area-aware: public pages allow `form-action 'self' https:` and `object-src 'self'`; admin/api areas tighten both — this is intentional and appropriate
- HTML sanitization (`src/html-sanitization.ts`) is a custom allowlist traversal using `htmlparser2` — it force-adds `rel="noopener noreferrer"` to all `<a>` tags, drops `script`/`style`/`iframe` content entirely, validates URL schemes
- Rate limiting is implemented (`peekRuntimeRateLimit` / `recordRuntimeFailedAttempt`) and tested in `tests/runtime-env.test.ts`
- The post body preview uses `<iframe sandbox="">` with `srcdoc` — correct isolation for untrusted HTML

**Gaps:**
- `createAstropressSecurityHeaders` defaults `allowInlineStyles: true` (`security-headers.ts:51`). The admin area uses scoped `<style>` blocks in `.astro` components which need inline style support, but the default being permissive means any caller that forgets to set it gets a weaker CSP
- `window.prompt()` in `post-editor.ts:66` — the browser native prompt dialog uses browser chrome that could be confused with a browser-level security prompt (phishing surface in a trusted admin). Should be replaced with a `<dialog>`
- Security middleware has 60% statement coverage; the custom `resolveArea` branch is untested
- No `Timing-Allow-Origin` or `Cross-Origin-Resource-Policy` headers for media assets — minor omission

**Recommendations:**
- Default `allowInlineStyles` to `false`; use a nonce-based approach or CSP hash for the scoped styles in admin components, or explicitly pass `allowInlineStyles: true` only at the admin layout level
- Replace `window.prompt()` with `<dialog>` + `<form method="dialog">` (zero-dependency fix covered by the WC plan)
- Add `Cross-Origin-Resource-Policy: same-site` for admin media responses

---

## Axis 5: Accessibility

**Grade: A−**

**Summary:** The admin UI has all the expected accessibility foundations in place: skip link, `aria-current="page"`, `aria-pressed` on the theme toggle, `role="toolbar"`, native `<dialog>` for all modals. The Playwright axe suite passes at WCAG 2.2 AA. The one deliberate gap is color contrast being excluded from the axe gate.

**Strengths:**
- Skip link (`class="skip-link"`) is present and targets `#admin-main` in `AdminLayout.astro:62`
- `aria-current="page"` on active nav items (`AdminLayout.astro:102`) — correct semantic
- Login and invite forms have proper `autocomplete` attributes enforced structurally by `admin-safety.test.ts:57–63`
- `<dialog>` elements for modals are native, keyboard-accessible, and properly labeled with `aria-labelledby` (enforced by `admin-safety.test.ts:42–43`)
- Focus is returned to the trigger after dialog close — confirmed by the Playwright test at `admin-harness-accessibility.spec.ts:35`
- No inline event handlers in admin templates (enforced structurally)
- The `sandbox=""` iframe for HTML preview blocks focus from entering it

**Gaps:**
- Color contrast is disabled in the axe gate — the dark mode sidebar uses `rgba(255,255,255,0.58)` for muted text against the dark background, which may not meet 4.5:1 for normal text
- Mobile breakpoint at 900px collapses the sidebar grid to a single column but doesn't provide a hamburger or drawer — the sidebar just stacks above main content, which may be hard to navigate on small screens
- No `lang` attribute on the `<html>` element in admin page content (the outer `<html lang="en">` is in `AdminLayout.astro:51` — this is correct; noting it's only English)

**Recommendations:**
- Enable color contrast in axe with a baseline snapshot so failures are tracked; address the `sidebar-muted` color
- Add a mobile navigation affordance (at minimum a `<details>/<summary>` toggle for the sidebar) at the 900px breakpoint

---

## Axis 6: Performance / Carbon Footprint

**Grade: A−**

**Summary:** The client-side weight is genuinely minimal: ~200 lines of vanilla JS across 4 files, zero framework runtime, all admin UI is server-rendered. The "low-carbon" claim is credible from an architecture standpoint but there's no measurement methodology, no Carbon Budget document, and no tooling to enforce it over time.

**Strengths:**
- 4 client JS files totaling ~200 lines — no framework, no component library, no reactive runtime
- No Astro hydration directives (`client:load`, `client:idle`, etc.) anywhere in the admin — fully SSR
- CSS is scoped inside `.astro` components with no PostCSS pipeline, no Tailwind purging, no runtime style injection
- `AdminLayout.astro` CSS uses CSS Custom Properties for theming — zero JS overhead for light/dark switch (CSS does the work, JS only toggles the attribute)
- Static output (`github-pages` example) produces zero server costs post-deployment
- External scripts: only the optional Cloudflare Turnstile script — and it's conditional on production mode

**Gaps:**
- "Low-carbon" is a marketing claim with no measurement: no tooling (e.g., Website Carbon Calculator API, Lighthouse CI carbon budget, Ecograder) in the test suite
- Admin list pages (posts, media, comments) likely load all records without pagination limits — N+1 query risk in SQLite on large data sets is not addressed in the admin route contracts
- No lazy loading for media library thumbnails (all `<img>` in the media grid likely load eagerly)
- The `AdminLayout.astro` CSS block is ~550 lines inline per page — could be extracted to a linked stylesheet for better caching across admin navigations

**Recommendations:**
- Add a Lighthouse CI budget check (JS bytes, total bytes, LCP) to the CI pipeline as a proxy for carbon footprint
- Add `loading="lazy"` to media library thumbnails
- Extract `AdminLayout.astro` styles to `public/admin.css` with a long cache header so they're shared across admin pages

---

## Axis 7: Developer Ergonomics

**Grade: B**

**Summary:** The architecture is well-designed and the `SETUP.md` is comprehensive. The main ergonomic friction points are: the `local-runtime-modules` Vite alias seam is powerful but non-obvious to newcomers; the dual JS/TS files mean the codebase looks larger than it is; and 95 export paths require knowing which subpath to use.

**Strengths:**
- `SETUP.md` walks through the full setup including prerequisites, env vars, and staged deployment
- `astropress doctor` command exists to diagnose missing secrets and paths (verified by BDD)
- `astropress/project-launch` makes the bootstrap decision for consumers — they don't write provider-selection logic
- Provider recommendation system (`recommendAstropressProvider`) suggests a default pair — reduces decision paralysis for new projects
- TypeScript types are comprehensive throughout; `CmsConfig`, `ContentStore`, `AuthStore`, etc. are well-typed

**Gaps:**
- The `local-runtime-modules` Vite alias is the central seam of the framework but it's not mentioned until deep in `README.md:141` — a newcomer's first failure will likely be a missing alias, and the error message won't say "add this alias"
- The dual JS/TS file pattern means `src/config.ts` and `src/config.js` both exist and must stay in sync — there's no tooling to enforce this
- 95 export paths: the full list is in `index.ts` but there's no higher-level "here's the 5 paths most consumers need" doc
- `astropress doctor` output format is tested (it flags issues) but not visually verified — there's no screenshot or output sample in the docs

**Recommendations:**
- Add a "Quick Start" guide that shows the minimum working host app with the 5 required steps: install, add Vite alias, add integration, add middleware, add admin layout
- Add a Vitest test that catches divergence between paired `.ts`/`.js` exports (or add a build step that generates `.js` from `.ts`)
- Add a "Core exports cheat sheet" section to `SETUP.md` listing the 5–10 most-used import paths

---

## Axis 8: Native Browser API Inventory

**Grade: B+**

**Summary:** The client-side code is already heavily native — no polyfills, no shims, no framework. `<dialog>`, `localStorage`, `matchMedia`, `FormData`, `URL`, `fetch`, and CSS Custom Properties are all used correctly. There are several modern browser APIs that could reduce the JS footprint further or improve UX with zero dependencies.

**Already used correctly:**

| API | Location |
|-----|----------|
| `HTMLDialogElement.showModal()` / `.close()` | `comments-dialog.ts`, `redirects-dialog.ts`, `post-editor.ts` |
| `localStorage.getItem/setItem` | `theme-toggle.ts` |
| `window.matchMedia("(prefers-color-scheme: dark)")` | `theme-toggle.ts` |
| `element.closest()` for event delegation | `post-editor.ts:52` |
| `iframe.srcdoc` for sandboxed preview | `post-editor.ts:24` |
| `FormData` / `Request.formData()` | `session.ts`, all action routes |
| `URL` / `URLSearchParams` | `admin-action-utils.ts` |
| CSS Custom Properties | `AdminLayout.astro:125` |
| `color-mix()` | `AdminLayout.astro:571` |

**Underused / missing opportunities:**

| API | Opportunity | Impact |
|-----|-------------|--------|
| `popover` attribute | Tooltips, dropdowns, context menus — zero JS | Medium |
| `<dialog>` + `<form method="dialog">` | Replace `window.prompt()` for URL input | High (security + UX) |
| CSS `field-sizing: content` | Auto-sizing textareas without JS resize handlers | Low |
| CSS Container Queries | Component-level responsive admin panels | Medium |
| `Clipboard API` | Copy redirect slugs, copy post URL | Low |
| `Intersection Observer` | Lazy-load media library thumbnails | Medium |
| `DragEvent` / HTML5 drag-drop | Drag-to-upload in media library | Medium |
| `View Transitions API` | Smooth admin page navigations | Low |
| `BroadcastChannel` | Warn when same admin page is open in two tabs | Low |
| `DOMParser` (Node 19+) | Replace `htmlparser2` dependency | Medium |

**Recommendations:**
- Replace `window.prompt()` immediately — covered in WC plan
- Add `loading="lazy"` + `Intersection Observer` to media library (the former is a 2-character change)
- Explore `DOMParser` as a replacement for `htmlparser2` to eliminate a production dependency; validate in the Node/Cloudflare Workers runtimes used

---

## Axis 9: Web Component Replacement Map

**Grade: N/A** (this axis identifies opportunities, not existing deficiencies)

**Summary:** The current client JS is 4 files of ~200 lines total. Three are near-identical dialog coordination scripts. All four are solid candidates for Web Components — not because the current code is bad, but because WCs would make these patterns reusable by host apps building custom admin pages.

### High-value replacements

| Current file | Proposed WC | What it gains |
|---|---|---|
| `src/client/theme-toggle.ts` | `<ap-theme-toggle>` | Encapsulated, declarative, no global query |
| `src/client/comments-dialog.ts` | `<ap-confirm-dialog>` | Generic — replaces both dialog scripts |
| `src/client/redirects-dialog.ts` | `<ap-confirm-dialog>` | Same element, different `data-*` attributes |
| `src/client/post-editor.ts` | `<ap-html-editor>` | Encapsulates editor + toolbar + preview + URL dialog |

### Why light DOM (not shadow DOM)

The admin CSS lives in `AdminLayout.astro` as scoped CSS with `:global()` classes. Shadow DOM would isolate WC internals from these styles. Light DOM WCs inherit the existing CSS variables and class names without any `::part()` ceremony.

### Structural note on the dialogs

`comments-dialog.ts` and `redirects-dialog.ts` are structurally identical — both listen for `[data-confirm-*]` clicks, populate two text nodes from `data-*` attributes, set a hidden form field, and call `dialog.showModal()`. A single `<ap-confirm-dialog>` WC with slots and attributes replaces both completely.

---

## Axis 10: Web Components as a First-Class Tool

**Grade: N/A** (forward-looking design; see implementation plan below)

**Summary:** The framework currently has no WC primitives. The path to first-class WC support is:

1. Extract the 4 client scripts into custom elements in `packages/astropress/web-components/`
2. Expose them via a new `astropress/web-components` export path (and `astropress/web-components/*` for individual imports)
3. Update the admin `.astro` components to use the custom element tags instead of raw HTML + script imports
4. Document the authoring pattern for host-app developers who want to extend or build their own WCs using the same primitives

### Design principles

- **Light DOM only** — CSS variables propagate naturally; no `::part()` needed
- **Progressive enhancement** — Astro SSR renders semantic fallback HTML; WC upgrades it on the client
- **Attribute-driven** — server passes initial state via HTML attributes; WC owns all subsequent interactivity
- **No framework inside a WC** — `class ApThemeToggle extends HTMLElement` with no dependencies

### New export paths

```
astropress/web-components          # side-effect import: registers all WCs
astropress/web-components/theme-toggle
astropress/web-components/confirm-dialog
astropress/web-components/html-editor
```

### For host-app developers

Host apps can:
- Import individual WCs and use them in custom admin pages
- Extend WC classes (`class MyEditor extends ApHtmlEditor`) for custom behavior
- Import just `astropress/web-components/theme-toggle` without pulling in the full bundle

---

## Summary Scorecard

| Axis | Grade | Key Finding |
|------|-------|-------------|
| 1. Spec Fidelity | B | SQLite + GitHub Pages path is complete; hosted providers need account-validation gates |
| 2. Architecture | A− | Excellent seam design; single 3,148-line Rust file is the main code smell |
| 3. Test Quality | B+ | 91% statement / 72% branch coverage; color-contrast disabled in axe; `admin-safety.test.ts` is a standout |
| 4. Security | B+ | Solid foundations; `allowInlineStyles` default is too permissive; `window.prompt()` should go |
| 5. Accessibility | A− | All WCAG 2.2 AA boxes checked except color contrast (explicitly disabled) |
| 6. Performance | A− | Genuinely lean; "low-carbon" claim needs measurement tooling |
| 7. Developer Ergonomics | B | Architecture is good; first-run discoverability of the Vite seam needs a Quick Start guide |
| 8. Browser/Web API | B+ | Already very native; `DOMParser` could replace `htmlparser2`; `window.prompt()` is the one gap |
| 9. WC Replacement Map | — | 4 client scripts → 3 WCs; both dialog scripts → 1 generic WC |
| 10. WC First-Class | — | See `docs/WEB_COMPONENTS.md` and `packages/astropress/web-components/` |
