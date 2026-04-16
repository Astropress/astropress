# Astropress Evaluation

**Baseline (as of 2026-04-14, updated):** 1650+ Vitest tests · 170 Rust CLI tests · 10 Playwright specs across 70 acceptance checks · 359 BDD scenarios · security audit clean

## Grades

Grade scale: `A+ / A / B / C / D / F`

| # | Rubric | Grade | Evidence |
|---|--------|-------|----------|
| 1 | Spec Fidelity | | `bun run bdd:test` — 359 BDD scenarios; `bun run bdd:lint` validates scenario completeness |
| 2 | Architecture Quality | | `audit:arch` passes (CI-enforced LOC limits, file structure constraints); `audit:arch:rust` passes |
| 3 | Test Quality | | 1650+ Vitest tests (`bun run test`), 170 Rust CLI tests (`test:cli`), 10 Playwright specs across 70 acceptance checks |
| 4 | Security Posture | | `audit:security` passes; `zta-invariants.test.ts`, `security-headers.test.ts`, `cloudflare-adapter-security.test.ts` |
| 5 | Accessibility | | `test:accessibility` (axe-core static build); `test:accessibility:browser` and `test:accessibility:admin-harness` (Playwright) |
| 6 | Performance | | `audit:bundle` passes; `audit:carbon` passes; Lighthouse CI on preview deploys |
| 7 | Developer Ergonomics | | `audit:developer-ergonomics` passes (CI-enforced: quick-start docs, scaffold test, doctor command, --help, admin UX test, docs:api:check) |
| 8 | Browser / Web API Usage | | `audit:web-components` passes (CI-enforced: no XMLHttpRequest, fetch-only, proper cleanup patterns) |
| 9 | Web Components | | `audit:web-components` passes (CI-enforced: ap- naming, connectedCallback/disconnectedCallback, cleanup mechanism, index export) |
| 10 | Spec Coherence (WC First-Class) | | `audit:web-components` passes (CI-enforced: all 8 components verified against WC spec requirements) |
| 11 | CI/CD Pipeline | | All CI jobs defined in `.github/workflows/ci.yml`; `repo:clean` asserts clean worktree at end of each job |
| 12 | Dependency Management | | `audit:deps` (`bun audit`) passes in lint job |
| 13 | Documentation | | `docs:api:check` passes (API docs generated and verified); `docs:check` passes in CI and platform-smoke |
| 14 | Observability / Logging | | `monitoring.test.ts`; (self-assessed beyond that — no dedicated observability audit) |
| 15 | API Design | | `api-routes.test.ts`, `api-endpoints.test.ts`; (self-assessed — no dedicated API design audit) |
| 16 | Error Handling | | `audit:error-handling` passes (CI-enforced: admin-action typed results, no naked re-throws, cache-purge non-fatal failures) |
| 17 | TypeScript Quality | | `typescript-quality.test.ts`; `bunx biome check` passes in lint job |
| 18 | AI Drivability | | (self-assessed — no automated backing; circular risk: AI graded itself) |
| 19 | Internationalization (i18n) | | `locale-links.test.ts`; (self-assessed beyond that — no i18n test suite) |
| 20 | SEO Tooling | | `audit:aeo` passes; `aeo-metadata.test.ts` |
| 21 | AEO Tooling | | `audit:aeo` passes; `aeo-metadata.test.ts` — see Rubric 21 section for full feature list |
| 22 | First-Party Data | | `global-privacy-baseline.test.ts`, `privacy-invariants.test.ts` |
| 23 | Content Modeling Flexibility | | `content-modeling.test.ts`; (self-assessed — no dedicated modeling audit) |
| 24 | Schema Migration Safety | | `db-migrate-ops.test.ts`, `d1-migrate-ops.test.ts` |
| 25 | Caching Strategy | | `audit:caching` passes (CI-enforced: Cloudflare Cache API strategy, generic webhook strategy, non-fatal failures, security-headers layer) |
| 26 | Plugin / Extension API | | `plugin-api.test.ts` |
| 27 | Image Optimization | | `image-srcset.test.ts`, `html-optimization.test.ts`; `test:static-site` includes image checks |
| 28 | Real-Time Collaboration | | `content-locking.test.ts`; (self-assessed — no real-time infra visible beyond locking) |
| 29 | Privacy by Design | | `privacy-invariants.test.ts`, `global-privacy-baseline.test.ts` |
| 30 | Open Source Health | | `check:version` passes; (self-assessed for hygiene beyond versioning) |
| 31 | Data Portability | | `data-portability.test.ts` |
| 32 | Upgrade Path / Migration DX | | `upgrade-path-e2e.test.ts` |
| 33 | Import / Migration Tooling | | `wordpress-import.contract.test.ts`, `wordpress-import-branches.test.ts`, `import-api.contract.test.ts` |
| 34 | Content Scheduling | | `content-scheduling.test.ts`, `d1-content-scheduling.test.ts` |
| 35 | E2E Hosted Provider Testing | | `hosted-provider.contract.test.ts`, `cloudflare-provider.integration.test.ts`; see Known gaps — live credentials not available in CI |
| 36 | CLI UX Quality | | `audit:cli-docs` passes (CI-enforced command coverage); 170 Rust CLI tests; (UX quality self-assessed — no UX test suite) |
| 37 | Email Delivery | | `transactional-email.test.ts`, `newsletter-adapter.test.ts` |
| 38 | Search / Discovery | | `content-search.test.ts` |
| 39 | Admin CRUD E2E | | Playwright `admin-harness-crud` project in `test:acceptance` CI |
| 40 | Disaster Recovery | | `disaster-recovery.test.ts` |
| 41 | Monitoring Integration | | `monitoring.test.ts` |
| 42 | Upgrade Path E2E | | `upgrade-path-e2e.test.ts` |
| 43 | System Honesty | | `audit:honesty`, `audit:microcopy`, `audit:providers`, `audit:cli-docs`, `audit:env-contract`, `audit:crypto`, `audit:bdd-wiring`, `audit:no-stub-tests` — all CI-enforced |
| 44 | Multi-site Gateway (astropress-nexus) | | `audit:nexus` passes (CI-enforced: package structure, export coverage, BDD scenario wiring, auth middleware); `audit:bdd-wiring` passes |
| 45 | Scaffold Quality Carryover | | `project-scaffold.test.ts`; (self-assessed for quality dimensions — no scaffold quality CI) |
| 46 | Mobile-Firstness / Responsive Design | | Playwright `viewport-375`, `viewport-768`, `viewport-1280` projects in `test:acceptance` CI |
| 47 | Admin Panel UX Quality | | Playwright `admin-harness-crud` project; (UX quality self-assessed — no task-completion benchmarks) |
| 48 | Nexus UX Quality | | `audit:nexus` passes (CI-enforced: structured error responses with human-readable fields, Bearer token auth middleware verified) |
| 49 | UX Writing & Microcopy | | `audit:microcopy` passes (CI-enforced); (completeness self-assessed) |
| 50 | Information Architecture | | `audit:navigation` passes (CI-enforced: AstropressAdminNavKey required keys, breadcrumb presence) |
| 51 | Navigation Design | | `audit:navigation` passes (CI-enforced: skip-link, aria-current, Escape key, required nav structure) |
| 52 | Interaction Design & Motion | | `audit:interaction` passes (CI-enforced: @keyframes, prefers-reduced-motion, dialog animation, aria-live, dismiss timing) |
| 53 | Cross-Platform Support | | `platform-smoke` CI matrix runs on `ubuntu-latest`, `macos-latest`, `windows-latest` |
| 54 | Test Artifact Cleanup | | `repo:clean` (`assert-clean-worktree.ts`) runs at end of every CI job; Rust uses `TestDir` RAII |
| 55 | Minimalism | | `audit:arch` enforces per-file LOC limits; `audit:dead-exports` passes (CI-enforced: all runtime exports have consumers — no orphaned exports) |
| 56 | Verified Providers / No Speculative Features | | `audit:providers` passes (CI-enforced); `AGENTS.md` no-speculative-features rule |
| 57 | User-Facing Visual Integrity | | `audit:security-policy-integrity` passes (CI-enforced: no hardcoded CSP booleans); Playwright `expectStylesheetsLoaded` on all admin routes |
| 58 | Composition Boundary Hygiene | | `audit:title-composition` passes (CI-enforced: no pre-formatted title props across all pages and examples) |
| 59 | User-Facing Route Coverage | | `audit:user-facing-route-coverage` passes (CI-enforced: zero uncovered static routes per surface — admin, public) |
| 60 | Consumer-Safe Packaging | | `audit:consumer-packaging` passes (CI-enforced: no bare imports); `test:consumer-smoke` and `test:tarball-smoke` verify all routes return HTTP 200 from npm install |

