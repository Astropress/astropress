# Astropress Evaluation

Baseline: **1040+ Vitest tests pass** (across 91 test files including `privacy-invariants`, `zta-invariants`, `global-privacy-baseline`, `did-compatibility`, `db-migrate-ops`, `plugin-api`, `runtime-actions-media`, `runtime-actions-content`), 32+ Rust CLI tests pass, 10 Playwright accessibility/mobile/interaction tests pass, **155+ BDD scenarios pass** across 56 Gherkin feature files. Security audit clean across 57 source files. Coverage: ~91% statements, ~72% branches. Framework framing: **web application development framework** (not a CMS framework — `registerCms()` and `features/cms/` are intentional headless-panel API names).

---

## Rubric 1: Spec Fidelity

**Grade: A−**

**Summary:** The framework delivers on all core contractual claims — database-first admin, WordPress import pipeline, provider abstraction, and headless panel integration. The GitHub Pages + SQLite path is the complete reference path. Hosted provider paths (Cloudflare, Supabase, Runway) have working adapters. REST API fully implemented across all 7 route groups with real handlers.

**Strengths:**
- All 160+ BDD scenarios pass across 56 feature files, covering admin editing, WordPress import, provider portability, CLI bootstrap, backup/health, content modeling, structured data, and newsletter subscription
- The host-runtime seam pattern (`local-runtime-modules` Vite alias) enforces the "git is not required" contract at the framework level
- WordPress import is staged and resumable; import artifacts are typed and produce remediation reports
- Provider differences are confined to adapter implementations — admin templates never fork by provider
- REST API at `/ap-api/v1/` with content, media, revisions, settings, and webhooks endpoints all implemented

**Gaps:**
- Firebase and Appwrite paths documented in the setup matrix but adapter work is stated as partial in `README.md`
- "One-click hosted migration from WordPress" is not claimed — staged CLI import is multi-step and requires manual apply

---

## Rubric 2: Architecture Quality

**Grade: A**

**Summary:** The separation of concerns is exceptionally clear. The host-runtime seam pattern, provider adapter contracts, volatility-based decomposition, and architectural fitness functions (both TS and Rust) are well-designed and consistently enforced. The Rust CLI has been refactored from a 3,148-line monolith into a module tree with proper volatility decomposition. Architectural fitness functions prevent regression.

**Strengths:**
- The Vite alias (`local-runtime-modules` → host app file) enforces the provider boundary at build time; missing alias now throws a descriptive error with a docs link
- `scripts/arch-lint.ts` enforces TypeScript architectural rules: LOC limits, SQL containment, dependency direction, dispatch containment, utility uniqueness
- `scripts/rust-arch-lint.ts` enforces Rust architectural rules: LOC limits, command isolation, JS bridge containment, provider enum purity, volatility boundaries
- Rust CLI refactored: `main.rs` is 225 LOC (dispatch + tests); domain commands in `src/commands/`; import commands (`import_wordpress.rs`, `import_wix.rs`) isolated in their own volatility cluster
- `admin-safety.test.ts` structurally enforces no inline event handlers, no `contenteditable`, `autocomplete` on auth forms, `aria-labelledby` on dialogs, sandboxed iframes
- 95 export paths, each justified by the package contract, organized by concern
- JS/TS sync tooling (`audit:sync`) prevents silent divergence between paired `.ts`/`.js` files

**Gaps:**
- Dual `.ts`/`.js` source files still require maintaining two files; `audit:sync` catches divergence but the source of truth is the `.ts` file

---

## Rubric 3: Test Quality

**Grade: A**

**Summary:** 992 Vitest tests across 83 test files, 128 BDD scenarios, 30+ Rust CLI tests, and 10 Playwright tests. The test pyramid is genuinely multi-layer. Branch coverage at ~72% is the meaningful remaining gap. Color contrast is now enabled in the axe gate.

**Strengths:**
- 992+ Vitest tests (up from 164 at initial evaluation) covering unit, integration, contract, and structural patterns
- BDD specs in Gherkin are executable — not documentation-only
- `admin-safety.test.ts` enforces DOM structure constraints including a new test that prevents `disableRules(["color-contrast"])` from ever being re-added to any axe audit script
- Adapter tests use real SQLite (not mocks)
- WordPress import tested at contract, unit, and BDD levels including edge cases (malformed XML, missing media, duplicate slugs)
- Playwright accessibility tests now cover color contrast (the deliberate disablement was removed)
- New: `runtime-health.test.ts`, `audit-log.test.ts`, `security-middleware.test.ts` (X-Request-Id trace IDs)
- New: `privacy-invariants.test.ts` — GDPR Art. 25 structural enforcement (schema, analytics, session security, right-to-erasure)
- New: `zta-invariants.test.ts` — NIST SP 800-207 Zero Trust Architecture (all 4 principles: never-trust, least-privilege, assume-breach, explicit-authorization)
- New: `global-privacy-baseline.test.ts` — common denominator of GDPR/CCPA/LGPD/PDPA/APP/POPIA/PIPL/PIPEDA
- New: `did-compatibility.test.ts` — W3C DID structural compatibility audit (DID-compatible properties, blocker documentation, extension point mapping)

**Gaps:**
- Branch coverage at ~72% — `wordpress.js` branches at 56.72%, `cloudflare.js` at 45.52% remain the largest gaps
- No load or stress tests for SQLite under concurrent writes

---

## Rubric 4: Security Posture

**Grade: A**

**Summary:** Security foundations are solid and consistently applied. `allowInlineStyles` now defaults to `false`, `Cross-Origin-Resource-Policy: same-site` is set for admin/api/auth areas, and the web component version of the HTML editor replaces `window.prompt()` with a native `<dialog>`. Each request now receives a unique `X-Request-Id` for audit trail correlation.

**Strengths:**
- `isTrustedRequestOrigin()` checks Origin header and falls back to Referer — more robust than a bare CSRF token
- `__Host-` cookie prefix prevents subdomain attacks; requires Secure flag + path `/`
- CSP is area-aware with appropriate strictness per area (public / admin / auth / api)
- `allowInlineStyles` now defaults to `false` — callers that need inline styles must opt in explicitly
- `Cross-Origin-Resource-Policy: same-site` set for admin, auth, and api areas
- `<ap-html-editor>` web component uses `showModal()` + `<form method="dialog">` instead of `window.prompt()`
- Rate limiting is implemented, tested, and documented
- `X-Request-Id` header set per request for audit trail correlation
- Cloudflare adapter uses D1-backed sessions (durable, HMAC-digested, TTL-enforced)
- HTML sanitization uses a custom allowlist parser; force-adds `rel="noopener noreferrer"` to all `<a>` tags

