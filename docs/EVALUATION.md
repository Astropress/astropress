# Astropress Evaluation

**Baseline (as of 2026-04-13, updated):** 1540+ Vitest tests · 159 Rust CLI tests · 10 Playwright tests · 334 BDD scenarios · security audit clean

## Grades

Grade scale: `A+ / A / B / C / D / F`

| # | Rubric | Grade |
|---|--------|-------|
| 1 | Spec Fidelity | A |
| 2 | Architecture Quality | A+ |
| 3 | Test Quality | A+ |
| 4 | Security Posture | A+ |
| 5 | Accessibility | A+ |
| 6 | Performance | A |
| 7 | Developer Ergonomics | A+ |
| 8 | Browser / Web API Usage | A+ |
| 9 | Web Components | A+ |
| 10 | Spec Coherence (WC First-Class) | A+ |
| 11 | CI/CD Pipeline | A+ |
| 12 | Dependency Management | A |
| 13 | Documentation | A+ |
| 14 | Observability / Logging | A |
| 15 | API Design | A+ |
| 16 | Error Handling | A+ |
| 17 | TypeScript Quality | A+ |
| 18 | AI Drivability | A+ |
| 19 | Internationalization (i18n) | A+ |
| 20 | SEO Tooling | A |
| 21 | AEO Tooling | A+ |
| 22 | First-Party Data | A |
| 23 | Content Modeling Flexibility | A |
| 24 | Schema Migration Safety | A |
| 25 | Caching Strategy | A |
| 26 | Plugin / Extension API | A |
| 27 | Image Optimization | A |
| 28 | Real-Time Collaboration | A |
| 29 | Privacy by Design | A+ |
| 30 | Open Source Health | A+ |
| 31 | Data Portability | A |
| 32 | Upgrade Path / Migration DX | A |
| 33 | Import / Migration Tooling | A |
| 34 | Content Scheduling | A |
| 35 | E2E Hosted Provider Testing | B |
| 36 | CLI UX Quality | A+ |
| 37 | Email Delivery | A |
| 38 | Search / Discovery | A |
| 39 | Admin CRUD E2E | A+ |
| 40 | Disaster Recovery | A |
| 41 | Monitoring Integration | A |
| 42 | Upgrade Path E2E | A |
| 43 | System Honesty | A |
| 44 | Multi-site Gateway (astropress-nexus) | A |
| 45 | Scaffold Quality Carryover | A+ |
| 46 | Mobile-Firstness / Responsive Design | A |
| 47 | Admin Panel UX Quality | A |
| 48 | Nexus UX Quality | A |
| 49 | UX Writing & Microcopy | A |
| 50 | Information Architecture | A+ |
| 51 | Navigation Design | A |
| 52 | Interaction Design & Motion | A |
| 53 | Cross-Platform Support | A |
| 54 | Test Artifact Cleanup | B |

## Known gaps

- **Rubric 4 / 43:** New passwords use PBKDF2-HMAC-SHA-512, but SHA-256 remains in token/webhook/comment digests and legacy password verification; no post-quantum cryptography is implemented
- **Rubric 35:** Live hosted-provider coverage still depends on maintainer-owned accounts, seeded projects, and teardown automation; see `HOSTED_E2E_SETUP.md`
- **Rubric 37:** Transactional email runtime and docs are not fully unified around one canonical provider contract yet
- **Rubric 44 / 48:** `astropress-nexus` is still API-first; the operator dashboard and bulk-action UX from the A+ plan are not implemented yet
- **Rubric 46–52:** UX rubrics added 2026-04-12 — no independent user research or usability testing has been conducted
- **Rubric 53:** Windows, macOS, and Linux now have CI smoke coverage and shell parity, but BSD remains best-effort rather than verified support
- **Rubric 54:** Rust CLI temp directories self-clean, but some local example/docs runs can still leave generated `.data/` artifacts unless they are explicitly removed

## Grade changes (2026-04-13 audit)

| Rubric | Old | New | Reason |
|--------|-----|-----|--------|
| 43 — System Honesty | A+ | A | Public docs and CLI wording overstated parts of the crypto story and hosted-test coverage; current wording is corrected, but the audit is still manual rather than CI-enforced |
| 54 — Test Artifact Cleanup | New | B | Rust CLI tests sweep and delete temp directories, but local repo-level verification can still leave generated `.data/` directories in the worktree |

---

## Rubric 43 — System Honesty

**Grade: A**

Measures whether the repo's public claims, CLI output, and failure reporting match the implementation instead of presenting a cleaner story than the code can actually prove.

### Evidence

- README, docs, and CLI wording were audited and corrected where they overstated hosted-provider coverage or cryptography details
- `HOSTED_E2E_SETUP.md` explicitly states that hosted-provider E2E is not `A+` yet and why
- The compatibility matrix now states Linux/macOS/Windows as verified and BSD as best-effort
- Security docs now distinguish PBKDF2-HMAC-SHA-512 password hashing for new passwords from the remaining SHA-256 token, webhook, comment-email, and legacy-password paths

### What keeps this from an A+

- Public-claim review is still a manual audit, not a generated or CI-enforced truth check
- The repo still contains conventional SHA-256 paths and no post-quantum cryptography, so security wording must stay precise to avoid overclaiming

---

## Readiness Verdict

| Area | Verdict | Why |
|---|---|---|
| GitHub readiness | **Yes** | The repo has a licence, contributing guide, code of conduct, security policy, issue templates, CODEOWNERS, Dependabot, CodeQL/security workflows, and automated release/docs pipelines |
| Production readiness | **Yes, with caveats** | The framework has strong architecture, tests, security defaults, and deployment automation, but it is still `0.0.1`, hosted-provider E2E coverage is incomplete, and some docs are ahead of others |
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
| **Admin security** | Zero-Trust Admin (ZTA) wrappers on every action handler; session hardening; rate-limited login; PBKDF2-HMAC-SHA-512 for new password hashes; CSRF tokens on all admin forms |
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

**Grade: A**

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

**Grade: B**

Measures whether automated tests and local verification runs clean up their temporary directories, generated databases, and repo-local artifacts so reruns do not leave avoidable residue behind.

### Evidence

- The Rust CLI test harness uses `TestDir` RAII cleanup and an orphan sweep for `astropress-cli-*` / `astropress-*` temp directories in `crates/astropress-cli/src/tests/mod.rs`
- Many Vitest suites create temp workspaces under `tmpdir()` and remove them with `rm`, `rmSync`, or `afterEach` cleanup hooks
- Import and migration tests generally keep generated files in temporary directories rather than under committed paths

### What keeps this from an A+

- Repo-level smoke commands such as `bun run test:example` and some docs/example verification paths can still leave generated `.data/` directories in the worktree
- There is no CI assertion that the repo stays clean after the verification suite finishes
