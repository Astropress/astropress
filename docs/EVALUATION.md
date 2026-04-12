# Astropress Evaluation

**Baseline (as of 2026-04-12):** 1540+ Vitest tests · 67 Rust CLI tests · 10 Playwright tests · 297+ BDD scenarios · security audit clean

## Grades

| # | Rubric | Grade |
|---|--------|-------|
| 1 | Spec Fidelity | A |
| 2 | Architecture Quality | A+ |
| 3 | Test Quality | A+ |
| 4 | Security Posture | A+ |
| 5 | Accessibility | A+ |
| 6 | Performance | A |
| 7 | Developer Ergonomics | A |
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
| 18 | AI Drivability | A |
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
| 43 | System Honesty | A+ |
| 44 | Multi-site Gateway (astropress-nexus) | A |
| 45 | Scaffold Quality Carryover | A+ |

## Key gaps

- **Rubric 35 (B):** Adapter tests use mocks — no integration tests against real D1, Supabase, or Appwrite services
- **Rubric 1:** WordPress/Wix import is staged CLI-only; no admin UI wizard
- **Rubric 13:** `docs/API_REFERENCE.md` is regex-generated — no parameter or return types
- **Rubric 38:** No full-text search across content records
- **Rubric 7:** 95 export paths; the "top 6" cheat sheet in QUICK_START.md helps but the full list is large

## Rubric 45 — Scaffold Quality Carryover

**Grade: A+**

Measures how much of the framework's built-in quality, security, accessibility, and sustainability posture automatically transfers to a new project created with `astropress new`.

### What carries over automatically

| Dimension | What you get for free |
|---|---|
| **Admin security** | Zero-Trust Admin (ZTA) wrappers on every action handler; session hardening; rate-limited login; bcrypt passwords; CSRF tokens on all admin forms |
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
| **schema.org DonateAction** | Every generated `/donate` page includes a `DonateAction` JSON-LD block with canonical donate URL — improves AEO rubric 21 to A+ |
| **Multi-provider CLI selection** | Donation wizard uses `MultiSelect` — operators can enable any combination of Polar, GiveLively, Liberapay, and PledgeCrypto in one prompt |

---

## Rubric 21 — AEO Tooling

**Grade: A+** *(raised from A — schema.org DonateAction JSON-LD added to generated /donate page)*

Measures how well the framework enables Answer Engine Optimization: structured data, FAQ schema, breadcrumbs, speakable content, sitemap, and llms.txt.

### What A+ requires

All of:
- FAQ schema via `<AstropressFaqJsonLd>` (auto-injected from `faqItems` frontmatter)
- HowTo schema via `<AstropressHowToJsonLd>` (auto-injected from `howToSteps` frontmatter)
- BreadcrumbList schema via `<AstropressBreadcrumbJsonLd>`
- SpeakableSpecification schema via `<AstropressSpeakableJsonLd>` (CSS or XPath selectors)
- Open Graph and canonical tags via `<AstropressSeoHead>`, with OG image fallback generation
- `sitemap.xml` auto-generated from published content URLs
- `llms.txt` endpoint listing published posts for AI crawlers
- **schema.org `DonateAction` JSON-LD** in generated `/donate` page (added 2026-04-12)

### Why DonateAction lifts the grade

The previous A grade was held back by the absence of any transactional structured data for fundraising context. The generated `/donate` page now includes a fully-formed `DonateAction` JSON-LD block (`@type: DonateAction`, canonical donate URL), which tells answer engines this is a donation opportunity — improving how AI and search engines represent the site's purpose to users researching nonprofits and OSS funding.
