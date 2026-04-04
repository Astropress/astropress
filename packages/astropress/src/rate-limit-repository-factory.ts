import type { RateLimitRepository } from "./persistence-types";

export interface AstropressRateLimitWindowRecord {
  count: number;
  windowStartMs: number;
  windowMs?: number;
}

export interface AstropressRateLimitRepositoryInput {
  now(): number;
  readRateLimitWindow(key: string): AstropressRateLimitWindowRecord | null | undefined;
  resetRateLimitWindow(key: string, now: number, windowMs: number): void;
  incrementRateLimitWindow(key: string): void;
}

export function createAstropressRateLimitRepository(
  input: AstropressRateLimitRepositoryInput,
): RateLimitRepository {
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