## Known gaps

- **Rubric 35:** Live hosted-provider coverage still depends on maintainer-owned accounts, seeded projects, and teardown automation
- **Rubric 56:** The fictional "Runway" provider was removed in 2026-04-14 after being identified as a hallucinated entry — `audit:providers` now enforces that all provider IDs are verified against `tooling/verified-providers.json`
- **Rubric 46–52:** UX rubrics added 2026-04-12 — no independent user research or usability testing has been conducted
- **Rubric 53:** Windows, macOS, and Linux now have CI smoke coverage and shell parity, but BSD remains best-effort rather than verified support
- **Rubrics 57–60:** Added 2026-04-16 after PR 26 exposed four independent bug classes across 33+ admin pages — audits are CI-enforced but visual regression testing (screenshot diff) is not yet in place

## Grade changes

_No grades recorded yet — pending fresh evaluation._

---

## Rubric 43 — System Honesty

Measures whether the repo's public claims, CLI output, and failure reporting match the implementation instead of presenting a cleaner story than the code can actually prove.

### Evidence

- README, docs, BDD text, and user-facing crypto/readiness wording are audited by `bun run audit:honesty`
- User-facing fallback copy is audited by `bun run audit:microcopy`
- The evaluation `Known gaps` section explicitly states that hosted-provider E2E is not `A+` yet and why
- The compatibility matrix now states Linux/macOS/Windows as verified and BSD as best-effort
- Security docs now describe the actual crypto stack: Argon2id password hashing, KMAC256 token/privacy digests, and ML-DSA-65 webhook signatures