**Gaps:**
- Security middleware has ~60% statement coverage; the custom `resolveArea` branch is partially untested

---

## Rubric 5: Accessibility

**Grade: A**

**Summary:** The admin UI passes full WCAG 2.2 AA including color contrast. `--sidebar-muted` was raised from ~3.2:1 to ~5.2:1 (light) and ~6.1:1 (dark). The axe disablement was removed and a structural enforcement test prevents re-introduction. Mobile nav toggle is implemented with `aria-expanded` and `aria-controls`.

**Strengths:**
- Skip link, `aria-current="page"`, `aria-pressed`, `role="toolbar"`, native `<dialog>` with `aria-labelledby` — all correct
- Color contrast now passes at WCAG AA: `--sidebar-muted` values corrected in both light and dark themes
- `admin-safety.test.ts` contains a test that structurally prevents any axe audit script from suppressing color-contrast
- Mobile nav toggle (`<button class="nav-toggle">`) with `aria-expanded="false"` / `aria-controls="admin-sidebar"` added
- Login and invite forms have `autocomplete` attributes enforced structurally
- Focus management on dialogs and focus-summary elements (`data-focus-summary`) is correct

**Gaps:**
- Admin panel is English-only; internationalization is not a current goal

---

## Rubric 6: Performance

**Grade: A−**

**Summary:** Client-side weight is minimal — ~200 lines of vanilla JS, zero framework runtime, fully SSR. `loading="lazy"` added to media library thumbnails. REST API supports pagination (`?limit=`, `?offset=`). Lighthouse CI budget enforced via `.lighthouserc.json` and `audit:carbon` runs in `test-build`.

**Strengths:**
- Zero client-side JS framework; all admin UI is server-rendered
- 4 client JS files totaling ~200 lines; web components in `web-components/` add encapsulated functionality
- `loading="lazy"` on all media library `<img>` elements
- REST API pagination: `GET /ap-api/v1/content?limit=20&offset=0`
- `admin.css` extracted to a shared stylesheet for cross-page caching
- Static output (`github-pages` example) produces zero server costs post-deployment
- `audit:carbon` runs in `test-build` CI job — enforces JS payload budget (10 KB) and external domain audit
- `.lighthouserc.json` defines performance budget: `categories:performance ≥ 0.9`, `total-byte-weight ≤ 150 KB`
- `size-limit` config in root `package.json` gates JS bundle at 10 KB

**Gaps:**
- Admin list pages (posts, media) still load all records; no server-side pagination in the admin UI itself
- Lighthouse CI budget defined but `@lhci/cli` is not yet installed — budget is enforced by `audit:carbon` + `size-limit` today

---

## Rubric 7: Developer Ergonomics

**Grade: A−**

**Summary:** Architecture is excellent and consistently documented. The main ergonomic friction — missing Vite alias giving an unhelpful error — is now fixed with a descriptive throw. The `QUICK_START.md` now includes a "6 imports you need" cheat sheet.

**Strengths:**
- Missing `local-runtime-modules` alias now throws: `"[astropress] Missing Vite alias: 'local-runtime-modules'. Add astropressIntegration() to your astro.config.mjs — see https://astropress.dev/docs/quick-start#step-2-add-the-integration"`
- `QUICK_START.md` "The 6 imports you need" section lists the most-used entry points
- `astropress doctor` and `astropress doctor --json` provide human-readable and machine-readable health checks
- `astropress/project-launch` makes the bootstrap decision for consumers — no provider-selection logic needed
- TypeScript types are comprehensive; `CmsConfig`, `ContentStore`, `AuthStore` are well-typed
- `audit:sync` enforces JS/TS file synchronization in CI

**Gaps:**
- 95 export paths; a "top 6" cheat sheet is now in docs but the full list remains large
- `astropress doctor` output format is not visually sampled in docs

---

## Rubric 8: Browser / Web API Usage

**Grade: A**

**Summary:** Already very native. `<dialog>` + `<form method="dialog">` replaces `window.prompt()` in `<ap-html-editor>`. `loading="lazy"` on media thumbnails. All four client scripts have been superseded by web components in `packages/astropress/web-components/`.

**Already used correctly:**
- `HTMLDialogElement.showModal()` / `.close()` — `<ap-confirm-dialog>`, `<ap-html-editor>`
- `localStorage` — `<ap-theme-toggle>`
- `window.matchMedia("prefers-color-scheme: dark")` — `<ap-theme-toggle>`
- `element.closest()` for event delegation — `post-editor.ts`
- `iframe.srcdoc` for sandboxed preview — `posts/[slug].astro`
- `FormData` / `Request.formData()` — all action routes
- `URL` / `URLSearchParams` — `admin-action-utils.ts`
- CSS Custom Properties — `AdminLayout.astro`
- `crypto.randomUUID()` — session IDs, X-Request-Id

**Remaining opportunities:**
- `popover` attribute for tooltips and dropdowns (zero JS)
- `DOMParser` as a potential replacement for `htmlparser2` in Node/Workers environments

---

## Rubric 9: Web Components

**Grade: A**

**Summary:** All four original client scripts have been extracted into Web Components in `packages/astropress/web-components/`. Light DOM, no dependencies, attribute-driven, progressively enhanced.

**Components:**
- `<ap-admin-nav>` — sidebar nav with keyboard support, `aria-current`
- `<ap-html-editor>` — rich text editor with toolbar, preview, URL dialog (replaces `window.prompt()`)
- `<ap-confirm-dialog>` — generic confirm dialog replacing both `comments-dialog.ts` and `redirects-dialog.ts`
- `<ap-theme-toggle>` — light/dark toggle with `prefers-color-scheme` fallback

**Export paths:**
```
astropress/web-components                  # registers all
astropress/web-components/admin-nav
astropress/web-components/html-editor
astropress/web-components/confirm-dialog
astropress/web-components/theme-toggle
```

