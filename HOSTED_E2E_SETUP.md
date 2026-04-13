# Hosted Provider E2E Setup

This repo does not claim an `A+` for hosted-provider E2E yet because the live matrix still depends on maintainer-owned accounts, seeded projects, and provider-specific bootstrap/teardown automation that cannot be verified from a fresh clone.

This file is the setup contract for getting there.

## What "A+" requires

- One green live run per hosted adapter family
- Real credentials stored in GitHub Actions secrets
- Disposable provider projects or databases that can be recreated safely
- A seeded Astropress service endpoint for providers that require a separate runtime
- Teardown steps so nightly runs do not leak billable infrastructure

## GitHub secrets to create

### Cloudflare

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `HOSTED_E2E_CLOUDFLARE_PAGES_PROJECT`
- `HOSTED_E2E_CLOUDFLARE_SERVICE_ORIGIN`

### Supabase

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HOSTED_E2E_SUPABASE_SERVICE_ORIGIN`

### Appwrite

- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `HOSTED_E2E_APPWRITE_SERVICE_ORIGIN`

### PocketBase

- `POCKETBASE_URL`
- `POCKETBASE_EMAIL`
- `POCKETBASE_PASSWORD`
- `HOSTED_E2E_POCKETBASE_SERVICE_ORIGIN`

### Runway

- `RUNWAY_API_TOKEN`
- `RUNWAY_PROJECT_ID`
- `HOSTED_E2E_RUNWAY_SERVICE_ORIGIN`

### Nhost

- `NHOST_SUBDOMAIN`
- `NHOST_REGION`
- `NHOST_ADMIN_SECRET`
- `HOSTED_E2E_NHOST_SERVICE_ORIGIN`

### Neon

- `NEON_DATABASE_URL`
- `NEON_PROJECT_ID`
- `HOSTED_E2E_NEON_SERVICE_ORIGIN`

### Turso

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `HOSTED_E2E_TURSO_SERVICE_ORIGIN`

## Provider bootstrap requirements

### Full-stack providers

- Cloudflare, Supabase, Appwrite, PocketBase, Runway, and Nhost need a real Astropress API deployment that can service auth, content CRUD, media, revisions, and preview checks.
- Each provider project should contain a dedicated `astropress-ci` app or service rather than sharing production resources.
- Seed one admin user, one editor user, one post, and one media fixture before running assertions.

### Database-only providers

- Neon and Turso cannot satisfy the full hosted Astropress surface on their own.
- Pair them with a separate Astropress service runtime and expose that runtime via `HOSTED_E2E_*_SERVICE_ORIGIN`.
- Grade these lanes on config parsing, live connection/query smoke, and service-origin reachability unless and until the repo grows a canonical server-runtime harness for them.

## Naming convention

- Use `astropress-ci-<provider>` for provider projects, buckets, databases, and functions.
- Use `astropress-e2e-admin@example.com` and `astropress-e2e-editor@example.com` for seeded users.
- Keep media fixtures under a dedicated `e2e/` prefix so cleanup can delete by prefix instead of enumerating production assets.

## What the live tests should prove

- Full-stack lanes: sign-in, content list, content create/update/delete, revision list, media upload/delete, preview URL creation, and health endpoint reachability
- Neon and Turso lanes: database connectivity, minimal write/read round-trip, and the paired Astropress service health/content smoke
- Every lane: cleanup succeeds and leaves the environment reusable for the next nightly run

## What still needs to be built in-repo

- Provider-specific bootstrap and teardown scripts
- A secret-gated workflow that runs only when the corresponding secrets exist
- Live assertions that exercise real services instead of mocked adapters
- Failure-safe cleanup for billable resources

Until those pieces are merged and green in CI, rubric 35 should stay below `A+`.
