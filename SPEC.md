# Astropress Specification

## Scope

This is the top-level specification for the Astropress monorepo. It describes the product identity, data model, contracts, and boundaries as they exist today.

Repo-scoped specs for individual packages live at:

- `packages/astropress/SPEC.md` — the published npm package
- `examples/github-pages/SPEC.md` — the static example/docs site

## Product

Astropress is a **web application development framework** built on Astro. It ships a headless admin panel, a REST API, and a SQLite runtime that host applications compose into their own sites.

It targets individuals and small organizations that need:

- a content admin panel without building one from scratch
- a privacy-first, self-hosted stack with no forced third-party analytics or tracking
- WordPress or Wix migration without bespoke engineering
- deployment portability across static, edge, managed database, and application-platform providers
- a lower operational footprint than a traditional always-on PHP/WordPress stack

Astropress is **not** a CMS, a hosted service, or a generic site builder. `registerCms()` is the framework's configuration API, not a CMS product declaration. It stays opinionated enough that sites remain simple to operate and cheap to host.

## Canonical Data Model

The canonical source of truth is a database-backed content store, not git.

### Database tables (SQLite reference schema)

| Table | Purpose |
|-------|---------|
| `admin_users` | User accounts with email, password hash, role (admin/editor) |
| `admin_sessions` | Opaque token sessions with CSRF, TTL, revocation |
| `audit_events` | Immutable action log with actor, resource, timestamp |
| `content_overrides` | Editorial changes to seed data (status, body, SEO, metadata, scheduling) |
| `content_entries` | User-created content records (pages and posts) |
| `content_revisions` | Full snapshot history of content changes |
| `content_locks` | Pessimistic edit locks with expiry and heartbeat |
| `authors` | Author records with slug, name, bio |
| `categories` | Taxonomy: categories |
| `tags` | Taxonomy: tags |
| `content_authors` | Join: content ↔ authors |
| `content_categories` | Join: content ↔ categories |
| `content_tags` | Join: content ↔ tags |
| `redirect_rules` | URL redirect rules (301/302) |
| `comments` | Public comments with moderation status |
| `media_assets` | Uploaded media with dimensions, thumbnails, srcset, alt text |
| `translation_overrides` | Per-route translation state |
| `site_settings` | Singleton site configuration |
| `cms_route_groups` | Structured page route definitions |
| `cms_route_variants` | Locale-specific route variants |
| `cms_route_aliases` | Alternate URL paths for route variants |
| `cms_route_revisions` | Revision history for structured routes |
| `contact_submissions` | Public contact form submissions |
| `rate_limits` | Per-key request rate limiting |
| `api_tokens` | Hashed API tokens with scopes and expiry |
| `schema_migrations` | Migration bookkeeping with rollback SQL |

Git is a secondary synchronization substrate used for static-host deployment inputs, backup/disaster recovery, and migration handoff artifacts.

## Provider Model

Astropress treats providers as interchangeable adapters behind stable contracts.

### Content service adapters (implemented)

| Adapter | Import path | Status |
|---------|-------------|--------|
| SQLite (local) | `astropress/adapters/sqlite` | Full — reference implementation |
| Cloudflare D1 + R2 | `astropress/adapters/cloudflare` | Full |
| Supabase (Postgres + Storage) | `astropress/adapters/supabase` | Full |
| Runway | `astropress/adapters/runway` | Full |
| Appwrite | `astropress/adapters/appwrite` | Full |
| PocketBase | `astropress/adapters/pocketbase` | Hosted API adapter (no dedicated tests in evaluation) |

### Recognized content services (scaffold/env selection — no adapter yet)

| Service | Notes |
|---------|-------|
| Neon | Database-only; no object storage or auth |
| Nhost | Full-stack services; adapter not yet implemented |

### App host deploy targets (implemented)