---

## Rubric 10: Spec Coherence (Axis 10 — WC First-Class)

**Grade: A**

**Summary:** Web components are now first-class exports with individual subpath imports, documented in `docs/WEB_COMPONENTS.md`. Host apps can import individual WCs or extend them for custom admin pages.

---

## Rubric 11: CI/CD Pipeline

**Grade: A**

**Summary:** CI is now parallelized into 5 jobs (lint, test-unit, test-cli, test-e2e, test-build) with a Bun version matrix on `test-unit` (1.3.10 + latest). All jobs have correct dependency ordering.

**Strengths:**
- `lint` job: biome, arch-lint TS + Rust, audit:deps, audit:security, audit:sync, cargo clippy
- `test-unit` job: vitest + coverage, matrix across Bun 1.3.10 and latest
- `test-cli` job: cargo test (independent, can run alongside test-unit)
- `test-e2e` job: Playwright accessibility + acceptance (depends on test-unit)
- `test-build` job: example build, static-site audit, `audit:carbon` (JS payload + external domain check), admin harness, BDD (depends on test-unit)
- `bdd:lint` (Gherkin syntax validation) and `bdd:test` (scenario execution) both run in CI
- `.lighthouserc.json` performance budget at repo root (performance ≥ 0.9, accessibility ≥ 0.95, total-byte-weight ≤ 150 KB)

**Gaps:**
- No deployment preview environments in CI
- No ZAP security scan in CI

---

## Rubric 12: Dependency Management

**Grade: A−**

**Summary:** Dependencies are minimal and justified. No runtime dependencies beyond Astro, Zod, and `htmlparser2`. Rust dependencies are all crates.io stable crates with pinned versions.

**Strengths:**
- `bun audit` runs in CI (lint job)
- Rust MSRV pinned at 1.82 in `Cargo.toml`
- `serde`, `serde_json`, `indicatif`, `dialoguer`, `rpassword` — all well-maintained, no abandoned deps
- TypeScript peerDependencies correctly specified (`astro >=6.0.0`, `zod >=4.0.0`)
- `overrides: { yaml: "^2.8.3" }` handles a known transitive vulnerability

**Gaps:**
- Dependabot config exists (`.github/dependabot.yml`) covering npm, cargo, and GitHub Actions
- No lockfile integrity check in CI

---

## Rubric 13: Documentation

**Grade: A−**

**Summary:** Comprehensive docs covering architecture, operations, quick start, web components, and evaluation. `llms.txt` added at repo root for AI agent discoverability. EVALUATION.md updated with 18-rubric scorecard and correct test baseline.

**Strengths:**
- `docs/ARCHITECTURE.md` — seam pattern, provider model, volatility decomposition
- `docs/QUICK_START.md` — 6-import cheat sheet, Vite alias explanation
- `docs/OPERATIONS.md` — deployment matrix, backup/restore, API versioning policy
- `docs/WEB_COMPONENTS.md` — WC usage and extension patterns
- `llms.txt` at repo root — REST API surface, MCP server, CLI flags, core import paths
- All language correctly describes astropress as a **web application development framework**

**Gaps:**
- No auto-generated API reference from TypeScript types
- `astropress doctor` output format not visually sampled in docs

---

## Rubric 14: Observability / Logging

**Grade: A−**

**Summary:** Health endpoint at `GET /ap/health`, structured logger (`createLogger`), per-request trace IDs (`X-Request-Id`), and audit event log (`ap_audit_log` table + `recordAuditEvent` / `listAuditEvents`). `astropress doctor --json` provides machine-readable health output.

**Strengths:**
- `GET /ap/health` returns `{ status, version, uptime, timestamp }` — no auth required
- `createLogger(context)` from `astropress/runtime-logger` emits JSON to stderr in production, formatted output in dev
- `X-Request-Id: <uuid>` header on every response from security middleware
- `ap_audit_log` / `audit_events` table in SQLite schema with `recordAuditEvent` / `listAuditEvents`
- `astropress doctor --json` emits `{ status, project, runtimeMode, appHost, contentServices, pairSupport, checks }`
- `AuditTrail.astro` component exists for displaying audit history in admin UI

**Gaps:**
- Logger is now wired into `withAdminFormAction` — all actions log actor, path, and errors centrally
- No distributed tracing integration (not needed for a self-hosted framework at this scale)

---

## Rubric 15: API Design

**Grade: A**

**Summary:** REST API at `/ap-api/v1/` is fully implemented with real handlers across all 7 route groups. OpenAPI 3.1 spec available at `/ap-api/v1/openapi.json`. Versioning policy documented. Token scopes enforced per endpoint.

**Endpoints:**
- `GET/POST /ap-api/v1/content` — list/create with pagination
- `GET/PUT/DELETE /ap-api/v1/content/{id}` — fetch/update/archive
- `GET/POST /ap-api/v1/media`, `DELETE /ap-api/v1/media/{id}`
- `GET /ap-api/v1/revisions/{recordId}`
- `GET /ap-api/v1/settings`
- `GET/POST /ap-api/v1/webhooks`
- `GET /ap-api/v1/openapi.json` — OpenAPI 3.1 spec (no auth)

**Strengths:**
- Bearer token auth with scope enforcement (`content:read`, `content:write`, `media:read`, `media:write`, `settings:read`, `webhooks:manage`)
- Pagination via `?limit=` / `?offset=` on list endpoints
- Webhook dispatch on content events (`content.published`, `content.updated`, `content.deleted`)
- API versioning policy in `docs/OPERATIONS.md`: `/ap-api/v1/` is stable from v1.0; breaking changes bump prefix

**Gaps:**
- `X-Total-Count` now present on all list endpoints; `ETag` on single-record GET via `jsonOkWithEtag`
- API only available when `config.api.enabled` is `true` (opt-in, not default)

---

## Rubric 16: Error Handling

**Grade: A−**

**Summary:** Error boundaries are well-placed at system boundaries (user input, external APIs). Admin page models use a `warnings` pattern for graceful degradation. The CLI uses typed errors with human-readable messages. `apiErrors` middleware provides consistent error shapes.

