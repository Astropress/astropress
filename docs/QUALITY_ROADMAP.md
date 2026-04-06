# Astropress Quality Roadmap

## Current enforced gates

- Dependency audit via `bun run audit:deps`
- Source-level security audit via `bun run audit:security`
- Built-page accessibility audit via `bun run test:accessibility`
- Browser accessibility audit via `bun run test:accessibility:browser`
- Package-admin browser audit via `bun run test:accessibility:admin-harness`
- JS package suite via `bun run test`
- Rust CLI suite via `bun run test:cli`
- Example app diagnostics via `bun run test:example`
- Admin harness diagnostics via `bun run test:admin-harness`

## What is now enforced

- No inline event handlers in admin templates
- No `contenteditable` editor surfaces in admin
- No direct reviewed-post preview via `set:html={pageRecord.body}`
- Sandboxed iframe preview for edited HTML
- Dialogs require `aria-labelledby`
- Admin and auth entrypoints apply shared security headers
- Redirect responses from admin/auth flows include shared security headers
- Admin, reset-password, invite-acceptance, and login POST flows reject cross-origin requests
- Cloudflare adapter no longer enables insecure fallback auth by default

## Remaining blockers to an A+ grade

### Accessibility

- Add browser-level accessibility tests for authenticated admin flows, not just static built pages.
- Exercise keyboard-only and screen-reader behavior for the post editor, dialogs, and auth forms.
- Audit route pages, media flows, and validation error focus management in a running seeded harness.

### Security

- Replace in-memory Cloudflare session handling with durable, hashed-at-rest session storage.
- Add a first-party middleware or integration path that applies security headers across all package-owned routes automatically.
- Add dynamic scanning for authenticated flows, not just the public example.
- Add release-time secret rotation/bootstrap guidance and documented recovery procedures.

### Product hardening

- Build a real WordPress importer with media transfer, authors/comments mapping, idempotent re-runs, and operator-facing reports.
- Add upgrade/migration policy, backup/restore tooling, and rollback runbooks.
- Expand CI to validate any hosted/provider-specific runtime paths that are still only partially exercised in unit tests.

## Suggested next execution order

1. Add a seeded admin harness and browser-driven accessibility/security regression tests.
2. Move package-owned routes onto a canonical middleware/header application path.
3. Harden Cloudflare/session persistence and token storage.
4. Replace placeholder WordPress import behavior with a real import pipeline.
5. Add operator docs: backup, restore, upgrade, rollback, and incident handling.