| Target | Import path |
|--------|-------------|
| GitHub Pages | `astropress/deploy/github-pages` |
| Cloudflare Pages | `astropress/deploy/cloudflare-pages` |
| Vercel | `astropress/deploy/vercel` |
| Netlify | `astropress/deploy/netlify` |
| Render | `astropress/deploy/render` |
| GitLab Pages | `astropress/deploy/gitlab-pages` |
| Custom | `astropress/deploy/custom` |

### Rules

- Admin behavior must not fork by provider in templates
- Provider differences must stay inside adapter implementations
- Any provider with a database and object-store equivalent should be addable without redesigning the framework core
- The `AstropressPlatformAdapter` interface in `platform-contracts.ts` is the single adapter contract

## Admin Contract

The admin panel is for non-technical users. It runs at `/ap-admin/` and is composed of Astro pages injected by the framework.

### Admin surfaces

| Surface | Route | What it does |
|---------|-------|--------------|
| Dashboard | `/ap-admin/` | Overview with content counts |
| Posts | `/ap-admin/posts` | CRUD, scheduling, workflow filters, custom fields |
| Pages | `/ap-admin/pages` | Structured page editing |
| Route Pages | `/ap-admin/route-pages` | CMS route group management |
| Archives | `/ap-admin/archives` | Archive listing management |
| Authors | `/ap-admin/authors` | Author management |
| Taxonomies | `/ap-admin/taxonomies` | Categories and tags |
| Media | `/ap-admin/media` | Upload, thumbnail generation, alt text |
| Comments | `/ap-admin/comments` | Moderation workflow (pending/approved/rejected) |
| Redirects | `/ap-admin/redirects` | URL redirect rules |
| Translations | `/ap-admin/translations` | Per-route translation state |
| SEO | `/ap-admin/seo` | Global SEO settings |
| Users | `/ap-admin/users` | User management and invitations |
| Settings | `/ap-admin/settings` | Site settings |
| System | `/ap-admin/system` | System info and diagnostics |
| API Tokens | `/ap-admin/api-tokens` | Token creation, scope management, revocation |
| Webhooks | `/ap-admin/webhooks` | Webhook registration and event selection |
| Services | `/ap-admin/services` | Analytics, A/B testing, host panel (provider-specific) |
| CMS Panel | `/ap-admin/cms` | Optional external CMS iframe/link |
| Host Panel | `/ap-admin/host` | Provider infrastructure panel |

### Admin requirements

- Every editable content surface must be manageable in the admin panel
- Git knowledge may not be required for publishing or editing
- Provider-specific credentials and deploy actions must be abstracted into task-oriented UI
- The admin must work on mobile viewports (responsive layout, mobile nav toggle)

### Admin customization

Host apps customize via `registerCms({ admin: { branding, labels, navigation } })`:
- **Branding**: app name, logo, favicon, custom stylesheet
- **Labels**: all auth and navigation strings are overridable
- **Navigation**: sidebar items can be renamed

## REST API Contract

The REST API runs at `/ap-api/v1/` when `config.api.enabled` is `true`.

### Endpoints

| Method | Path | Scope |
|--------|------|-------|
| GET/POST | `/ap-api/v1/content` | content:read / content:write |
| GET/PUT/DELETE | `/ap-api/v1/content/{id}` | content:read / content:write |
| GET/POST | `/ap-api/v1/media` | media:read / media:write |
| DELETE | `/ap-api/v1/media/{id}` | media:write |
| GET | `/ap-api/v1/revisions/{recordId}` | content:read |
| GET | `/ap-api/v1/settings` | settings:read |
| GET/POST | `/ap-api/v1/webhooks` | webhooks:manage |
| GET | `/ap-api/v1/metrics` | content:read |
| GET | `/ap-api/v1/openapi.json` | (no auth) |
| GET | `/ap-api/v1/og-image/[slug].png` | (no auth) |

### API features

