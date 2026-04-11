import type { AuthStore, AuthUser } from "../platform-contracts";
import { createSessionTokenDigest, verifyPassword } from "../crypto-utils.js";
import { createLogger } from "../runtime-logger";
import type { D1DatabaseLike } from "../d1-database";

const logger = createLogger("Cloudflare");

export type AstropressCloudflareSeedUser = AuthUser & { password: string };

export function resolveCloudflareSessionSecret(): string {
  const secret = process.env.CLOUDFLARE_SESSION_SECRET ?? "cloudflare-adapter-session-secret";
  if (secret === "cloudflare-adapter-session-secret") {
    logger.warn(
      "CLOUDFLARE_SESSION_SECRET is using the insecure default. " +
        "Set this env var to a long random string before deploying.",
    );
  }
  return secret;
}

export const CLOUDFLARE_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export async function cleanupExpiredCloudflareSessions(db: D1DatabaseLike) {
  await db
    .prepare(
      `
        UPDATE admin_sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE revoked_at IS NULL
          AND last_active_at < datetime('now', '-12 hours')
      `,
    )
    .run();
}

export async function getLiveCloudflareSessionRow(db: D1DatabaseLike, sessionId: string) {
  await cleanupExpiredCloudflareSessions(db);

  const sessionCandidates = [sessionId, await createSessionTokenDigest(sessionId, resolveCloudflareSessionSecret())];
  let row: { id: string; last_active_at: string; email: string; role: AuthUser["role"] } | null = null;

  for (const candidate of sessionCandidates) {
    row = await db
      .prepare(
        `
          SELECT s.id, s.last_active_at, u.email, u.role
          FROM admin_sessions s
          JOIN admin_users u ON u.id = s.user_id
          WHERE s.id = ?
            AND s.revoked_at IS NULL
            AND u.active = 1
          LIMIT 1
        `,
      )
      .bind(candidate)
      .first<{ id: string; last_active_at: string; email: string; role: AuthUser["role"] }>();
    if (row) break;
  }

  if (!row) return null;

  const lastActiveAt = Date.parse(row.last_active_at);
  if (!Number.isFinite(lastActiveAt) || Date.now() - lastActiveAt > CLOUDFLARE_SESSION_TTL_MS) {
    await db
      .prepare(`UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL`)
      .bind(row.id)
      .run();
    return null;
  }

  await db.prepare("UPDATE admin_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id).run();
  return row;
}

export function createFallbackCloudflareAuthStore(seedUsers: AstropressCloudflareSeedUser[]): AuthStore {
  const users = new Map(seedUsers.map((user) => [user.email.toLowerCase(), user]));
  const sessions = new Map<string, AuthUser>();

  return {
    async signIn(email, password) {
      const user = users.get(email.trim().toLowerCase());
      if (!user || user.password !== password) return null;
      const sessionId = `cloudflare-session:${user.id}`;
      const sessionUser = { id: sessionId, email: user.email, role: user.role };
      sessions.set(sessionId, sessionUser);
      return sessionUser;
    },
    async signOut(sessionId) {
      sessions.delete(sessionId);
    },
    async getSession(sessionId) {
      return sessions.get(sessionId) ?? null;
    },
  };
}

export function createDisabledCloudflareAuthStore(): AuthStore {
  return {
    async signIn() { return null; },
    async signOut() {},
    async getSession() { return null; },
  };
}

export function createD1CloudflareAuthStore(db: D1DatabaseLike): AuthStore {
  return {
    async signIn(email, password) {
      const row = await db
        .prepare(
          `SELECT id, email, role, password_hash FROM admin_users WHERE email = ? AND active = 1 LIMIT 1`,
        )
        .bind(email.trim().toLowerCase())
        .first<{ id: number; email: string; role: AuthUser["role"]; password_hash: string }>();

      if (!row || !(await verifyPassword(password, row.password_hash))) return null;

      const sessionId = crypto.randomUUID();
      const storedSessionId = await createSessionTokenDigest(sessionId, resolveCloudflareSessionSecret());
      const csrfToken = crypto.randomUUID();

      await db
        .prepare(`INSERT INTO admin_sessions (id, user_id, csrf_token, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)`)
        .bind(storedSessionId, row.id, csrfToken, null, "astropress-cloudflare-adapter")
        .run();

      return { id: sessionId, email: row.email, role: row.role };
    },
    async signOut(sessionId) {
      for (const candidate of [sessionId, await createSessionTokenDigest(sessionId, resolveCloudflareSessionSecret())]) {
        await db
          .prepare(`UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL`)
          .bind(candidate)
          .run();
      }
    },
    async getSession(sessionId) {
      const row = await getLiveCloudflareSessionRow(db, sessionId);
      if (!row) return null;
      return { id: sessionId, email: row.email, role: row.role };
    },
  };
}
