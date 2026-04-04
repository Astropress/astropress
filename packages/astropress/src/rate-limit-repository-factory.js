export function createAstropressRateLimitRepository(input) {
  return {
    checkRateLimit(key, max, windowMs) {
      const now = input.now();
      const row = input.readRateLimitWindow(key);

      if (!row || now - row.windowStartMs > windowMs) {
        input.resetRateLimitWindow(key, now, windowMs);
        return true;
      }

      if (row.count < max) {
        input.incrementRateLimitWindow(key);
        return true;
      }

      return false;
    },
    peekRateLimit(key, max, windowMs) {
      const now = input.now();
      const row = input.readRateLimitWindow(key);

      if (!row || now - row.windowStartMs > windowMs) {
        return true;
      }

      return row.count < max;
    },
    recordFailedAttempt(key, _max, windowMs) {
      const now = input.now();
      const row = input.readRateLimitWindow(key);

      if (!row || now - row.windowStartMs > windowMs) {
        input.resetRateLimitWindow(key, now, windowMs);
        return;
      }

      input.incrementRateLimitWindow(key);
    },
  };
}
