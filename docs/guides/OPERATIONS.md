# Operations Runbook

Operator reference for local and small-organization Astropress deployments.

## Health checks

```bash
astropress doctor           # env contract, runtime plan, schema drift warnings
astropress doctor --json    # machine-readable output
astropress doctor --strict  # exit non-zero on any warning
astropress services verify  # confirm content-services keys + service origin
bun run audit:security      # inline-handler and hardening checks
```

`astropress doctor` warns on:
- missing or weak `SESSION_SECRET`
- scaffold-default `ADMIN_PASSWORD` still in use
- `ADMIN_BOOTSTRAP_DISABLED` not set
- missing `.data/` directory
- projects still using legacy `ASTROPRESS_*PROVIDER` vars

## Local bootstrap

```bash
astropress new my-site
astropress new my-site --app-host vercel --content-services supabase
astropress new my-site --app-host cloudflare-pages --content-services cloudflare
cd my-site
bun install
astropress doctor
astropress services bootstrap
astropress services verify
astropress dev
```

## Backup and restore

```bash
# Create a snapshot
astropress backup --project-dir <site> --out <snapshot-dir>

# Restore from a snapshot
astropress restore --project-dir <site> --from <snapshot-dir>
```

Snapshots are file-based exports. For hosted providers, supplement with
provider-native point-in-time restore (Cloudflare D1 time travel, Supabase
Point-in-Time Recovery).

## Importing content

Astropress imports are **staged** — the pipeline writes structured JSON artifacts
(content, media, comments, users, taxonomies, redirects) for review before
anything touches the database. Run without `--apply-local` first to inspect what
will change.

### How the pipeline works

1. **Parse** — reads the export file (WXR XML for WordPress, CSV for Wix) and
   extracts all records into typed in-memory structures
2. **Inventory** — counts records, detects shortcodes or page-builder markup that
   cannot be auto-migrated, and lists all media attachment URLs
3. **Stage** — writes JSON artifacts to `--artifact-dir` for review before any
   database write
4. **Download** (`--download-media`) — fetches each attachment URL into
   `artifacts/downloads/`; supports resume via `download-state.json`
5. **Apply** (`--apply-local`) — inserts staged records into the local SQLite
   runtime idempotently; safe to re-run

### WordPress

Export your content from the WordPress admin panel: **Tools → Export → All
content**, then:

```bash
# Stage only — safe, no database writes
astropress import wordpress --project-dir <site> --source export.xml

# Inspect what will be imported before touching anything
cat .astropress/import/wordpress.inventory.json

# Stage + download media assets
astropress import wordpress --project-dir <site> --source export.xml \
  --artifact-dir ./import-artifacts --download-media

# Apply staged artifacts to the local SQLite database
astropress import wordpress --project-dir <site> --source export.xml \
  --artifact-dir ./import-artifacts --apply-local

# Resume a partial import (re-runs download, skipping already-completed assets)
astropress import wordpress --project-dir <site> --source export.xml \
  --artifact-dir ./import-artifacts --download-media --resume
```

**Artifacts written to `--artifact-dir`:**

| File | Contents |
|------|----------|
| `wordpress.inventory.json` | Record counts, unsupported pattern flags, warnings |
| `wordpress.plan.json` | Options the import will use (review before applying) |
| `content-records.json` | Posts and pages mapped to Astropress content records |
| `media-manifest.json` | Attachment metadata and source URLs |
| `redirect-records.json` | WXR old-slug redirects mapped to Astropress redirect rules |
| `user-records.json` | Author records |
| `taxonomy-records.json` | Categories and tags |
| `remediation-candidates.json` | Records with shortcodes or builder markup requiring cleanup |
| `download-state.json` | Completed and failed media download state (used by `--resume`) |
| `import-report.json` | Final summary written after `--apply-local` completes |

**Shortcodes and page-builder markup** — if `wordpress.inventory.json` shows
`detectedShortcodes > 0` or `detectedBuilderMarkers > 0`, the import sets
`reviewRequired: true`. Review `remediation-candidates.json` and strip or replace
problematic markup before publishing.

### Programmatic import via REST API

