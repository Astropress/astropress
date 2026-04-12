import type { D1DatabaseLike } from "./d1-database";

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

export function createD1LocksOps(db: D1DatabaseLike) {
  async function expireStale() {
    await db.prepare("DELETE FROM content_locks WHERE expires_at <= ?").bind(new Date().toISOString()).run();
  }

  return {
    async acquireLock(
      slug: string,
      email: string,
      name: string,
    ): Promise<ContentLockResult | ContentLockConflict> {
      await expireStale();
      const existing = await db
        .prepare("SELECT locked_by_email, locked_by_name, expires_at FROM content_locks WHERE slug = ? LIMIT 1")
        .bind(slug)
        .first<{ locked_by_email: string; locked_by_name: string; expires_at: string }>();

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
      await db
        .prepare(
          `INSERT INTO content_locks (slug, locked_by_email, locked_by_name, lock_token, expires_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(slug) DO UPDATE SET
             locked_by_email = excluded.locked_by_email,
             locked_by_name = excluded.locked_by_name,
             lock_token = excluded.lock_token,
             expires_at = excluded.expires_at`,
        )
        .bind(slug, email, name, lockToken, expiresAt)
        .run();
      return { ok: true, lockToken, expiresAt };
    },

    async refreshLock(slug: string, lockToken: string): Promise<boolean> {
      const expiresAt = lockExpiresAt();
      const result = await db
        .prepare("UPDATE content_locks SET expires_at = ? WHERE slug = ? AND lock_token = ?")
        .bind(expiresAt, slug, lockToken)
        .run();
      return (result.meta?.changes ?? 0) > 0;
    },

    async releaseLock(slug: string, lockToken: string): Promise<boolean> {
      const result = await db
        .prepare("DELETE FROM content_locks WHERE slug = ? AND lock_token = ?")
        .bind(slug, lockToken)
        .run();
      return (result.meta?.changes ?? 0) > 0;
    },
  };
}