**Strengths:**
- `model.warnings` pattern on all admin page models — pages render safe fallback state when a service is unavailable
- `apiErrors.notFound()`, `.validationError()`, `.unauthorized()`, `.forbidden()`, `.rateLimited()` — consistent error shape
- Rust CLI errors are typed `Result<T, String>` — all errors surface as user-readable messages
- `try/catch` around all external API calls (WordPress XML parsing, media download, Cloudflare D1 queries)
- HTML sanitization errors are caught and return safe fallback (empty string)

**Gaps:**
- Cloudflare adapter's `delete()` throws for unsupported record types — no graceful fallback to no-op
- Some async admin page models don't distinguish between "service unavailable" and "bad data"

---

## Rubric 17: TypeScript Quality

**Grade: A**

**Summary:** TypeScript strict mode enabled via `astro/tsconfigs/strict`. No unsafe casts in the main source. JS/TS sync enforced in CI. Platform contracts use `satisfies` for type narrowing without widening.

**Strengths:**
- `extends: "astro/tsconfigs/strict"` in `packages/astropress/tsconfig.json` — `strict: true`, `noUncheckedIndexedAccess`, etc.
- `satisfies` used for platform contract records (`satisfies ContentStoreRecord`) — catches shape errors at compile time
- No `any` in core source; rare uses are scoped and `// biome-ignore` annotated
- `audit:sync` in CI catches `.ts`/`.js` export divergence
- All public API surfaces typed with interfaces exported from `platform-contracts.ts`

**Gaps:**
- Some `.astro` component frontmatter uses `as any` for Astro locals typing — acceptable given Astro's type inference limitations

---

## Rubric 18: AI Drivability

**Grade: A−**

**Summary:** Astropress is drivable by AI agents via the REST API (with Bearer token), the MCP server (`astropress-mcp`), `llms.txt` at repo root, and `astropress doctor --json` for machine-readable health checks.

**Strengths:**
- `llms.txt` at repo root: REST API surface, MCP tools, CLI flags, core import paths — consumable by LLMs and agents
- `astropress-mcp` package: MCP server with 7 tools (`list_content`, `get_content`, `create_content`, `update_content`, `list_media`, `get_site_settings`, `get_health`)
- OpenAPI 3.1 spec at `/ap-api/v1/openapi.json` — machine-readable API description
- `astropress doctor --json` — machine-readable project health check
- REST API enables full CRUD on content and media via Bearer token

**Gaps:**
- `astropress-mcp` package requires `tsc` build step before use; no pre-built dist committed
- `CLAUDE.md` at repo root added — architecture, commands, invariants, API surface, MCP setup
- MCP server requires manual `ASTROPRESS_API_URL` and `ASTROPRESS_API_TOKEN` env vars — no auto-discovery

---

---

## Rubric 19: Internationalization (i18n)

**Grade: B−**

**Summary:** The framework has full structural plumbing for multilingual content — a `translation_overrides` table, `/ap-admin/translations` route, `localeFromPath()` utility, and `hreflang` alternate link fields — and now ships a reference architecture document (`docs/MULTILINGUAL.md`) covering path-prefix routing, `hreflang` wiring, Astro i18n config, and the translation workflow. Admin UI labels remain English-only.

**What exists:**
- `translation_overrides` table with `route`, `state`, `updated_at`, `updated_by` columns
- `translationRepository` with `get`, `list`, `save` operations
- `hreflang` / `alternateLinks` fields on structured page routes and archive routes
- `localeFromPath(pathname)` — configurable via `registerCms({ locales: ["en","es","fr"] })`; falls back to `["en","es"]`
- `localeFromAcceptLanguage(header)` — negotiate locale from `Accept-Language` header against configured locales
- `/ap-admin/translations` admin page and `translation-update` action handler
- BDD scenario: "An editor creates content in two locales and both appear with correct hreflang links"
- `docs/MULTILINGUAL.md` — reference architecture for path-prefix multilingual sites with Astro i18n

**Gaps:**
- Admin UI labels (`loginHeading`, `themeToggleDark`, etc.) are hardcoded English strings in `admin-ui.ts`; no locale map
- Astro's own i18n routing (`i18n.locales`, `i18n.defaultLocale`) is not wired into the framework's route registry

**Path to A:**
- Make `admin-ui.ts` label resolution locale-aware with a fallback chain based on `registerCms({ locales })` order

---

## Rubric 20: SEO Tooling

**Grade: B**

**Summary:** The data layer is strong — every content record carries `seoTitle`, `metaDescription`, `ogTitle`, `ogDescription`, `ogImage`, `canonicalUrlOverride`, and `robotsDirective`. The admin panel has a dedicated `/ap-admin/seo` route. The framework ships a full suite of structured data components. `<AstropressBreadcrumbJsonLd>` was added for BreadcrumbList schema, completing the core JSON-LD component set.

**What exists:**
- `seoTitle`, `metaDescription`, `ogTitle`, `ogDescription`, `ogImage`, `canonicalUrlOverride`, `robotsDirective` on every content record
- `/ap-admin/seo` admin route for global SEO settings
- `summary` / `excerpt` field for Open Graph description fallback
- `legacyUrl` field for canonical redirect mapping during migrations
- `<AstropressSeoHead>` component: emits `<meta>`, `og:*`, `twitter:*`, `<link rel="canonical">`, `<meta name="robots">` from a content record
- `<AstropressArticleJsonLd>` component: emits Article schema.org JSON-LD with headline, author, publisher, dates
- `<AstropressWebSiteJsonLd>` component: emits WebSite + Organization JSON-LD for entity definition
- `<AstropressFaqJsonLd>` component: emits FAQPage JSON-LD for Q&A content
- `<AstropressBreadcrumbJsonLd>` component: emits BreadcrumbList JSON-LD with position + name + URL per crumb
- `sitemap.xml`, `robots.txt`, and `llms.txt` generated as public site routes

**Gaps:**
- No Open Graph image generation (og:image auto-generation for content records without an explicit image)
- `@astrojs/sitemap` not wired in — sitemap is generated from content records at request time (not build-time)

**Path to A:**
- Auto-generate OG image via `@vercel/og` or canvas when `ogImage` is not set
- Wire `@astrojs/sitemap` for build-time sitemap generation

---

## Rubric 21: AEO Tooling (Answer Engine Optimization)

**Grade: C+**

