const LOCK_TTL_MINUTES = 5;

function lockExpiresAt() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + LOCK_TTL_MINUTES);
  return d.toISOString();
}

export function createSqliteLocksOps(getDb) {
  function expireStale() {
    getDb().prepare("DELETE FROM content_locks WHERE expires_at <= ?").run(new Date().toISOString());
  }

  return {
    acquireLock(slug, email, name) {
      expireStale();
      const existing = getDb()
        .prepare("SELECT locked_by_email, locked_by_name, expires_at FROM content_locks WHERE slug = ? LIMIT 1")
        .get(slug);

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

    refreshLock(slug, lockToken) {
      const expiresAt = lockExpiresAt();
      const result = getDb()
        .prepare("UPDATE content_locks SET expires_at = ? WHERE slug = ? AND lock_token = ?")
        .run(expiresAt, slug, lockToken);
      return result.changes > 0;
    },

    releaseLock(slug, lockToken) {
      getDb()
        .prepare("DELETE FROM content_locks WHERE slug = ? AND lock_token = ?")
        .run(slug, lockToken);
    },
  };
}