For server-to-server workflows (CI pipelines, Nexus-orchestrated bulk imports),
use the REST endpoint directly:

```
POST /ap-api/v1/import/wordpress
Authorization: Bearer <token with import:write scope>
Content-Type: application/json

{ "exportFile": "/absolute/path/to/export.xml" }
```

The export file must be accessible on the **server's filesystem** — it is not
uploaded via the request body. Transfer the file via SFTP or rsync before
calling this endpoint.

Rate limit: 5 requests per minute per token. Returns an
`AstropressWordPressImportReport` on success (same structure as the CLI output).

**Create an `import:write` token:**

```bash
astropress api-tokens create --label "Import automation" --scopes import:write
```

Or in the admin panel: **Settings → API Tokens → New token → select
`import:write` scope**.

For bulk imports across multiple sites with Nexus panel connectors, see
[BULK_IMPORTS.md](./BULK_IMPORTS.md).

### Wix

Export from the Wix dashboard: **Settings → General → Export Site Data**, then:

```bash
astropress import wix --project-dir <site> --source wix-export.csv
```

Same flags as WordPress: `--artifact-dir`, `--download-media`, `--apply-local`,
`--resume`.

For programmatic Wix dashboard access, the Playwright-based credential fetcher
handles authenticated login — see the `import wix --fetch` flag.

### Crawling any site

For sites without an export format:

```bash
astropress import crawl --project-dir <site> --url https://example.com
```

The crawler walks links from the start URL, extracts page titles and body HTML,
and writes the results as importable content records. Useful for migrating from
static generators or hand-authored HTML sites.

## Content scheduling

Set a publish time in the post editor (`Scheduled Publish Time` field) to
queue a draft for future publication.

The SQLite runtime exposes `runScheduledPublishes()` which promotes all
due posts atomically:

```ts
import { runScheduledPublishes } from "astropress/sqlite-admin-runtime";

// Call this on a schedule — e.g., every 5 minutes
const published = runScheduledPublishes(db);
console.log(`Published ${published} scheduled posts`);
```

**Cloudflare Workers:** wire it in a `scheduled` handler in `worker.ts`:

```ts
export default {
  async scheduled(_event, env, _ctx) {
    const runtime = await createRuntime(env);
    await runtime.content.runScheduledPublishes();
  },
};
```

**GitHub Actions:** use a cron workflow to hit a secured API route that
calls `runScheduledPublishes()`.

The posts list shows a **Scheduled** filter tab. Posts stay `draft` until
`runScheduledPublishes` fires; cancelling clears the scheduled time.

## Secret handling

Before any real deployment:

1. Generate a strong `SESSION_SECRET`:
   `SESSION_SECRET=$(openssl rand -hex 32)`
2. Change `ADMIN_PASSWORD` and `EDITOR_PASSWORD` from scaffold defaults
3. Set `ADMIN_BOOTSTRAP_DISABLED=1` once named admin accounts exist
4. Set `TURNSTILE_SECRET_KEY` before exposing the login form publicly

## Secret rotation

**SESSION_SECRET** — 12-hour window rotation (no hard logout):

1. Set `SESSION_SECRET_PREV` to the current secret value
2. Deploy the new `SESSION_SECRET`
3. After 12 hours, remove `SESSION_SECRET_PREV`

**CLOUDFLARE_SESSION_SECRET** — invalidates all D1 sessions immediately.
To minimize disruption, revoke sessions first:

```sql
UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP
WHERE revoked_at IS NULL;
```

Then deploy the new secret.

## Schema migrations

### Framework-managed (SQLite)

Most upgrades require no manual steps for SQLite deployments. On every boot,
Astropress applies any new `ALTER TABLE ... ADD COLUMN` statements idempotently.
Applied migrations are recorded in `schema_migrations`.

### User-managed migrations

Place numbered `.sql` files in your `migrations/` directory:

```
migrations/
  0001_add_event_taxonomy.sql
  0002_add_event_date_index.sql
```

```bash
astropress db migrate --migrations-dir ./migrations
astropress db migrate --migrations-dir ./migrations --dry-run  # preview only
```

Companion `.down.sql` files are read and stored in `schema_migrations.rollback_sql`
for safe rollback. To apply the most recent migration's rollback SQL:

```bash
astropress db rollback                     # apply rollback_sql from the last migration
astropress db rollback --dry-run           # preview what would be rolled back
```

`db rollback` reads the `rollback_sql` from the last row in `schema_migrations`, executes it
against the local SQLite database, and removes the migration record. Returns an error if no
`rollback_sql` is stored (the companion `.down.sql` was not present when the migration ran).

### Cloudflare D1 migrations

`astropress db migrate --target=d1` applies pending migration files to your D1
database via `wrangler d1 execute`. Requirements:

- `wrangler` on PATH: `bun add -g wrangler` or `npm install -g wrangler`
- Authenticated: `wrangler login` or `CLOUDFLARE_API_TOKEN` env var
- `CLOUDFLARE_D1_BINDING` env var set to your D1 binding name (default: `DB`)

```sh
# Preview which files would run (no writes):
astropress db migrate --target=d1 --dry-run

# Apply to the remote D1 database:
astropress db migrate --target=d1

# D1 rollback: apply the .down.sql file manually via wrangler
wrangler d1 execute $CLOUDFLARE_D1_BINDING --remote \
  --file migrations/0001_your_migration.down.sql
```

Each `.sql` file in your `migrations/` directory is passed to `wrangler d1 execute`
in lexicographic order. The `.down.sql` rollback SQL is stored in the
`schema_migrations` table (same as SQLite) for reference.

### Supabase migrations