**Summary:** Astropress now ships five structured data components covering core AEO citation surfaces: `<AstropressArticleJsonLd>`, `<AstropressWebSiteJsonLd>`, `<AstropressFaqJsonLd>` (FAQPage), `<AstropressHowToJsonLd>` (step-by-step guides), and `<AstropressSpeakableJsonLd>` (voice assistant surfaces). `GET /llms.txt` surfaces published content for AI crawlers. Auto-population from content body is still a gap.

**What exists:**
- `llms.txt` at the framework repo root (for AI agents consuming the framework itself)
- `GET /llms.txt` generated by the public site integration — lists published content with titles, URLs, descriptions
- `seoTitle` and `metaDescription` fields (useful overlap with AEO)
- Clean semantic HTML output from Astro SSR
- Article JSON-LD via `<AstropressArticleJsonLd>` component
- WebSite + Organization JSON-LD via `<AstropressWebSiteJsonLd>` component
- `<AstropressFaqJsonLd items={[{question, answer}]}>` — FAQPage JSON-LD; AI answer engines preferentially cite FAQ structured data
- `<AstropressHowToJsonLd name steps={[{name, text}]}>` — HowTo JSON-LD for step-by-step procedural content; supports `totalTime` ISO 8601 duration and per-step `imageUrl`
- `<AstropressSpeakableJsonLd url cssSelectors? xpaths?>` — WebPage + SpeakableSpecification JSON-LD for voice assistant surfaces (Google Assistant, Alexa rich results)

**Gaps:**
- No citation-readiness audit in CI
- `<AstropressFaqJsonLd>` requires the host app to supply items manually — no auto-extraction from `metadata`

**Recommended integrations for `astropress new`:**
- `schema-dts` — TypeScript types for all schema.org types including Speakable, FAQPage, HowToStep

**Path to A:**
- Add `faqItems` and `howToSteps` to the `metadata` field schema (via `contentTypes`) and wire them to the JSON-LD components in layouts automatically
- ~~Ship a `<AstropressSpeakableJsonLd>` component~~ ✓ done

---

## Rubric 22: First-Party Data

**Grade: C**

**Summary:** Astropress ships a complete newsletter subscription pipeline: a public `POST /ap/newsletter/subscribe` endpoint accepts JSON or form-encoded email submissions, validates them, and routes to a configured adapter. Two self-hosted adapters ship out of the box — **Listmonk** (`NEWSLETTER_DELIVERY_MODE=listmonk`) and Mailchimp — plus a mock mode for development. Analytics configuration (Umami, Plausible, custom) is also supported. Still missing: subscriber list management in the admin panel and self-hosted page-view tracking bundled by default.

**What exists:**
- `comments` table with moderation workflow (approved/rejected/pending)
- `newsletter-adapter.ts` with `subscribe(email)` — **Listmonk** (self-hosted, `NEWSLETTER_DELIVERY_MODE=listmonk`) and Mailchimp implementations; mock mode in dev
- `POST /ap/newsletter/subscribe` — public HTTP endpoint; accepts JSON or form-encoded body; validates email format; returns 200/400/422 JSON; wires to `newsletterAdapter`
- `submissions` table for contact form data
- Session data in `admin_sessions` (not exposed as behavioral analytics)
- `webhooks` table — could theoretically forward events to a self-hosted analytics collector
- `requestOptedOutOfTracking(request)` — checks `DNT: 1` and `Sec-GPC: 1` headers for analytics opt-out
- `resolveAnalyticsSnippetConsentAware(config, request)` — returns empty string when user opts out of tracking
- Umami, Plausible, and custom analytics configurable via `registerCms({ analytics: { type: "umami" | "plausible" | "custom" } })`

**Gaps:**
- No self-hosted page view or event tracking bundled — sites must configure an analytics integration explicitly
- No subscriber list management in the admin panel (collect emails → manage list → send campaigns)
- No UTM parameter capture or attribution tracking
- No conversion event tracking (form submissions, comment submissions, newsletter signups)

**Recommended integrations for `astropress new`:**

*Analytics (self-hosted, first-party):*
| Tool | Why | Setup complexity |
|------|-----|-----------------|
| **Umami** | Lightweight (< 2 KB script), privacy-first, Docker one-liner, Astro script tag | Low |
| **Plausible** | ~1 KB script, excellent UI, cloud or self-hosted, EU-hosted option | Low |
| **Matomo** | Full GA replacement, GDPR compliance features, complex setup | High |
| **PostHog** | Product analytics + session replay + feature flags, self-hostable | Medium |

*Newsletter / Subscriber list:*
| Tool | Why | Setup complexity |
|------|-----|-----------------|
| **Listmonk** | Single Go binary, REST API, handles list management + campaign sending, MIT license | Low |
| **Mautic** | Full marketing automation, more complex, PHP-based | High |

*Search (first-party, no tracking leakage):*
| Tool | Why |
|------|-----|
| **Pagefind** | Astro's default for Starlight; static, client-side, zero infrastructure, 469k weekly downloads |
| **Meilisearch** | Self-hosted, typo-tolerant, REST API; requires a server |

**Path to A:**
- ~~Implement a first-party `Listmonk` newsletter adapter~~ ✓ done
- ~~Add `POST /ap/newsletter/subscribe` public endpoint~~ ✓ done
- Add `Umami` and `Plausible` as selectable analytics integrations in `astropress new` (write a `<script>` tag into `AdminLayout.astro` and the public site layout based on config)
- Wire `Pagefind` into the public site integration with an opt-in in `astropress new`
- Add a consent management primitive: `<AstropressConsentBanner>` component that gates analytics scripts behind a localStorage flag
- Capture form submission events to `audit_events` table for first-party conversion tracking without any external service

---

## Rubric 23: Content Modeling Flexibility

**Grade: C+**

**Summary:** Content records have a fixed shape plus a typed custom field system. `registerCms({ contentTypes })` accepts `ContentTypeDefinition[]` with `FieldDefinition` entries. `saveRuntimeContentState` validates `metadata` fields against the definition for the content's `templateKey` before writing. Field values are stored in a new `metadata TEXT` column (JSON) on `content_overrides`. The `ensureLegacySchemaCompatibility` bootstrap adds the column automatically for existing databases.

