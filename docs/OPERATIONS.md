# Astropress Operations

This is the current operator runbook for local and small-organization Astropress deployments.

## Core checks

- `astropress doctor`
  - validates the package-owned env contract
  - resolves the runtime and deploy plan
  - warns about missing local secrets, weak session secrets, scaffold-style local passwords, bootstrap-password exposure, missing `.data/` paths, missing `ASTROPRESS_SERVICE_ORIGIN`, and projects still relying on legacy provider inference instead of explicit `ASTROPRESS_APP_HOST` and `ASTROPRESS_CONTENT_SERVICES`
- `bun run audit:security`
  - checks for inline handlers, missing hardening expectations, and risky local patterns
- `bun run test:acceptance`
  - runs the current Playwright + axe acceptance layer
- `astropress services bootstrap`
  - writes a local manifest under `.astropress/services/` for the selected content-services layer
- `astropress services verify`
  - confirms that the selected content-services layer has the required keys and a known service origin

## Backup and restore

- Create a content/config snapshot:
  - `astropress backup --project-dir <site> --out <snapshot-dir>`
- Restore a snapshot into a project:
  - `astropress restore --project-dir <site> --from <snapshot-dir>`

Current scope:

- snapshots are file-based exports using the packaged sync adapter
- this is suitable for source/config backup and recovery workflows
- database-native backup for hosted providers still needs provider-specific implementation

## Local bootstrap

- `astropress new <site>`
- choose an app host and content-services pair when the default static path is not enough:
  - `astropress new <site> --app-host vercel --content-services supabase`
  - `astropress new <site> --app-host cloudflare-pages --content-services cloudflare`
- `cd <site>`
- `bun install`
- `astropress doctor`
- `astropress services bootstrap`
- `astropress services verify`
- `astropress dev`

## WordPress staging

- `astropress import wordpress --project-dir <site> --source <export.xml>`
- Optional staging flags:
  - `--artifact-dir <dir>`
  - `--download-media`
  - `--apply-local`
  - `--resume`

Current scope:

- writes staged inventory, plan, report, content, media, comment, user, taxonomy, redirect, remediation, and download-state artifacts under `.astropress/import/` or a chosen artifact directory
- can download attachment assets into a resumable staged `downloads/` directory
- can apply the staged import into the supported local SQLite runtime and record a `wordpress.local-apply.json` report
- flags shortcode and page-builder cleanup work with explicit remediation candidates
- still stages into operator-reviewed artifacts rather than auto-writing directly into every provider runtime

## Secret handling

- generate a long random `SESSION_SECRET` before any real deployment
- rotate scaffolded `ADMIN_PASSWORD` and `EDITOR_PASSWORD` before handing the system to real editors
- set `ADMIN_BOOTSTRAP_DISABLED=1` once named admin accounts are established
- treat missing `TURNSTILE_SECRET_KEY` as a release blocker for hosted login surfaces

## Rollback procedure

1. Restore from the last backup: `astropress restore --project-dir <site> --from <snapshot-dir>`
2. Redeploy the previous release tag via your host's deployment UI or CLI.
3. For Cloudflare D1: use Wrangler's point-in-time restore — `wrangler d1 time-travel restore <database-name> --timestamp <iso-timestamp>`
4. After restore, run `astropress doctor` to confirm env and schema health before reopening traffic.

## Secret rotation

**SESSION_SECRET**

The session TTL is 12 hours. To rotate without a hard logout:
1. Add a `SESSION_SECRET_PREV` env var set to the current secret value.
2. Deploy the new `SESSION_SECRET`.
3. During the 12-hour window the runtime will accept tokens signed with either secret.
4. After the window, remove `SESSION_SECRET_PREV`.

**CLOUDFLARE_SESSION_SECRET**

Rotating this secret invalidates all existing Cloudflare D1 sessions immediately (the stored hashes become unverifiable). This is an acceptable tradeoff — users are logged out cleanly. If you want to minimise disruption, revoke all active sessions first:

```sql
UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL;
```

Then deploy the new `CLOUDFLARE_SESSION_SECRET`.

## Upgrade and migration policy

See [CHANGELOG.md](../CHANGELOG.md) for version-specific breaking changes before upgrading.

1. Always snapshot before upgrading: `astropress backup --project-dir <site> --out <snapshot-dir>`
2. Run `astropress doctor` after upgrading — it warns on env contract changes and schema drift.
3. SQLite local runtime: apply schema changes by running `astropress services bootstrap` again (idempotent).
4. Hosted providers (Cloudflare D1, Supabase): apply schema migrations via the provider CLI before deploying the new package version. Never deploy new code before the schema is ready.
5. If a migration fails: restore from the last clean backup (`astropress restore`), fix the migration in isolation, then redeploy.

### Framework-managed schema compatibility

Astropress performs automatic schema compatibility on every boot:

- **New databases** receive the full schema from `sqlite-schema.sql` (all tables, indexes, and constraints).
- **Existing databases** receive additive `ALTER TABLE ... ADD COLUMN` statements for any columns added in newer framework versions. These are idempotent — running bootstrap twice is safe.
- **Status constraint migrations** (e.g., adding `'review'` and `'archived'` statuses) are applied via a table rebuild with data migration when detected.
- Applied migrations are recorded in `schema_migrations` so they are never re-run.

