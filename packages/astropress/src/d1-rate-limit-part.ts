import type { D1DatabaseLike } from "./d1-database";
import type { D1AdminReadStore } from "./d1-admin-store";

/** Rate-limit logic shared between read (check/peek) and mutation (recordFailedAttempt) stores. */
export function createD1RateLimitPart(db: D1DatabaseLike): D1AdminReadStore["rateLimits"] {
  return {
    async checkRateLimit(key: string, max: number, windowMs: number) {
      const now = Date.now();
      const row = await db
        .prepare("SELECT count, window_start_ms, window_ms FROM rate_limits WHERE key = ? LIMIT 1")
        .bind(key)
        .first<{ count: number; window_start_ms: number; window_ms: number }>();

      if (!row || now - row.window_start_ms > windowMs) {
        await db
          .prepare(
            `
              INSERT INTO rate_limits (key, count, window_start_ms, window_ms)
              VALUES (?, 1, ?, ?)
              ON CONFLICT(key) DO UPDATE SET
                count = 1,
                window_start_ms = excluded.window_start_ms,
                window_ms = excluded.window_ms
            `,
          )
          .bind(key, now, windowMs)
          .run();
        return true;
      }

      if (row.count < max) {
        await db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
        return true;
      }

      return false;
    },
    async peekRateLimit(key: string, max: number, windowMs: number) {
      const now = Date.now();
      const row = await db
        .prepare("SELECT count, window_start_ms FROM rate_limits WHERE key = ? LIMIT 1")
        .bind(key)
        .first<{ count: number; window_start_ms: number }>();
      if (!row || now - row.window_start_ms > windowMs) return true;
      return row.count < max;
    },
    async recordFailedAttempt(key: string, max: number, windowMs: number) {
      const now = Date.now();
      const row = await db
        .prepare("SELECT count, window_start_ms FROM rate_limits WHERE key = ? LIMIT 1")
        .bind(key)
        .first<{ count: number; window_start_ms: number }>();
      if (!row || now - row.window_start_ms > windowMs) {
        await db
          .prepare(
            `
              INSERT INTO rate_limits (key, count, window_start_ms, window_ms)
              VALUES (?, 1, ?, ?)
              ON CONFLICT(key) DO UPDATE SET
                count = 1,
                window_start_ms = excluded.window_start_ms,
                window_ms = excluded.window_ms
            `,
          )
          .bind(key, now, windowMs)
          .run();
        return;
      }
      await db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
    },
  };
}