**What exists:**
- `FieldDefinition` interface: `name`, `label`, `type`, `required`, `options`, `validate` hook
- `ContentTypeDefinition` interface: `key` (matches `templateKey`), `label`, `fields`
- `validateContentFields()` — validates metadata object against field definitions
- `contentTypes` field in `CmsConfig` — opt-in, does not break existing sites
- `metadata TEXT` column on `content_overrides` — JSON, auto-migrated via `ALTER TABLE ... ADD COLUMN`
- `metadata?: Record<string, unknown>` on `ContentOverride`, `ContentRecord` types
- `saveRuntimeContentState` validates and persists `metadata` on D1 path
- `templateKeys` config in `registerCms()` for selecting a rendering template per record
- Separate `authors`, `taxonomies` (categories + tags), `comments` tables with their own admin workflows
- `revisions` on all content records

**Gaps:**
- Admin form does not auto-generate inputs from `FieldDefinition` — custom fields require a host-side form
- No relation fields in the admin editor
- No block/component content model (unlike Builder.io, Contentful, etc.)
- Local dev SQLite adapter path (`upsertContentOverride`) does not yet persist `metadata`

**Path to A:**
- Generate admin form fields from `FieldDefinition` entries dynamically in the post editor
- Add `metadata` to the local SQLite adapter path (`upsertContentOverride`)

---

## Rubric 24: Schema Migration Safety

**Grade: B**

**Summary:** The SQLite schema lives in `sqlite-schema.sql`. The `schema_migrations` table tracks applied migrations. `runAstropressMigrations(db, migrationsDir)` applies numbered `.sql` files in lexicographic order. `astropress db migrate` CLI command applies migrations from a `migrations/` directory with `--dry-run` support. Framework-managed additive columns (e.g., `metadata TEXT`) are applied via `ALTER TABLE ... ADD COLUMN` in `ensureLegacySchemaCompatibility` on every boot. Upgrade path documented in `docs/OPERATIONS.md`.

**What exists:**
- `sqlite-schema.sql` with `CREATE TABLE IF NOT EXISTS` for all tables
- `schema_migrations` table in schema, populated by `applyCommittedSchema` (writes `baseline-schema`) and `runAstropressMigrations`
- `runAstropressMigrations(db, migrationsDir)` from `astropress/sqlite-bootstrap` — applies `.sql` files in lexicographic order, tracks in `schema_migrations`
- `runAstropressDbMigrationsForCli({ dbPath, migrationsDir, dryRun })` from `astropress/db-migrate-ops` — opens the live DB and applies migrations from the CLI context
- `astropress db migrate [--migrations-dir <dir>] [--dry-run] [--project-dir <dir>]` CLI command — reads `ADMIN_DB_PATH` from `.env`, defaults to `migrations/` directory
- Dry-run mode uses an in-memory DB clone — preview without touching the real database
- `ensureLegacySchemaCompatibility` boot-time additive migration: applies `ALTER TABLE ... ADD COLUMN` for new nullable columns automatically
- `features/operations/schema-migration.feature` BDD scenarios with 3 passing tests
- `docs/OPERATIONS.md` — "Upgrade and migration policy" section documents framework-managed compatibility, user-managed migrations, and the CLI workflow

**Gaps:**
- No rollback support — SQL migrations are append-only
- Hosted D1/Supabase deployments require manual `ALTER TABLE` if the schema changes

**Path to A:**
- Add rollback metadata to `schema_migrations` (store the inverse SQL or a rollback script path)
- Emit a warning in `astropress doctor` when the live DB schema is ahead of the current schema version

---

## Rubric 25: Caching Strategy

**Grade: B**

**Summary:** `Cache-Control` headers cover the full header strategy: `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400` for public routes; `private, no-store` for admin/api. `ETag` on single-record content GET (`jsonOkWithEtag`) supports conditional GET. `publicCacheTtl` in `registerCms()` allows per-site TTL overrides. CDN purge on publish is the remaining gap.

**What exists:**
- `applyCacheHeaders(headers, area, publicCacheTtl?)` sets `Cache-Control` by security area
  - Public: `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400` (configurable via `publicCacheTtl`)
  - Admin/auth/api: `private, no-store`
- `jsonOkWithEtag(body, request)` generates a weak ETag from djb2 hash; returns 304 on `If-None-Match` match
- `publicCacheTtl?: number` in `CmsConfig` — framework formula: `max-age=ttl, s-maxage=ttl*12`
- Static output (`github-pages` example) is permanently cached by the CDN after build
- `stale-while-revalidate=86400` allows CDNs to serve stale content while revalidating in the background

**Gaps:**
- No webhook-triggered CDN purge on content publish (Cloudflare Cache API, Vercel revalidation, Netlify deploy hook)
- No ISR (Incremental Static Regeneration) integration — publishing content requires a full rebuild on static hosts
- No documented cache topology for `Cloudflare Pages + D1` (the most common hosted path)

**Path to A:**
- Add a `onContentPublished` hook that fires a CDN purge webhook for Cloudflare, Vercel, and Netlify
- Document the cache topology for each App Host in `docs/OPERATIONS.md`

---

## Rubric 26: Plugin / Extension API

**Grade: B**

**Summary:** The `AstropressPlugin` interface now covers three lifecycle surfaces: `onContentSave`, `onContentPublish`, and `onMediaUpload`. `AstropressMediaEvent` provides a typed payload with `id`, `filename`, `mimeType`, `size`, and `actor`. `dispatchPluginMediaEvent` fires after every successful `createRuntimeMediaAsset` call. Plugin hook errors are caught and never fail the action. `navItems` auto-render in `AdminLayout.astro`. Admin route injection is the remaining gap to A.

**What exists:**
- `AstropressPlugin` interface with `name`, `onContentSave`, `onContentPublish`, `onMediaUpload`, `navItems`
- `AstropressContentEvent` payload: `{ slug, kind, status, actor }`
- `AstropressMediaEvent` payload: `{ id, filename, mimeType, size, actor }`
- `plugins?: readonly AstropressPlugin[]` in `CmsConfig` / `registerCms()`
- `dispatchPluginContentEvent("onContentSave" | "onContentPublish", event)` — dispatches to all registered plugins
- `dispatchPluginMediaEvent(event)` — fires after successful media uploads; catches and logs plugin errors
- `onContentSave` fires on every successful content save from the admin panel
- `onContentPublish` fires additionally when `status === "published"`
- `onMediaUpload` fires after a media asset is successfully stored via `createRuntimeMediaAsset`
- Plugin hook errors are caught with `console.error` — they never fail the admin action
- `navItems` auto-rendered in `AdminLayout.astro` sidebar — plugins append nav links with zero host config
- `AstropressPlatformAdapter` contract — extensible runtime storage layer
- `createAstropressAdminAppIntegration()` — Astro integration hook that injects routes

