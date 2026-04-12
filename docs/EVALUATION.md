# Astropress Evaluation

**Baseline (as of 2026-04-11):** 1540+ Vitest tests · 63 Rust CLI tests · 10 Playwright tests · 280+ BDD scenarios · security audit clean

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
| 21 | AEO Tooling | A |
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
| 45 | Scaffold Quality Carryover | B |

## Key gaps

- **Rubric 35 (B):** Adapter tests use mocks — no integration tests against real D1, Supabase, or Appwrite services
- **Rubric 45 (B):** Security middleware not scaffolded — fresh projects have no CSP, CSRF protection, or rate limiting until `src/middleware.ts` is hand-wired; no test or lint tooling in scaffold
- **Rubric 1:** WordPress/Wix import is staged CLI-only; no admin UI wizard
- **Rubric 13:** `docs/API_REFERENCE.md` is regex-generated — no parameter or return types
- **Rubric 38:** No full-text search across content records
- **Rubric 7:** 95 export paths; the "top 6" cheat sheet in QUICK_START.md helps but the full list is large

## Rubric 45 — Scaffold Quality Carryover

**Grade: B**

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

### What requires manual wiring

| Dimension | Gap | How to close it |
|---|---|---|
| **Public-side security headers** | No `src/middleware.ts` is generated — scaffolded site has no CSP, HSTS, X-Frame-Options, or Permissions-Policy | Add `src/middleware.ts` importing `createAstropressSecurityMiddleware` from `astropress/integration` |
| **CSRF on public forms** | Contact forms and newsletter signup are not CSRF-protected until middleware is wired | Same as above — middleware wraps all mutating requests |
| **Rate limiting on public routes** | No IP-level rate limiting on scaffolded project | Middleware option; or provider-level (Cloudflare WAF, Vercel Edge) |
| **Linting** | No Biome/ESLint config in scaffold | Add `biome.json` or run `bunx biome init` |
| **Test setup** | No `vitest.config.ts`, no test files | Add as needed; QUICK_START.md shows import paths |
| **Git hooks** | No Lefthook or Husky config | Add `lefthook.yml` to enforce pre-commit checks |
| **Public-page accessibility** | User-authored pages start from a blank `<SiteLayout>` shell — no semantic structure enforced | Author with semantic HTML; use axe or Lighthouse in CI |
| **`astropress.config.ts`** | `registerCms()` is not generated — content types, analytics, locales must be registered manually | Create `astropress.config.ts` with `registerCms({ siteUrl, ... })` |

### Why B and not higher

The single most impactful gap is the absent security middleware. A scaffold-and-deploy workflow without reading the docs produces a site with no Content-Security-Policy and no CSRF protection on public forms. The framework has all the necessary pieces (`createAstropressSecurityMiddleware` is well-designed and simple to wire), but the scaffold does not include the file that activates them. An A-grade scaffold would generate a pre-wired `src/middleware.ts` with safe defaults and inline comments.