This means **most framework upgrades require no manual migration steps** for SQLite-backed deployments. For hosted D1/Supabase deployments, check the `CHANGELOG.md` for any `ALTER TABLE` statements you must apply before deploying new code.

### User-managed migrations

The `runAstropressMigrations(db, migrationsDir)` function applies numbered `.sql` files from your own `migrations/` directory in lexicographic order:

```
migrations/
  0001_add_event_taxonomy.sql
  0002_add_event_date_index.sql
```

Run via CLI:
```sh
astropress db migrate --migrations-dir ./migrations
astropress db migrate --migrations-dir ./migrations --dry-run   # preview only
```

## Caching strategy

### Application-managed headers

`applyAstropressSecurityHeaders()` automatically sets `Cache-Control` based on the area:

| Area | `Cache-Control` value | Effect |
|------|-----------------------|--------|
| `public` | `public, max-age=300, s-maxage=3600` | 5-min browser cache, 1-hr CDN cache |
| `admin` | `private, no-store` | Never cached |
| `auth` | `private, no-store` | Never cached |
| `api` | `private, no-store` | Never cached |

### Cloudflare CDN recommendations

For sites deployed on Cloudflare Pages or Workers:

- Create a **Cache Rule** matching the public site origin (non-`/ap-admin/` paths) with **Cache Eligibility: Eligible for cache** and a 1-hour edge TTL.
- Create a **Cache Rule** matching `/ap-admin/*` with **Cache Eligibility: Bypass cache** — admin pages must never be served from edge cache.
- Static assets (`.js`, `.css`, `.woff2`, images) can use longer TTLs (e.g., 1 week) if filenames are content-hashed.

## Alerting and monitoring

### Request-level visibility

- **Cloudflare Analytics** (free tier) — available automatically for sites behind Cloudflare Pages or a Cloudflare-proxied domain. Shows request volume, error rates, cache hit ratio, and country-level traffic. No configuration needed.
- **UptimeRobot** (free tier) — set up a monitor on the admin login page (`/ap-admin/login`) to receive email/Slack alerts if the admin surface goes down. Recommended check interval: 5 minutes.

### Structured logs

When `LOG_LEVEL` is set, the runtime emits structured JSON log lines to stderr (one JSON object per line). Fields: `level`, `context`, `message`, `timestamp`, and `requestId` (threaded per request via `X-Request-Id`).

- **Cloudflare Workers**: logs appear in `wrangler tail --env production`
- **Vercel/Netlify**: logs appear in the platform's function log dashboard
- **Local / self-hosted**: logs go to stdout/stderr and can be piped to any log aggregator

Set `LOG_LEVEL=silent` in test environments to suppress all log output.

### Audit trail

The `ap_audit_log` table records all admin write actions (content save, user invite, media delete, etc.) with actor email, action name, resource type, resource ID, and a timestamp.

Query recent events:

```sql
SELECT actor, action, resource_type, resource_id, created_at
FROM ap_audit_log
ORDER BY created_at DESC
LIMIT 100;
```

Recommended retention strategy: run `astropress backup` on a weekly schedule to export the audit log alongside content. The `ap_audit_log` table has no built-in TTL — delete old rows explicitly if storage is a concern:

```sql
DELETE FROM ap_audit_log WHERE created_at < datetime('now', '-365 days');
```

### Nightly health checks

Use a scheduled GitHub Actions workflow to run `astropress doctor --json` against a staging environment and alert on non-zero exit:

```yaml
# .github/workflows/nightly-health.yml
on:
  schedule:
    - cron: "0 6 * * *"
jobs:
  health:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: astropress doctor --json
        env:
          ASTROPRESS_APP_HOST: ${{ vars.STAGING_APP_HOST }}
          ASTROPRESS_CONTENT_SERVICES: ${{ vars.STAGING_CONTENT_SERVICES }}
          SESSION_SECRET: ${{ secrets.STAGING_SESSION_SECRET }}
```

## Incident handling checklist

**Auth breach (leaked session or compromised admin account)**
1. Revoke all active sessions:
   ```sql
   UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL;
   ```
2. Rotate both `SESSION_SECRET` and `CLOUDFLARE_SESSION_SECRET` (see Secret rotation above).
3. Audit the `admin_sessions` and `audit_events` tables for suspicious activity.
4. Reset affected user passwords and deactivate any unknown accounts.

**Data loss**
1. Restore from the last clean backup.
2. Run `astropress doctor` and `astropress services verify` to confirm integrity.
3. Re-apply any content created since the snapshot using audit logs as a reference.

**Admin panel down**
1. Run `astropress doctor` to check env contract and service health.
2. Verify all required env vars (`SESSION_SECRET`, `ASTROPRESS_APP_HOST`, `ASTROPRESS_CONTENT_SERVICES`, etc.) are set correctly.
3. Check server logs for runtime errors or schema migration failures.
4. If the cause is a failed migration, restore from the last known-good snapshot and replay the migration in isolation before redeploying.