**Gaps:**
- No `addAdminRoute(pattern, entrypoint)` hook for third-party packages to inject admin pages
- No middleware composition pattern for admin routes
- No event bus for cross-cutting concerns beyond content and media events

**Path to A:**
- Add `adminRoutes` to `AstropressPlugin` and process them in `createAstropressAdminAppIntegration()`
- Ship two reference plugins: `astropress-plugin-pagefind` (search indexing on publish) and `astropress-plugin-sitemap` (sitemap rebuild on publish)

---

## Rubric 27: Image Optimization

**Grade: C**

**Summary:** `<AstropressImage>` component added — enforces CLS-preventing `width`/`height` and `aspect-ratio`, defaults `loading="lazy"` and `decoding="async"`, accepts `srcset`/`sizes` for responsive art-direction, and supports `fetchpriority="high"` for LCP images. No server-side WebP conversion or thumbnail generation yet.

**What exists:**
- Media upload handler (`actions/media-upload.ts`) — stores file to disk or R2 as-is
- `mimeType`, `file_size`, `alt_text` stored in `media_assets` table
- `loading="lazy"` on media library thumbnails
- R2 / Cloudflare Objects storage integration for CDN delivery
- `maxUploadBytes?: number` in `CmsConfig` — enforced in `createRuntimeMediaAsset` before storage; default 10 MiB
- `<AstropressImage>` component — enforces explicit `width`/`height`, `aspect-ratio` style, `loading="lazy"`, `decoding="async"`; accepts `srcset`, `sizes`, `fetchpriority`

**Gaps:**
- No image resizing or thumbnail generation on upload
- No WebP or AVIF conversion — PNG/JPG stored as-is, often at full resolution
- No automatic `srcset` generation (component accepts manual `srcset` but does not generate variants)
- No image optimization pipeline (Sharp, libvips, Squoosh, Cloudflare Images)

**Path to A:**
- Store `width` and `height` in `media_assets` table at upload time; auto-pass to `<AstropressImage>`
- Add Sharp-based resize/convert pipeline in `actions/media-upload.ts` (skip for Cloudflare Workers where Sharp is unavailable)
- Generate a thumbnail variant at upload time for use in the media library grid
- Document Cloudflare Images URL pattern for CDN-native responsive srcset without Sharp

---

## Rubric 28: Real-Time Collaboration / Conflict Detection

**Grade: C−**

**Summary:** Optimistic locking is implemented. `saveRuntimeContentState` accepts `lastKnownUpdatedAt` and returns a `conflict: true` error when the record's `updated_at` has changed. Content edit forms embed a hidden `<input name="lastKnownUpdatedAt">`. The `content-save.ts` action handler now returns **HTTP 409 Conflict** with a JSON body when `result.conflict === true`. Concurrent tab detection is not yet implemented.

**What exists:**
- `lastKnownUpdatedAt` parameter in `saveRuntimeContentState` — conflicts return `{ ok: false, conflict: true, error: "modified by another editor…" }`
- `content-save.ts` returns HTTP 409 with `{ error, conflict: true }` JSON body when a conflict is detected
- Hidden `<input name="lastKnownUpdatedAt" value={pageRecord.updatedAt}>` in the post editor form
- `updatedAt` field on content records — stored in `content_overrides.updated_at`
- Revision history — changes are logged, so a conflict can be reconstructed after the fact
- Admin sessions track `last_active_at`

**Gaps:**
- No in-flight edit detection (no server-side "lock" or "draft token" mechanism)
- No client-side stale check before form submission (no JS polling or BroadcastChannel)
- No `BroadcastChannel` or `SharedWorker` warning when the same page is open in two tabs

**Path to A:**
- Add a `BroadcastChannel`-based client-side check before form submission
- Show a banner when the page has been open longer than the session TTL

---

## Rubric 29: Privacy by Design

**Grade: B−**

**Summary:** Astropress takes a privacy-by-design approach (GDPR Article 25). `auditRetentionDays` is now configurable in `registerCms()` with a default of 90 days; `recordAuditEvent` prunes expired entries on every write — no cron job needed. No default analytics, no IP storage in comments, HMAC-digested session tokens, and self-hosted storage only.

**Current privacy-by-design properties:**
- **No default analytics** — no tracking scripts load on public pages; operators must explicitly opt in
- **No IP address stored** — comments schema deliberately omits IP; this is a documented design choice, not an oversight
- **Session tokens digested** — HMAC-SHA-256 of token stored at rest (not the raw token)
- **Self-hosted storage only** — SQLite or Cloudflare D1; data never leaves operator infrastructure by default
- **No third-party CDN scripts** on public routes (Turnstile is conditional and opt-in)
- **Soft-delete for comments** — content can be suppressed without structural gaps
- **`admin_sessions` TTL-enforced** — sessions expire, not held indefinitely
- **`auditRetentionDays?: number`** in `CmsConfig` (default 90) — `recordAuditEvent` prunes expired rows on each write; set to `0` to disable

**Remaining gaps (path to A+):**
- **Comment email is plain text** — should be `SHA-256(email + site_salt)` at write time; makes the stored value non-recoverable and satisfies right-to-erasure trivially (zeroing a hash)
- **No right-to-erasure cascade** — deleting an admin user does not anonymize their `audit_events` entries or comment associations
- **No data portability** — no `astropress export:user <email>` command for GDPR Article 20

**What was once a gap but is now resolved:**
- `Sec-GPC: 1` / `DNT: 1` **is already honored** — `resolveAnalyticsSnippetConsentAware(config, request)` returns empty when either header is present; `requestOptedOutOfTracking(request)` is exported for host templates