---

## Readiness Verdict

| Area | Verdict | Why |
|---|---|---|
| GitHub readiness | **Yes** | The repo has the expected open-source hygiene, enforced docs/readiness audits, cross-platform smoke lanes, and clean-worktree verification in CI |
| Production readiness | **Yes, with caveats** | The core stack is production-capable for the verified Node 24 / Linux-macOS-Windows matrix, but hosted-provider live E2E remains incomplete and BSD is not a verified target |
| Cross-platform readiness | **Yes for mainstream OSes** | Linux, macOS, and Windows have install/release coverage and CI smoke lanes; BSD is documented as best-effort pending native runner verification |

---

## Rubric 21 — AEO Tooling

Measures how well the framework enables Answer Engine Optimization: structured data, FAQ schema, breadcrumbs, speakable content, sitemap, and llms.txt.

### What this covers

All of:
- FAQ schema via `<AstropressFaqJsonLd>` (auto-injected from `faqItems` frontmatter)
- HowTo schema via `<AstropressHowToJsonLd>` (auto-injected from `howToSteps` frontmatter)
- BreadcrumbList schema via `<AstropressBreadcrumbJsonLd>`
- SpeakableSpecification schema via `<AstropressSpeakableJsonLd>` (CSS or XPath selectors)
- Open Graph and canonical tags via `<AstropressSeoHead>`, with OG image fallback generation
- `sitemap.xml` auto-generated from published content URLs
- `llms.txt` endpoint listing published posts for AI crawlers
- schema.org `DonateAction` JSON-LD in generated `/donate` page (added 2026-04-12)

