# Disaster Recovery

## RTO / RPO Targets by Deployment Tier

| Tier | Data Store | RPO (data loss window) | RTO (recovery time) |
|------|------------|------------------------|---------------------|
| Local development | SQLite file | Last `astropress backup` snapshot | < 5 min |
| GitHub Pages + SQLite | SQLite file | Last `astropress backup` snapshot | < 5 min |
| Cloudflare Pages + D1 | Cloudflare D1 | D1 time-travel window (30 days) | < 15 min |
| Supabase | PostgreSQL | Point-in-time recovery window (up to 7 days on Pro) | < 30 min |
| Runway | Managed SQLite | Provider snapshot schedule | < 30 min |

Run `astropress backup --project-dir <site> --out <snapshot-dir>` regularly to reduce RPO for SQLite deployments. For cloud providers, supplement with native provider backup tooling.

---

## Failure Mode Runbooks

### 1. Corrupted SQLite Database File

**Symptoms:** `astropress doctor` reports a database error; admin panel returns 500 errors; `PRAGMA integrity_check` fails.

**Detect:**
```sh
astropress doctor --project-dir <site>
# Or directly:
sqlite3 .data/admin.db "PRAGMA integrity_check;"
```

**Isolate:** Take the site offline or return a maintenance page to prevent further writes.

**Restore:**
```sh
# Restore from most recent snapshot
astropress restore --project-dir <site> --from <snapshot-dir>
# Or use astropress sync import (alias)
astropress sync import --project-dir <site> --from <snapshot-dir>
```

**Verify:**
```sh
astropress doctor --project-dir <site>
sqlite3 .data/admin.db "PRAGMA integrity_check;"
sqlite3 .data/admin.db "SELECT COUNT(*) FROM content_overrides;"
```

---

### 2. Accidental Content Deletion

**Symptoms:** Content missing from admin panel; confirmed `DELETE` in audit log.

**Detect:**
```sh
# Query audit log for recent deletions
sqlite3 .data/admin.db \
  "SELECT * FROM audit_events WHERE action LIKE 'content.delete%' ORDER BY created_at DESC LIMIT 10;"
```

**Isolate:** Disable admin access temporarily if bulk deletion occurred.

**Restore:**
- For **SQLite**: restore from snapshot (`astropress restore`), then re-apply any changes that happened after the snapshot was taken.
- For **D1**: use `wrangler d1 time-travel restore <DATABASE_NAME> --timestamp <ISO_TIMESTAMP>` to roll back to a point before the deletion.
- For **Supabase**: use Supabase Dashboard → Database → Backups → Point in Time Recovery.

**Verify:** Confirm deleted records are present. Check audit log for restore event.

---

### 3. Failed Schema Migration

**Symptoms:** Admin panel crashes on boot; `schema_migrations` shows a partial migration; columns may be missing.

**Detect:**
```sh
astropress doctor --project-dir <site>
sqlite3 .data/admin.db "SELECT * FROM schema_migrations ORDER BY id DESC LIMIT 5;"
```

**Isolate:** Roll back to the previous schema version:
```sh
astropress db rollback --project-dir <site>
# Or dry-run first:
astropress db rollback --project-dir <site> --dry-run
```

**Restore:** If rollback SQL is not available, restore from the pre-migration snapshot.

**Verify:**
```sh
astropress doctor --project-dir <site>
sqlite3 .data/admin.db "PRAGMA table_info(content_overrides);"
```

---

### 4. Provider Outage (Cloudflare D1 / Supabase)

**Symptoms:** Admin panel returns 503; `GET /ap/health` returns `degraded`.

**Detect:** Check provider status pages. Monitor `/ap/health` with an uptime service.

**Isolate:** No data loss during a read-only outage. Writes may fail gracefully if error handling is in place.

**Restore:** No action required; provider restores service. For prolonged outages, consider switching to a local SQLite fallback instance with the last known snapshot.

**Verify:** `GET /ap/health` returns `{ status: "ok" }`. Resume normal operations.

---

## Backup Procedure

```sh
# Export snapshot to a versioned directory
astropress backup --project-dir <site> --out backups/$(date +%Y%m%d-%H%M%S)

# For Cloudflare D1: export via wrangler
wrangler d1 export <DATABASE_NAME> --output backup-$(date +%Y%m%d).sql --remote
```

Schedule regular backups via cron or CI. Store snapshots in a separate location from the site (e.g., a different S3 bucket or repository).

---

## Post-Restore Verification Checklist

After any restore operation, run through this checklist before bringing the site back online:

- [ ] `astropress doctor --project-dir <site>` reports all checks passing
- [ ] `astropress services verify` confirms database connectivity
- [ ] `sqlite3 .data/admin.db "PRAGMA integrity_check;"` returns `ok`
- [ ] `sqlite3 .data/admin.db "SELECT COUNT(*) FROM content_overrides;"` returns a non-zero count
- [ ] `SELECT * FROM schema_migrations ORDER BY id DESC LIMIT 3` shows the expected migration state
- [ ] Admin panel login succeeds
- [ ] `GET /ap/health` returns `{ "status": "ok" }`
- [ ] At least one content record is visible in the admin posts list

---

## Schema Compatibility After Restore

When restoring a snapshot from an older version onto a newer Astropress installation, `ensureLegacySchemaCompatibility()` runs automatically at boot and applies any missing additive column migrations. No manual SQL intervention is needed for additive schema changes.

For destructive migrations (table rebuilds), review `docs/COMPATIBILITY.md` and the `schema_migrations` table before restarting the server.