- Bearer token auth with scoped tokens
- Cursor-based pagination (`?cursor=`) with HATEOAS `_links`
- Offset/page pagination for backwards compatibility
- `X-Total-Count` header on list endpoints
- `ETag` / `304 Not Modified` on single-record GET
- `X-Request-Id` per-request trace header
- Webhook dispatch on content events
- OpenAPI 3.1 spec at `/ap-api/v1/openapi.json`

## MCP Server Contract

The `astropress-mcp` package provides an MCP server for AI agents.

Tools: `list_content`, `get_content`, `create_content`, `update_content`, `list_media`, `get_site_settings`, `get_health`, `get_revisions`.

Transport: stdio. Configured via `ASTROPRESS_API_URL` and `ASTROPRESS_API_TOKEN` env vars.

## CLI Contract

The CLI is authored as a Cargo crate (`crates/astropress-cli/`) and exposed through the npm package wrapper or prebuilt binaries.

### Implemented commands

| Command | Purpose |
|---------|---------|
| `astropress new <name>` | Scaffold a new project (interactive wizard with provider/host/analytics selection) |
| `astropress dev` | Start local dev server |
| `astropress doctor [--json] [--strict]` | Project health check |
| `astropress import wordpress` | Staged WordPress WXR import (parse → download → apply) |
| `astropress import wix` | Staged Wix CSV import |
| `astropress deploy [--target]` | Trigger deployment |
| `astropress backup --output <dir>` | Export SQLite snapshot |
| `astropress restore --from <dir>` | Restore from snapshot |
| `astropress sync export` | Alias for backup |
| `astropress sync import` | Alias for restore |
| `astropress services bootstrap` | Initialize content services |
| `astropress services verify` | Verify content service connectivity |
| `astropress db migrate [--dry-run]` | Run schema migrations |
| `astropress db rollback [--dry-run]` | Roll back the last applied migration using stored rollback SQL |
| `astropress config migrate [--dry-run]` | Migrate project config files |
| `astropress upgrade --check` | Check version compatibility and schema state |

### Import pipeline

Both WordPress and Wix imports support:
- `--artifact-dir` — output directory for structured JSON artifacts
- `--download-media` — download attachment assets
- `--apply-local` — apply staged artifacts into local SQLite
- `--resume` — re-enter a previous import, skipping already-downloaded media
- `--fetch` — Playwright-based authenticated export download

The generic page crawler (`page-crawler.ts`) enables import from any live site.

## Web Components Contract

Seven web components in `packages/astropress/web-components/`:

| Component | Purpose |
|-----------|---------|
| `<ap-admin-nav>` | Sidebar nav with keyboard support, `aria-current` |
| `<ap-html-editor>` | Rich text editor with toolbar, preview, URL dialog |
| `<ap-confirm-dialog>` | Generic confirm dialog using `<dialog>` + `<form method="dialog">` |
| `<ap-theme-toggle>` | Light/dark toggle with `prefers-color-scheme` fallback |
| `<ap-stale-tab-warning>` | BroadcastChannel-based stale-tab and session-TTL warning |
| `<ap-notice>` | Accessible notification with `role=status`, `aria-live=polite`, auto-dismiss |
| `<ap-lock-indicator>` | Server-side pessimistic lock with heartbeat and conflict banner |

All are light DOM, zero-dependency, attribute-driven, and progressively enhanced.

## Security Model

- **CSRF**: `isTrustedRequestOrigin()` checks Origin + Referer headers
- **Cookies**: `__Host-` prefix with Secure flag
- **CSP**: area-aware (public / admin / auth / api) with appropriate strictness per area
- **Sessions**: HMAC-SHA-256 digested at rest, TTL-enforced, server-side revocable
- **Rate limiting**: per-key with configurable windows
- **HTML sanitization**: custom allowlist parser; force-adds `rel="noopener noreferrer"`
- **API tokens**: hashed at rest; raw token shown once on creation
- **Audit trail**: immutable `audit_events` table with `X-Request-Id` correlation
- **ZTA**: `withAdminFormAction` / `requireAdminFormAction` enforced on all admin actions
- **Privacy**: comment emails SHA-256 hashed; no IP storage; no default analytics; DNT/GPC honored
- **Scanning**: ZAP baseline, CodeQL, Semgrep, Gitleaks in CI