### Why DonateAction matters

The generated `/donate` page includes a fully-formed `DonateAction` JSON-LD block (`@type: DonateAction`, canonical donate URL), which tells answer engines this is a donation opportunity — improving how AI and search engines represent the site's purpose to users researching nonprofits and OSS funding.

---

## Rubric 45 — Scaffold Quality Carryover

Measures how much of the framework's built-in quality, security, accessibility, and sustainability posture automatically transfers to a new project created with `astropress new`.

### What carries over automatically

| Dimension | What you get for free |
|---|---|
| **Admin security** | Zero-Trust Admin (ZTA) wrappers on every action handler; session hardening; rate-limited login; Argon2id password hashing; KMAC256 token digests; CSRF tokens on all admin forms |
| **Input validation** | All admin form inputs are validated and HTML-sanitized before persistence; SQL injection surface is contained to adapter layer |
| **Admin accessibility** | WCAG 2.2 AA admin panel with keyboard navigation, ARIA live regions, focus traps, and screen-reader-tested components |
| **Privacy defaults** | No third-party analytics, no telemetry; structured GDPR right-of-erasure SQL included |
| **Static-first carbon footprint** | Default scaffold targets GitHub Pages (`output: "static"`) — no always-on server compute; CDN edge delivery |
| **Image optimization** | Automatic srcsets, WebP conversion, and lazy loading when media library is used |
| **Content integrity** | Schema migrations are incremental and forward-only; revision history on all content records |
| **Secrets hygiene** | `.env` is gitignored; generated secrets use cryptographic randomness; bootstrap passwords are disabled flag once set |
| **Public-side security headers** | `src/middleware.ts` is generated with `createAstropressSecurityMiddleware()` — CSP, X-Frame-Options, Permissions-Policy, Referrer-Policy, and X-Request-Id on every response |
| **CSRF protection** | Security middleware wraps all mutating requests on public routes automatically |
| **Linting** | `biome.json` is generated — `bun run lint` and `bun run format` work immediately |
| **Git hooks** | `lefthook.yml` is generated — biome auto-fix, `.env` commit guard, and conventional commit format on pre-commit |
| **Quality CI** | `.github/workflows/quality.yml` runs lint, type-check, and doctor on every push and PR |
| **Host-appropriate Astro config** | `astro.config.mjs` is generated with the correct `output` mode and Vite integration for the chosen host |
| **Working admin on first dev** | SQLite runtime stubs are wired — `astropress dev` opens the admin panel immediately, no manual wiring required |

### What still requires project-specific input

| Dimension | What to do |
|---|---|
| **Test setup** | Add `vitest.config.ts` and test files as needed; QUICK_START.md shows import paths |
| **Public-page accessibility** | User-authored pages start from a blank `<SiteLayout>` shell — author with semantic HTML; use axe or Lighthouse in CI |
| **`registerCms()` customisation** | `src/middleware.ts` calls `registerCms()` with empty defaults — add your `siteUrl`, `templateKeys`, and `archives` |

---

## Small wins (2026-04-12)

Incremental quality and feature improvements made alongside the main rubric work:

| Area | Improvement |
|---|---|
| **Donation integrations** | GiveLively, Liberapay, and PledgeCrypto selectable in `astropress new`; generates `/donate` page with widgets, DNT/GPC consent, and `DonateAction` JSON-LD |
| **Admin fundraising page** | `/ap-admin/fundraising` shows link-mode provider cards for each enabled donation provider; nav item auto-appears when `donations` is configured |
| **DNT/GPC compliance** | GiveLively and PledgeCrypto widgets suppressed when visitor sends `DNT: 1` or `Sec-GPC: 1`; Liberapay (no external JS) always shown |
| **schema.org DonateAction** | Every generated `/donate` page includes a `DonateAction` JSON-LD block with canonical donate URL |
| **Multi-provider CLI selection** | Donation wizard uses `MultiSelect` — operators can enable any combination of Polar, GiveLively, Liberapay, and PledgeCrypto in one prompt |

---

## Rubric 46 — Mobile-Firstness / Responsive Design

Measures whether the public site, admin panel, and Nexus UI are built mobile-first: layouts that work at 320 px, touch-target sizing, fluid typography, and responsive images.

### Criteria

- Admin panel uses CSS Grid / Flexbox with no fixed-pixel widths in layout containers
- All interactive controls meet WCAG 2.5.5 (44 × 44 px minimum touch target)
- Images use `srcset` + `sizes` — no full-resolution images served to narrow viewports
- Media query breakpoints ordered mobile-first (`min-width`, not `max-width`)
- Nexus dashboard is usable at 375 px (single-column stacking)

### What would improve this

- Dedicated viewport regression tests (Playwright at 375 px, 768 px, 1280 px)
- `meta viewport` correctness test in doctor command
- Container-query–based admin sidebar that adapts without a media query

---

## Rubric 47 — Admin Panel UX Quality

Measures the quality of the operator experience in `/ap-admin`: task completion speed, error recovery, affordance clarity, and consistency.

### Criteria

- All CRUD flows complete in ≤ 3 clicks from the dashboard
- Inline validation with specific error messages (not just "invalid")
- Destructive actions (delete, publish) gated by confirmation dialogs
- Form state is preserved across navigation (no data loss on back-button)
- Consistent heading hierarchy and button labelling across all admin pages

### What would improve this

- Undo support for delete actions (30-second grace window)
- Keyboard shortcut map accessible from a `?` modal
- Dedicated usability test suite (task-completion time benchmarks)
- Operator onboarding tour for first-time admin login

---

## Rubric 48 — Nexus UX Quality

Measures the multi-site management experience in `astropress-nexus`: how easily an operator can monitor, configure, and act across multiple Astropress instances.

### Criteria

- Site list shows health status, last-deploy timestamp, and content count at a glance
- Cross-site navigation is ≤ 2 clicks from any site's detail page
- Bulk actions (redeploy all, sync all) available from the site list
- Error states per-site are surfaced inline (not just in logs)

### What would improve this

- Unified content search across all sites
- Side-by-side site comparison view
- Dedicated Playwright suite for Nexus flows

---

## Rubric 49 — UX Writing & Microcopy

Measures the quality of all human-facing text: error messages, empty states, help text, button labels, onboarding copy, and CLI output.

### Criteria

- Error messages identify the problem and suggest a fix ("No posts found. Create your first post →")
- Empty states are never blank — every empty list has a call-to-action
- Button labels use verb phrases ("Save draft", not "Submit")
- CLI output uses plain English, not internal identifiers (`"Scaffolded project at ./my-site"`, not `"exit 0"`)
- `astropress doctor` report uses human-readable pass/warn/fail language

### What would improve this

- Dedicated UX writing style guide (voice, tone, terminology)
- Automated microcopy consistency lint (flag `"Please try again"`, `"An error occurred"`, etc.)
- i18n-ready CLI output (format strings, not interpolated sentences)

---

## Rubric 50 — Information Architecture

Measures how content, settings, and tools are organised and labelled across the admin panel, Nexus, and CLI so operators can find what they need without documentation.

### Criteria

