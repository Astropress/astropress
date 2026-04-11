import type { AstropressSqliteDatabaseLike } from "./utils";

export interface ContentLockResult {
  ok: true;
  lockToken: string;
  expiresAt: string;
}

export interface ContentLockConflict {
  ok: false;
  conflict: true;
  lockedByEmail: string;
  lockedByName: string;
  expiresAt: string;
}

const LOCK_TTL_MINUTES = 5;

function lockExpiresAt(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + LOCK_TTL_MINUTES);
  return d.toISOString();
}

export function createSqliteLocksOps(getDb: () => AstropressSqliteDatabaseLike) {
  function expireStale() {
    getDb()
      .prepare("DELETE FROM content_locks WHERE expires_at <= ?")
      .run(new Date().toISOString());
  }

  return {
    acquireLock(
      slug: string,
      email: string,
      name: string,
    ): ContentLockResult | ContentLockConflict {
      expireStale();
      const existing = getDb()
        .prepare(
          "SELECT locked_by_email, locked_by_name, expires_at FROM content_locks WHERE slug = ? LIMIT 1",
        )
        .get(slug) as
        | { locked_by_email: string; locked_by_name: string; expires_at: string }
        | undefined;

      if (existing && existing.locked_by_email !== email) {
        return {
          ok: false,
          conflict: true,
          lockedByEmail: existing.locked_by_email,
          lockedByName: existing.locked_by_name,
          expiresAt: existing.expires_at,
        };
      }

      const lockToken = crypto.randomUUID();
      const expiresAt = lockExpiresAt();
      getDb()
        .prepare(
          `INSERT INTO content_locks (slug, locked_by_email, locked_by_name, lock_token, expires_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(slug) DO UPDATE SET
             locked_by_email = excluded.locked_by_email,
             locked_by_name = excluded.locked_by_name,
             lock_token = excluded.lock_token,
             expires_at = excluded.expires_at`,
        )
        .run(slug, email, name, lockToken, expiresAt);
      return { ok: true, lockToken, expiresAt };
    },

    refreshLock(slug: string, lockToken: string): boolean {
      const expiresAt = lockExpiresAt();
      const result = getDb()
        .prepare(
          "UPDATE content_locks SET expires_at = ? WHERE slug = ? AND lock_token = ?",
        )
        .run(expiresAt, slug, lockToken);
      return (result.changes as number) > 0;
    },

    releaseLock(slug: string, lockToken: string): void {
      getDb()
        .prepare("DELETE FROM content_locks WHERE slug = ? AND lock_token = ?")
        .run(slug, lockToken);
    },
  };
}