## Plugin / Extension API

`AstropressPlugin` interface covers:
- **Lifecycle hooks**: `onContentSave`, `onContentPublish`, `onMediaUpload`
- **UI extension**: `navItems` (sidebar entries)
- **Route injection**: `adminRoutes` (custom Astro pages in admin)

Plugins are registered via `registerCms({ plugins: [...] })`. Hook errors are caught and logged, never failing the admin action.

## Content Modeling

Custom fields defined in `registerCms({ contentTypes })` are automatically rendered in the post editor. Supported field types: `text`, `select`, `boolean`, `content-ref`, `repeater`. Conditional visibility via `conditionalOn`. Metadata persists end-to-end through both D1 and SQLite paths.

## Example and Docs

| Example | Purpose |
|---------|---------|
| `examples/github-pages/` | Static public site demonstrating the GitHub Pages deploy path |
| `examples/admin-harness/` | Seeded admin panel for Playwright accessibility and mobile testing |

Documentation in `docs/`:
- `QUICK_START.md`, `ARCHITECTURE.md`, `OPERATIONS.md`, `ANALYTICS.md`
- `WEB_COMPONENTS.md`, `MULTILINGUAL.md`, `COMPLIANCE.md`, `DESIGN_SYSTEM.md`
- `BROWSER_SUPPORT.md`, `COMPATIBILITY.md`, `API_REFERENCE.md`
- `UPSTREAM_CONTRIBUTIONS.md`, `EVALUATION.md`
- `adr/` — Architecture Decision Records (3 ADRs)

## Production Readiness Gaps

These are known gaps between the current state and a production v1.0 release.

### Blocking for v1.0

1. **Unpublished**: the npm package is v0.0.1 and has not been published to the registry
2. **Repository URL**: `package.json` points to `withastro/astropress` which does not exist as a public GitHub repo
3. **No automated cloud migration runner**: D1 and Supabase require manual `ALTER TABLE` — `astropress db migrate` only works for local SQLite
4. ~~**No `astropress db rollback`**~~: **implemented** — `db rollback` reads `rollback_sql` from the last `schema_migrations` row, executes it, and removes the record
5. **PocketBase adapter untested**: exists in source but has no dedicated test file or evaluation coverage
6. **Neon/Nhost adapters missing**: listed as data-service targets in the scaffold wizard but have no adapter implementations
7. **API reference from regex**: `docs/API_REFERENCE.md` is generated from regex parsing, not TypeScript's type system — no parameter types or return types

### Important but not blocking

8. **No admin UI import wizard**: WordPress and Wix import are CLI-only; a step-by-step admin flow would serve non-technical users
9. **No subscriber list management**: newsletter adapter exists but no admin UI for managing subscriber lists
10. **No full-text search**: no search capability across content records (neither admin nor public-facing)
11. **No ISR for static hosts**: static deploy paths require full rebuild on content change
12. **No load/stress testing**: no SQLite concurrent-write benchmarks
13. **Dual `.ts`/`.js` maintenance burden**: `audit:sync` catches divergence but two manually synced files per module is unusual friction
14. **Thin Playwright coverage**: 10 end-to-end tests cover accessibility and mobile but not admin CRUD workflows

## Packages

| Package | Path | Purpose |
|---------|------|---------|
| `astropress` | `packages/astropress/` | Core framework — admin panel, REST API, SQLite runtime |
| `astropress-mcp` | `packages/astropress-mcp/` | MCP server for AI agents |
| `astropress-nexus` | `packages/astropress-nexus/` | Multi-site gateway (Hono) |