- Admin sidebar groups items by domain (Content, Media, Settings, Integrations) — not by implementation detail
- Settings are split from content operations — no mixing of "write a post" and "configure email" in the same menu level
- CLI commands follow a consistent `noun verb` pattern (`astropress db migrate`, `astropress services verify`)
- `astropress list tools` provides a discoverable entry point for all available options

### What would improve this

- Card-sort test result informing nav labels
- Search-within-admin (⌘K command palette)
- Progressive disclosure: advanced settings collapsed by default

---

## Rubric 51 — Navigation Design

Measures whether operators can orient themselves and move through the system efficiently: wayfinding, breadcrumbs, active states, and skip links.

### Criteria

- Admin panel has a persistent sidebar with active-page indicator
- All admin pages ≥ 2 levels deep show a breadcrumb
- Skip-navigation link present for keyboard users (already enforced by a11y arch-lint)
- CLI help output groups related subcommands together (not alphabetical soup)

### What would improve this

- "Recent" section in admin sidebar for last 5 edited items
- Sticky section headers in long list views
- Nexus: global breadcrumb that includes the current site name

---

## Rubric 52 — Interaction Design & Motion

Measures the quality of transitions, feedback loops, loading states, and micro-interactions in the admin panel and Nexus.

### Criteria

- All async operations show a loading indicator within 100 ms
- Form submission success/failure is communicated with an ARIA live region (already required by a11y rules)
- Toasts auto-dismiss after ≥ 4 seconds (not ≤ 3 — WCAG 2.2.1)
- No layout shift during page transitions (CLS = 0 for admin routes)

### What would improve this

- `prefers-reduced-motion` respected for all CSS transitions
- Skeleton loaders instead of spinners for content-heavy list views
- Optimistic UI for post publish/unpublish toggle

---

## Rubric 53 — Cross-Platform Support

Measures whether the developer workflow, CLI, release artifacts, and test matrix are genuinely portable across Windows, macOS, Linux, and BSD-family systems.

### Evidence

- `tooling/scripts/install.sh` supports macOS, Linux, FreeBSD, OpenBSD, and NetBSD
- `tooling/scripts/install.ps1` provides a native PowerShell bootstrap path for Windows
- `.github/workflows/cli-release.yml` builds CLI binaries for Linux, macOS, and Windows
- `.github/workflows/ci.yml` now runs a `platform-smoke` matrix on `ubuntu-latest`, `macos-latest`, and `windows-latest`
- The root `package.json` `test:cli` script is shell-agnostic and works without Bash-specific `source` setup
- Shell completions cover `bash`, `zsh`, `fish`, and `powershell`
- `docs/COMPATIBILITY.md` publishes support tiers and the verified cross-platform command set
- The Rust CLI has a `--plain` / `--no-tui` fallback, which reduces dependence on terminal-specific raw-mode support
- BSD is explicitly called out as an upstream and CI gap in `docs/UPSTREAM_CONTRIBUTIONS.md`

### What keeps this from an A+

- Define a documented BSD support tier and verify at least one BSD target in CI or a self-hosted runner
- Run browser or static-build smoke tests on macOS in addition to Linux

---

## Rubric 54 — Test Artifact Cleanup

Measures whether automated tests and local verification runs clean up their temporary directories, generated databases, and repo-local artifacts so reruns do not leave avoidable residue behind.

### Evidence

- The Rust CLI test harness uses `TestDir` RAII cleanup and an orphan sweep for `astropress-cli-*` / `astropress-*` temp directories in `crates/astropress-cli/src/tests/mod.rs`
- Many Vitest suites create temp workspaces under `tmpdir()` and remove them with `rm`, `rmSync`, or `afterEach` cleanup hooks
- Import and migration tests generally keep generated files in temporary directories rather than under committed paths

### What keeps this from an A+

- Repo-level smoke commands such as `bun run test:example` and some docs/example verification paths can still leave generated `.data/` directories in the worktree
- There is no CI assertion that the repo stays clean after the verification suite finishes

---

## Rubric 55 — Minimalism

