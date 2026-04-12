# Astropress Compatibility Guide

## Version Compatibility Matrix

| Framework version | Minimum schema baseline | Breaking changes | Upgrade command |
|-------------------|------------------------|------------------|-----------------|
| 0.0.x (pre-release) | none required | Schema is additive-only; includes `content_locks` and `srcset` column on `media_assets` | `astropress db migrate` |

`ensureLegacySchemaCompatibility()` handles all additive schema changes automatically at
startup for existing local databases. The `astropress db migrate` command applies any
pending schema migrations for Cloudflare D1 or other hosted backends.

---

## Checking Compatibility

Run the built-in compatibility check before and after upgrading:

```sh
astropress upgrade --check [--project-dir <dir>]
```

This command:
1. Reads the installed `astropress` package version from `package.json`
2. Queries the `schema_migrations` table for the latest applied migration (local SQLite only)
3. Prints framework version, schema state, app host, and data services
4. Lists any known breaking-change notes for the current version range
5. Exits `0` on success

---

## Standard Upgrade Procedure

```sh
# 1. Check current state
astropress upgrade --check

# 2. Update the package
npm update astropress
# or: bun update astropress

# 3. Apply any pending schema migrations
astropress db migrate

# 4. Verify the environment
astropress doctor

# 5. Confirm schema is current
astropress upgrade --check
```

---

## Schema Version Reference

The `schema_migrations` table tracks every applied migration by name. Query it directly
with `sqlite3` or via the admin database file at `.data/admin.db`:

```sql
SELECT id, name, applied_at FROM schema_migrations ORDER BY id;
```

For Cloudflare D1, use the Wrangler CLI:

```sh
wrangler d1 execute <DB_NAME> --command \
  "SELECT id, name, applied_at FROM schema_migrations ORDER BY id"
```

---

## Rollback Procedure

Each migration row stores its rollback SQL in the `rollback_sql` column. To revert a
migration manually:

```sql
-- List available rollback SQL for the most recent migration
SELECT name, rollback_sql FROM schema_migrations ORDER BY id DESC LIMIT 1;

-- Execute the rollback SQL, then delete the migration row
DELETE FROM schema_migrations WHERE name = '<migration-name>';
```

After rollback, pin the previous framework version in `package.json` until the breaking
change is resolved.

---

## Environment Variable Changes

| Removed variable | Replacement | Since |
|------------------|-------------|-------|
| `ASTROPRESS_DATA_SERVICES` | `ASTROPRESS_CONTENT_SERVICES` | 0.0.x |
| `ASTROPRESS_BACKEND_PLATFORM` | `ASTROPRESS_CONTENT_SERVICES` | 0.0.x |
| `ASTROPRESS_HOSTED_PROVIDER` | `ASTROPRESS_CONTENT_SERVICES` | 0.0.x |
| `ASTROPRESS_DEPLOY_TARGET` | `ASTROPRESS_APP_HOST` | 0.0.x |

Run `astropress config migrate` to automatically rewrite legacy environment variable names
in your `.env` file.

See also: [OPERATIONS.md](../guides/OPERATIONS.md) for the full upgrade and migration policy.

---

## Cloud Provider Migration Procedures

### Cloudflare D1

1. **Snapshot first**: `astropress backup --project-dir <site> --out backups/pre-migration`
2. **Apply migration**:
   ```sh
   wrangler d1 execute <DATABASE_NAME> --file migrations/0001_my_migration.sql --remote
   ```
3. **Verify**:
   ```sh
   wrangler d1 execute <DATABASE_NAME> --command "SELECT * FROM schema_migrations ORDER BY id DESC LIMIT 5" --remote
   ```
4. **Deploy new code**: push to Cloudflare Pages; the new runtime picks up the schema automatically.

Note: `ensureLegacySchemaCompatibility` handles additive column additions automatically at boot.
Destructive migrations (table rebuilds, column renames) must be applied manually.

### Supabase (PostgreSQL)

1. **Snapshot first**: use Supabase Dashboard → Database → Backups → Download backup.
2. **Apply migration**: use the Supabase SQL Editor or `supabase db push` with a migration file.
3. **Verify**: confirm new columns via Supabase Dashboard → Table Editor.
4. **Deploy**: redeploy the host application.

### Upgrading with `astropress upgrade --apply`

For SQLite deployments, run the full upgrade sequence in one step:

```sh
astropress upgrade --apply --project-dir <site>
```

This command:
1. Runs the pre-flight compatibility check (`astropress upgrade`).
2. Applies pending `.sql` migration files from the `migrations/` directory.
3. Exits with a non-zero status if any migration fails.

Run `astropress doctor --project-dir <site>` after upgrading to verify schema health.