## Missing Evaluation Rubrics

The current evaluation covers 34 rubrics. The following areas are not evaluated:

| Missing rubric | Why it matters |
|----------------|----------------|
| **E2E Hosted Provider Testing** | All adapter tests use mocks/stubs; no tests run against real D1, Supabase, or Appwrite services |
| **CLI UX Quality** | TUI quality (ratatui), help text, error messages, shell completion — untested |
| **Email Delivery** | Transactional email templates exist (`transactional-email.ts`) but no delivery integration tests |
| **Search / Discovery** | No full-text search evaluated; common requirement for content sites |
| **Admin CRUD E2E** | Playwright tests cover accessibility but not create/edit/delete content workflows |
| **Disaster Recovery Procedure** | Backup/restore commands exist but no tested DR runbook with RTO/RPO |
| **Monitoring Integration** | Health endpoint exists but no integration with Prometheus, Datadog, or alerting systems |
| **Upgrade Path E2E** | `astropress upgrade --check` exists but no test that migrates a v0 DB to a new schema version end-to-end |

## astropress-nexus

`astropress-nexus` is a **Hono-based gateway service** for operators who run multiple Astropress sites and want a single control plane over them. It lives at `packages/astropress-nexus/` in the monorepo.

### Architecture

```
                    ┌─────────────────────┐
 operator client ──►│  astropress-nexus   │  Hono, port 4330
                    │  (gateway / hub)    │
                    └─────────────────────┘
                         │         │
              ┌──────────┘         └──────────┐
              ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐
    │  site-a         │             │  site-b         │
    │  /ap-api/v1/*   │             │  /ap-api/v1/*   │
    └─────────────────┘             └─────────────────┘
```

- **Hub-and-spoke**: nexus does not proxy every request — it fans out in parallel (`Promise.allSettled`) for aggregate queries and proxies directly for site-specific operations.
- **Site registry**: a JSON config file (`nexus.config.json`) maps site IDs to base URLs and bearer tokens.
- **Gateway auth**: requests to nexus carry an org-level token; nexus exchanges it for per-site tokens automatically.
- **Partial failure**: if one site is unreachable, nexus returns a `degraded` status for that site rather than a 500.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check — lists registered sites + reachability status |
| GET | `/sites` | List all registered sites with live health status |
| GET | `/sites/{id}` | Single site metadata and health |
| GET | `/sites/{id}/content` | Proxy → site `/ap-api/v1/content` |
| GET | `/sites/{id}/content/{slug}` | Proxy → site `/ap-api/v1/content/{slug}` |
| GET | `/sites/{id}/media` | Proxy → site `/ap-api/v1/media` |
| GET | `/sites/{id}/settings` | Proxy → site `/ap-api/v1/settings` |
| GET | `/content` | Fan-out GET /content to all sites; merge results |
| GET | `/metrics` | Aggregate metrics across all sites (30 s TTL cache) |

### Auth model

- Requests to nexus use `Authorization: Bearer <org-token>`.
- The org token is validated against `NEXUS_AUTH_TOKEN` env var (single-tenant bootstrap) or a token list.
- Per-site tokens in `nexus.config.json` are never forwarded to the client.

### Site config format

```json
{
  "sites": [
    {
      "id": "site-a",
      "name": "Site A",
      "baseUrl": "https://site-a.example.com",
      "token": "sk_live_..."
    }
  ]
}
```

### Error handling

- Unreachable site → `{ "status": "degraded", "error": "timeout" }` in the site entry.
- Invalid site ID → `404 Not Found`.
- Missing or invalid org token → `401 Unauthorized`.
- All errors are JSON with `{ "error": string }` body.

## Repository Specs

Each package carries its own scoped spec:

- `packages/astropress/SPEC.md` — the published npm package
- `packages/astropress-nexus/SPEC.md` — the multi-site gateway
- `examples/github-pages/SPEC.md` — the static example/docs site