Supabase projects use the [Supabase CLI](https://supabase.com/docs/reference/cli) for
schema migrations. Astropress migration `.sql` files are compatible — place them in
`supabase/migrations/` and use the Supabase CLI workflow:

```sh
# Link to your project (once):
supabase link --project-ref <ref>

# Push pending migrations to the remote database:
supabase db push

# Rollback: apply the .down.sql file via psql or the Supabase Dashboard SQL editor
```

For programmatic use from TypeScript (e.g. in a CI script), import
`runD1Migrations` from `astropress/d1-migrate-ops` for D1, or use a plain
Postgres client with the same SQL files for Supabase.

### Version upgrade procedure

1. Snapshot: `astropress backup --project-dir <site> --out <snapshot-dir>`
2. Upgrade the package: `bun add astropress@latest`
3. Run `astropress doctor` — flags env contract changes and schema drift
4. For SQLite: run `astropress db migrate` (defaults to `--target=local`)
5. For D1: run `astropress db migrate --target=d1`
6. For Supabase: run `supabase db push`
7. Deploy. If migration fails, restore from snapshot and replay in isolation.

## Caching

`applyAstropressSecurityHeaders()` sets `Cache-Control` by area:

| Area | Value | Effect |
|------|-------|--------|
| `public` | `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400` | 5 min browser / 1 hr CDN |
| `admin` | `private, no-store` | Never cached |
| `auth` | `private, no-store` | Never cached |
| `api` | `private, no-store` | Never cached |

**CDN purge on publish:** Astropress fires `purgeCdnCache(slug, config)` on
every content publish — supports Cloudflare Cache API and generic webhook URLs:

```ts
registerCms({
  cdnPurgeWebhook: "https://api.netlify.com/build_hooks/your-hook-id",
});
```

## Static host publishing

### Full rebuild

The default publish path rebuilds all pages on every content change:

```bash
astropress build                    # full Astro build → dist/
astropress publish                  # build + push to configured static host
```

### Incremental rebuild (ISR-style)

For sites with large page counts, a full rebuild on every change is wasteful.
Astropress supports an incremental mode that regenerates only the pages affected
by a given set of slug changes.

**CLI usage:**

```bash
# Rebuild only the affected slug(s) — faster than a full rebuild
astropress publish --incremental --slugs /blog/my-post,/blog/another-post

# Or pass slugs via stdin (one per line)
echo -e "/blog/my-post\n/blog/another-post" | astropress publish --incremental --stdin
```

**How it works:**

1. For each changed slug, Astropress resolves which Astro routes generate that
   URL via `getStaticPaths`.
2. Only those route files are rebuilt; other `dist/` entries are left untouched.
3. The CDN purge webhook (`cdnPurgeWebhook` in `registerCms`) fires for each
   regenerated slug so stale CDN entries are invalidated immediately.

**GitHub Actions example (incremental on content push):**

```yaml
name: Incremental publish
on:
  repository_dispatch:
    types: [content-changed]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: astropress publish --incremental --slugs "${{ github.event.client_payload.slugs }}"
        env:
          ASTROPRESS_DEPLOY_TOKEN: ${{ secrets.ASTROPRESS_DEPLOY_TOKEN }}
```

Trigger this workflow from the `cdnPurgeWebhook` callback or any CI/CD hook
that knows which slugs changed:

```ts
registerCms({
  cdnPurgeWebhook: "https://api.github.com/repos/owner/repo/dispatches",
  // The webhook receiver should POST the changed slug list back to GitHub
  // as a repository_dispatch event with type "content-changed".
});
```

**GitHub Pages:**

GitHub Pages does not natively support partial deploys — every push to the
`gh-pages` branch replaces the entire `dist/`. The incremental approach still
saves build time (fewer pages to compile), but the full `dist/` directory must
be pushed on every publish. Use `astropress publish --incremental` to limit
which pages are recompiled, then let the GitHub Pages action push the full tree.

**Trade-offs:**

| Mode | Build time | Stale risk | Best for |
|------|-----------|------------|----------|
| Full rebuild | Proportional to site size | None | Small sites, release deploys |
| Incremental (`--incremental`) | Proportional to changed pages | Low (CDN purge fires) | Large sites, frequent edits |

For sites with fewer than ~500 pages, full rebuild is simpler and fast enough.
Switch to incremental when build time becomes a bottleneck.

## Observability

### Structured logs

Set `LOG_LEVEL` to emit structured JSON lines to stderr. Fields: `level`,
`context`, `message`, `timestamp`, `requestId`.

- Cloudflare: `wrangler tail --env production`
- Vercel/Netlify: platform function log dashboard
- Local: pipe stderr to any log aggregator

Set `LOG_LEVEL=silent` in test environments.

### Metrics endpoint

```
GET /ap-api/v1/metrics   Bearer token required (content:read scope)
```

Returns `{ posts, pages, media, comments, uptime }`.

### Prometheus metrics

Enable the unauthenticated Prometheus text format endpoint:

```ts
registerCms({
  monitoring: { prometheusEnabled: true },
  // ...
});
```

```
GET /ap/metrics   No authentication required
Content-Type: text/plain; version=0.0.4
```

Exported metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `ap_content_total{kind="post"}` | gauge | Published post count |
| `ap_content_total{kind="page"}` | gauge | Published page count |
| `ap_media_total` | gauge | Total media assets |
| `ap_uptime_seconds` | gauge | Process uptime in seconds |

**Grafana scrape config:**
```yaml
scrape_configs:
  - job_name: astropress
    static_configs:
      - targets: ["your-site.com"]
    metrics_path: /ap/metrics
    scheme: https
```

**Uptime monitoring:** Point Uptime Robot or BetterUptime at `GET /ap/health` (HTTP 200 = ok). Use `GET /ap/metrics` for Prometheus scraping.

**Alerting example (Grafana alert rule):**
```
ap_content_total{kind="post"} == 0 → alert "No posts found — possible data loss"
ap_uptime_seconds < 60 → alert "Service restarted recently"
```

### Nightly health check (GitHub Actions)

```yaml
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
          SESSION_SECRET: ${{ secrets.STAGING_SESSION_SECRET }}
```

### Audit trail

```sql
SELECT actor, action, resource_type, resource_id, created_at
FROM ap_audit_log
ORDER BY created_at DESC
LIMIT 100;
```

Prune old rows if storage is a concern:

```sql
DELETE FROM ap_audit_log
WHERE created_at < datetime('now', '-365 days');
```

## Incident handling

**Auth breach**
1. Revoke all sessions:
   ```sql
   UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP
   WHERE revoked_at IS NULL;
   ```
2. Rotate `SESSION_SECRET` and `CLOUDFLARE_SESSION_SECRET`
3. Audit `admin_sessions` and `audit_events` for suspicious activity
4. Reset affected passwords, deactivate unknown accounts

**Data loss**
1. Restore from the last clean backup
2. Run `astropress doctor` and `astropress services verify`
3. Re-apply content created since the snapshot using audit logs as reference

**Admin panel down**
1. Run `astropress doctor` — check env and service health
2. Verify required env vars are set
3. Check server logs for runtime errors or migration failures
4. If a failed migration caused it: restore from snapshot, replay migration
   in isolation, then redeploy

## Provider configuration

### Appwrite

```
ASTROPRESS_CONTENT_SERVICES=appwrite
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key

# Optional — used when routing directly to Appwrite collections/buckets
APPWRITE_DATABASE_ID=your-database-id
APPWRITE_BUCKET_ID=your-bucket-id
```

Use `createAstropressAppwriteHostedAdapter()` from `astropress/adapters/appwrite`.
The adapter resolves the Appwrite Console URL automatically from `APPWRITE_PROJECT_ID`
and exposes it as `capabilities.hostPanel` for admin-role navigation.

## Disaster recovery

### RTO / RPO targets

| Tier | Data store | RPO | RTO |
|------|------------|-----|-----|
| Local / GitHub Pages + SQLite | SQLite file | Last `astropress backup` snapshot | < 5 min |
| Cloudflare Pages + D1 | Cloudflare D1 | D1 time-travel (30 days) | < 15 min |
| Supabase | PostgreSQL | Point-in-time recovery (up to 7 days on Pro) | < 30 min |
| Runway | Managed SQLite | Provider snapshot schedule | < 30 min |

### Failure runbooks

**Corrupted SQLite database**

Detect: `astropress doctor` or `sqlite3 .data/admin.db "PRAGMA integrity_check;"`. Take the site offline to prevent further writes, then:
```sh
astropress restore --project-dir <site> --from <snapshot-dir>
astropress doctor --project-dir <site>
```

**Accidental content deletion**

Detect via audit log:
```sh
sqlite3 .data/admin.db \
  "SELECT * FROM audit_events WHERE action LIKE 'content.delete%' ORDER BY created_at DESC LIMIT 10;"
```
For SQLite: restore from snapshot then re-apply changes made after the snapshot.
For D1: `wrangler d1 time-travel restore <DATABASE_NAME> --timestamp <ISO_TIMESTAMP>`.
For Supabase: Dashboard → Database → Backups → Point in Time Recovery.

**Failed schema migration**

Detect: `astropress doctor` or `sqlite3 .data/admin.db "SELECT * FROM schema_migrations ORDER BY id DESC LIMIT 5;"`. Roll back:
```sh
astropress db rollback --project-dir <site> --dry-run  # preview first
astropress db rollback --project-dir <site>
```
If rollback SQL is unavailable, restore from the pre-migration snapshot.

**Provider outage (D1 / Supabase)**

No action required while the provider restores service. For prolonged outages, switch to a local SQLite fallback with the last snapshot. `GET /ap/health` returns `degraded` during the outage; resume when it returns `{ status: "ok" }`.

### Backup procedure

```sh
astropress backup --project-dir <site> --out backups/$(date +%Y%m%d-%H%M%S)

# Cloudflare D1:
wrangler d1 export <DATABASE_NAME> --output backup-$(date +%Y%m%d).sql --remote
```

Schedule via cron or CI. Store snapshots separately from the site directory.

### Post-restore checklist

- [ ] `astropress doctor --project-dir <site>` — all checks pass
- [ ] `astropress services verify` — database connectivity confirmed
- [ ] `sqlite3 .data/admin.db "PRAGMA integrity_check;"` returns `ok`
- [ ] `SELECT COUNT(*) FROM content_overrides` returns non-zero
- [ ] `SELECT * FROM schema_migrations ORDER BY id DESC LIMIT 3` shows expected state
- [ ] Admin panel login succeeds
- [ ] `GET /ap/health` returns `{ "status": "ok" }`

When restoring an older snapshot onto a newer Astropress install, `ensureLegacySchemaCompatibility()` runs at boot and applies any missing additive column migrations automatically. For destructive migrations (table rebuilds) review [COMPATIBILITY.md](../COMPATIBILITY.md) before restarting.
