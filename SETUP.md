# Astropress Setup and Remaining Deployment Prep

This file is the end-to-end setup guide for everything that can be prepared locally now, plus the exact account/secrets setup you will need later when you want real hosted deployment validation.

## 1. Local machine prerequisites

Install:

- `bun` `1.3.x`
- `node` `20+`
- `rust` stable toolchain with `cargo`
- `python3`
- `npx playwright install --with-deps chromium`

Optional but recommended:

- `gh` for GitHub workflow debugging
- `jq` for artifact inspection

## 2. Repository bootstrap

From `~/code/astropress`:

```bash
bun install
npx playwright install --with-deps chromium
source "$HOME/.cargo/env"
cargo test
bun run test
bun run test:coverage
bun run test:acceptance
bun run audit:deps
bun run audit:security
```

Expected local quality gates:

- executable BDD passes
- package Vitest suite passes
- package coverage gate passes
- browser accessibility acceptance passes
- Rust CLI tests pass

## 3. Local operator workflows

### Scaffold a site

```bash
cargo run --bin astropress-cli -- new demo-site --provider sqlite
cd demo-site
bun install
../target/debug/astropress-cli doctor --project-dir .
../target/debug/astropress-cli dev --project-dir .
```

### Backup and restore

```bash
../target/debug/astropress-cli backup --project-dir . --out .astropress/backups/manual-001
../target/debug/astropress-cli restore --project-dir . --from .astropress/backups/manual-001
```

### Stage a WordPress import

```bash
../target/debug/astropress-cli import wordpress \
  --project-dir . \
  --source ./wordpress-export.xml \
  --artifact-dir ./.astropress/import/run-001
```

### Download and resume WordPress media

```bash
../target/debug/astropress-cli import wordpress \
  --project-dir . \
  --source ./wordpress-export.xml \
  --artifact-dir ./.astropress/import/run-001 \
  --download-media

../target/debug/astropress-cli import wordpress \
  --project-dir . \
  --source ./wordpress-export.xml \
  --artifact-dir ./.astropress/import/run-001 \
  --download-media \
  --resume
```

WordPress staging output now includes:

- `wordpress.inventory.json`
- `wordpress.plan.json`
- `wordpress.report.json`
- `content-records.json`
- `media-manifest.json`
- `comment-records.json`
- `user-records.json`
- `taxonomy-records.json`
- `redirect-records.json`
- `remediation-candidates.json`
- `download-state.json`
- `downloads/`

## 4. What still needs real accounts later

These pieces are intentionally not wired to real provider accounts in this repo yet:

- Cloudflare staging deployment verification
- Supabase staging deployment verification
- Runway staging deployment verification
- authenticated OWASP-style dynamic scanning against a real hosted admin
- provider-native secret rotation drills
- provider-native backup/rollback drills

## 5. GitHub environments and secret names to create later

Create GitHub environments:

- `staging`
- `production`

Use protected environments with required reviewers for `production`.

Recommended secrets by concern:

### Shared app secrets

- `ASTROPRESS_SESSION_SECRET`
- `ASTROPRESS_ADMIN_PASSWORD`
- `ASTROPRESS_EDITOR_PASSWORD`
- `ASTROPRESS_TURNSTILE_SITE_KEY`
- `ASTROPRESS_TURNSTILE_SECRET_KEY`
- `ASTROPRESS_EMAIL_FROM`
- `ASTROPRESS_EMAIL_API_KEY`

### Cloudflare

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_R2_BUCKET`

### Supabase

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_REF`

### Runway

- `RUNWAY_API_TOKEN`
- `RUNWAY_PROJECT_ID`
- `RUNWAY_REGION`

## 6. What to do when accounts are ready

1. Create one low-privilege staging account/project per provider.
2. Store provider secrets only in GitHub environment secrets, not plain repo secrets for PR CI.
3. Add environment-gated deploy workflows:
   - staging auto or manual deploy
   - post-deploy smoke tests
   - authenticated ZAP/Playwright admin checks
4. Keep ordinary PR CI credential-free.
5. Only expose production deploy workflows behind manual approval.

## 7. Current remaining product work after all local implementation

- direct persisted import into provider-backed content stores instead of staged artifact review only
- provider-native hosted backup and rollback
- upgrade/migration runbooks with tested rollback
- real hosted smoke tests and authenticated dynamic security scanning
- final production release discipline around versioned upgrades and disclosure path

## 8. Further reading

- `docs/EVALUATION.md` — graded evaluation of the framework across 10 axes
- `docs/WEB_COMPONENTS.md` — authoring guide for the `astropress/web-components` package