**Why GDPR tooling (consent banners, cookie managers) is unnecessary by design:**
Consent banners exist because systems collect behavioral data by default and need permission to do so. If no behavioral data is collected on public pages (no analytics, no fingerprinting, no persistent identifiers), and personal data submitted via forms (comments, contact) is either hashed at rest or minimal, then Article 6(1)(b) ("necessary for the performance of a contract") or Article 6(1)(f) ("legitimate interests") covers the remaining data without requiring consent. The consent banner is the last-resort mechanism — designing around it is better than building it.

**Path to A+:**
1. Hash comment author email at write time (`SHA-256(email + site_salt)`) — makes erasure a 1-row update, removes the largest GDPR exposure
2. Add deletion cascade: `deleteAdminUser()` anonymizes `audit_events.user_email` and nulls comment `author_email` for that user
3. Add structural tests that enforce no-IP-storage, no-plaintext-email in new schema additions

---

## Rubric 30: Open Source Health

**Grade: B−**

**Summary:** The codebase is professionally structured and well-tested with full community-facing scaffolding: `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, and three GitHub issue templates. The `package.json` now has `repository`, `bugs`, and `homepage` fields. Remaining gaps: no `CODE_OF_CONDUCT.md`, no automated release tooling, and no Dependabot config.

**What exists:**
- `LICENSE` (MIT)
- `README.md` with setup instructions
- `CONTRIBUTING.md` — local setup, test commands, PR checklist, dual-TS/JS pattern, arch boundaries
- `SECURITY.md` — responsible disclosure via GitHub private advisory; 7/14/30-day SLA
- `CHANGELOG.md` — v0 stability policy documented; breaking changes tracked
- `.github/ISSUE_TEMPLATE/bug_report.md` — reproduction steps, environment table
- `.github/ISSUE_TEMPLATE/feature_request.md` — API sketch, acceptance criteria
- `.github/ISSUE_TEMPLATE/adapter_support.md` — provider type, interface checklist
- `repository`, `bugs`, `homepage` fields in `packages/astropress/package.json`
- `.github/dependabot.yml` — npm, cargo, and GitHub Actions ecosystems with grouped PRs
- Comprehensive `docs/` directory
- CI with security scanning (CodeQL, Semgrep, Gitleaks, ZAP baseline)

**Gaps:**
- No `CODE_OF_CONDUCT.md` (Contributor Covenant)
- No automated release tooling (`changesets`, `release-it`)
- No semantic versioning policy enforced in CI

**Path to A:**
- Add `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1)
- Add `.github/dependabot.yml` for npm and cargo ecosystem updates
- Add `changesets` for automated changelog and npm publish

---

## Summary Scorecard

| Rubric | Grade | Key Finding |
|--------|-------|-------------|
| 1. Spec Fidelity | A− | All core contracts delivered; Firebase/Appwrite adapters remain partial |
| 2. Architecture | A | Volatility-decomposed Rust CLI; TS + Rust fitness functions in CI |
| 3. Test Quality | A | 992 tests, 128 BDD scenarios, color contrast now in axe gate |
| 4. Security | A | `allowInlineStyles` default fixed; CORP added; `window.prompt()` replaced; trace IDs |
| 5. Accessibility | A | Color contrast corrected; disablement removed; structural enforcement test added |
| 6. Performance | A− | Lazy loading; REST API paginated; `audit:carbon` in CI; `.lighthouserc.json` budget; admin UI list pages still unbounded |
| 7. Developer Ergonomics | A− | Descriptive missing-alias error; 6-import cheat sheet in Quick Start |
| 8. Browser / Web API | A | `window.prompt()` replaced in post-editor and `<ap-html-editor>`; `loading="lazy"`; `crypto.randomUUID()` for trace IDs |
| 9. Web Components | A | All 4 client scripts replaced by Web Components with subpath exports |
| 10. WC First-Class | A | Individual WC subpath imports; `docs/WEB_COMPONENTS.md` |
| 11. CI/CD Pipeline | A | 5 parallel jobs; Bun version matrix; `audit:carbon` in test-build; `.lighthouserc.json` budget |
| 12. Dependency Management | A− | `bun audit` in CI; MSRV pinned; Dependabot config for npm/cargo/actions |
| 13. Documentation | A− | `llms.txt`; scorecard; correct framework framing throughout |
| 14. Observability | A− | Health endpoint; structured logger; X-Request-Id; audit log; doctor --json |
| 15. API Design | A | REST fully implemented; OpenAPI 3.1 spec; versioning policy documented |
| 16. Error Handling | A− | `model.warnings` degradation; typed API errors; some edge cases unhandled |
| 17. TypeScript Quality | A | `strict: true`; `satisfies`; JS/TS sync enforced; no unsafe casts |
| 18. AI Drivability | A− | MCP server; `llms.txt`; OpenAPI; `doctor --json`; MCP requires manual build step |
| 19. Internationalization | B− | Full data layer; `docs/MULTILINGUAL.md` reference architecture added; admin UI English-only |
| 20. SEO Tooling | B | `<AstropressSeoHead>`, Article/FAQ/WebSite/BreadcrumbList JSON-LD; sitemap at request time |
| 21. AEO Tooling | C+ | + `<AstropressSpeakableJsonLd>` for voice assistants; 5 JSON-LD components total |
| 22. First-Party Data | C | `POST /ap/newsletter/subscribe` endpoint added; Listmonk + Mailchimp adapters; analytics config |
| 23. Content Modeling | C+ | `ContentTypeDefinition` + `FieldDefinition` in `registerCms()`; field validation at save time |
| 24. Schema Migration Safety | B | Auto additive migrations via `ensureLegacySchemaCompatibility`; upgrade docs in `OPERATIONS.md` |
| 25. Caching Strategy | B | `stale-while-revalidate=86400` added; ETag on content GET; CDN purge missing |
| 26. Plugin / Extension API | B | `AstropressPlugin` hooks including `onMediaUpload`; `AstropressMediaEvent` added |
| 27. Image Optimization | C | `<AstropressImage>` component: CLS-safe w/h, aspect-ratio, lazy/async, srcset/sizes, fetchpriority |
| 28. Real-Time Collaboration | C− | `lastKnownUpdatedAt` conflict detection; HTTP 409 returned from `content-save.ts` |
| 29. Privacy by Design | B− | `auditRetentionDays` added (default 90d); comment email plain-text is the main gap to A+ |
| 30. Open Source Health | B− | `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, 3 issue templates, `repository` fields added |