Measures whether the codebase contains only what is needed to do the job — no speculative abstractions, no dead code, no premature generality, no helpers written for a single caller, no config options that nothing reads.

### Criteria

- Every exported symbol has at least one call site outside its own file
- No utility functions whose entire body could be inlined at the one place they're called
- No feature flags, environment checks, or backwards-compatibility shims for scenarios that no longer exist
- LOC per file stays within arch-lint limits without needing exceptions
- No commented-out code blocks committed to the repo
- No `_unused` parameters or renamed-to-suppress-warning variables
- Abstractions exist to serve two or more concrete callers, not to anticipate future ones

### What would improve this

- An automated dead-export lint (e.g. `ts-prune` or `knip`) run in CI
- Periodic `bun run audit:arch` line-count review to catch files creeping toward the 600-line ceiling
- A contributing guideline that explicitly forbids one-off helpers and speculative config fields

---

## Rubric 56 — Verified Providers / No Speculative Features

Measures whether every hosting provider, data service, and third-party integration referenced in the codebase corresponds to a real, publicly available service that was explicitly requested — not a plausible-sounding invention.

### Why this rubric exists

The fictional "Runway" hosting provider was present in the type system, adapter layer, CLI wizard, deployment matrix, README, and tests for an extended period. It was not requested, had no real URL (`runway.example`), and was never caught by the existing honesty audit because that audit checked text claims, not whether referenced entities actually existed. Two independent AI coding agents both missed it across multiple evaluation runs with cleared context.

The root cause is that language models fill gaps with plausible-sounding completions. A hallucinated provider is indistinguishable from a real one in code.

### Evidence

- `tooling/verified-providers.json` is the source of truth: every `AstropressAppHost` and `AstropressDataServices` ID must have a corresponding entry with a verified URL
- `bun run audit:providers` (CI-enforced) compares the TypeScript type unions against `verified-providers.json` and fails if any ID is unverified
- `AGENTS.md` contains an explicit "No speculative features" rule: no provider, integration, or service enters the type system without being explicitly named by the user and verified against a real public URL
- The `audit:providers` check runs in the `lint` CI job alongside `audit:honesty`, `audit:security`, and `audit:aeo`

### Criteria for A+

- Every ID in `AstropressAppHost` has a verified entry in `verified-providers.json` with a real URL — `audit:providers` passes
- Every ID in `AstropressDataServices` has a verified entry in `verified-providers.json` with a real URL — `audit:providers` passes
- No adapter file exists without a corresponding verified-providers entry
- The AGENTS.md no-speculative-features rule is present and up to date
- Zero hallucinated providers or integrations in the git history since this rubric was introduced

---

## Rubric 57 — User-Facing Visual Integrity

Measures whether security policies (CSP, CORS, etc.) are configured so that user-facing pages render correctly in every environment — production builds, dev mode, and npm-consumer installs — without relaxing security in production.

### Why this rubric exists

The PR 26 bug chain started with `allowInlineStyles: true` hardcoded in AdminLayout.astro, which weakened production CSP for all admin pages. Separately, the security middleware entrypoint omitted the flag entirely, which blocked Vite's inline `<style>` injection in dev mode — producing an unstyled login page that passed all DOM-based tests but was visually broken.

The root cause is that security-policy flags have a dev/prod split that must be expressed as `import.meta.env.DEV`, never as a literal boolean. Hardcoding `true` weakens production; hardcoding `false` breaks development.

### Criteria

- No hardcoded `allowInlineStyles: true` or `false` outside of type definitions and tests — `audit:security-policy-integrity` passes
- Every user-facing Playwright spec asserts `expectStylesheetsLoaded(page)` — CSS actually renders, not just DOM presence
- Security middleware entrypoints use `import.meta.env.DEV` for all environment-dependent policy relaxations
- The same page must pass both a dev-mode visual check (Playwright with Vite) and a production CSP audit

