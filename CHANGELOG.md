# Changelog

## v0 Stability Policy

Astropress is pre-1.0. During this phase:

- The `AstropressProviderContract` TypeScript interface is the primary public API surface.
- All types, exports, and import paths are subject to breaking change.
- Breaking changes are documented here with migration guidance before each release.
- Consumers should pin to an exact version and review this file before upgrading.

Once the package reaches v1.0, it will follow semantic versioning strictly.

---

## [0.0.1] — Initial release

### Provider Contract

First published version of `AstropressProviderContract`. Covers:

- `auth` — `AuthStore` with session, CSRF, user management
- `content` — `ContentStore` with entries, overrides, revisions, taxonomy
- `media` — `MediaStore` with upload, list, delete
- `revisions` — `RevisionStore` for content history
- Optional capabilities: `gitSync`, `deploy`, `importer`, `preview`

### Adapters included

- `astropress/adapters/sqlite` — local SQLite runtime (Node.js / Bun)
- `astropress/adapters/cloudflare` — Cloudflare D1 + R2
- `astropress/adapters/supabase` — Supabase (PostgreSQL + Storage)
- `astropress/adapters/appwrite`, `pocketbase`, `neon`, `nhost`, `runway`

### Deploy targets

GitHub Pages, Cloudflare Pages, Vercel, Netlify, Render.

### Import

WordPress importer (staged artifacts; SQLite apply supported).

### Security

CSRF protection, origin validation, HTML sanitization, PBKDF2 session hashing, area-specific CSP headers, rate limiting, audit trail.
