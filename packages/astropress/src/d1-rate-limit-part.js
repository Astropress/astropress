export function createD1RateLimitPart(db) {
  return {
    async checkRateLimit(key, max, windowMs) {
      const now = Date.now();
      const row = await db
        .prepare("SELECT count, window_start_ms, window_ms FROM rate_limits WHERE key = ? LIMIT 1")
        .bind(key)
        .first();

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
    async peekRateLimit(key, max, windowMs) {
      const now = Date.now();
      const row = await db
        .prepare("SELECT count, window_start_ms FROM rate_limits WHERE key = ? LIMIT 1")
        .bind(key)
        .first();
      if (!row || now - row.window_start_ms > windowMs) return true;
      return row.count < max;
    },
    async recordFailedAttempt(key, max, windowMs) {
      const now = Date.now();
      const row = await db
        .prepare("SELECT count, window_start_ms FROM rate_limits WHERE key = ? LIMIT 1")
        .bind(key)
        .first();
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