### What would improve this

- Automated visual regression tests (screenshot diff) on key pages across dev and production modes
- CSP-Report-Only monitoring in staging to catch policy violations before they break users

---

## Rubric 58 — Composition Boundary Hygiene

Measures whether components that format or wrap values receive raw inputs, not pre-formatted ones — preventing double-application of formatting, suffixes, or transformations.

### Why this rubric exists

33 admin pages passed `title="Dashboard | Astropress Admin"` to `<AdminLayout>`, which internally calls `buildAstropressAdminDocumentTitle(title)` to append `" | Astropress Admin"`. The result was `"Dashboard | Astropress Admin | Astropress Admin"` in every browser tab. The bug persisted undetected because no test inspected the actual `<title>` content.

This is a general pattern: whenever a parent component applies formatting (title suffix, breadcrumb prefix, meta tag wrapper), the child must pass the raw value. The audit must cover all layout components and all page types — admin, public, and examples.

### Criteria

- No `.astro` page passes a `title=` prop containing a brand/site suffix — `audit:title-composition` passes
- No non-layout page has a hardcoded `<title>` tag with a brand suffix
- Layout components are the single source of truth for document title formatting
- The audit covers packages/astropress/pages/, packages/astropress/components/, and examples/

### What would improve this

- Playwright assertion on `document.title` in key routes to verify the formatted output is correct (not just that the input is raw)
- TypeScript branded type for raw titles (e.g. `RawPageTitle`) that prevents passing a formatted string at compile time

---

## Rubric 59 — User-Facing Route Coverage

Measures whether every static route that renders HTML to a user has at least one automated test that visits it, verifies it returns HTTP 200, and checks its primary content.

### Why this rubric exists

Before PR 26, 73% of admin routes had zero Playwright or smoke-test coverage. Bugs affecting title formatting, CSP, and import resolution went undetected across dozens of pages because no test ever navigated to them. The admin route coverage audit caught this for `/ap-admin/` routes, but the same gap can occur on public pages, auth flows, and example sites.

### Criteria

- Every static admin route is covered by Playwright or HTTP smoke test — `audit:admin-route-coverage` passes
- Every static public route (example site) is covered by Playwright — `audit:user-facing-route-coverage` passes
- Zero uncovered static routes allowed on any surface
- Dynamic routes (containing `[param]`) are excluded from mandatory coverage but should have representative instances in smoke tests

### What would improve this

- Automatic route discovery from the Astro build manifest (instead of .astro file walking) to catch programmatic routes
- Per-route assertion that the page's `<h1>` matches its intended heading (catches silent redirects and 500-to-fallback scenarios)

---

## Rubric 60 — Consumer-Safe Packaging

Measures whether the package works correctly when installed from npm (not just within the monorepo workspace), and whether all published source files use import paths that resolve outside the workspace.

### Why this rubric exists

Admin pages used `from "astropress/..."` (bare imports) which resolved correctly in the monorepo via Vite aliases, but broke with a 500 error for real npm consumers. Vite 7's module runner does not invoke `resolveId` plugins for bare specifiers imported from within `node_modules`, so the published pages must use the scoped package name `@astropress-diy/astropress/...` directly.

This class of bug is invisible to workspace-based tests. The only way to catch it is to test the actual packaged artifact.

### Criteria

- No bare `from "astropress/"` imports in published pages or components — `audit:consumer-packaging` passes
- `test:consumer-smoke` boots the npm-consumer-smoke example and asserts HTTP 200 on all admin routes
- `test:tarball-smoke` packs the tarball, installs it in a fresh project, and verifies all routes
- Package exports map in `package.json` covers all public entry points (components, subpath exports)

### What would improve this

- Automated `npm pack --dry-run` size check to catch accidentally bundled dev dependencies
- Import-map verification: parse every published `.astro` file's imports and verify each resolves against the package exports map
