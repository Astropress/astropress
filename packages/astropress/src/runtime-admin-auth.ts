import { createSessionTokenDigest, verifyPassword } from "./crypto-utils";
import type { D1DatabaseLike } from "./d1-database";
import { loadLocalAdminAuth, loadLocalAdminStore } from "./local-runtime-modules";
import type { SessionUser } from "./persistence-types";
import { getAdminBootstrapConfig, getCloudflareBindings } from "./runtime-env";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function getD1(locals?: App.Locals | null): D1DatabaseLike | undefined {
  return getCloudflareBindings(locals).DB;
}

async function cleanupExpiredSessions(db: D1DatabaseLike) {
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

async function getLiveD1SessionRow(db: D1DatabaseLike, sessionToken: string | null | undefined, locals?: App.Locals | null) {
  if (!sessionToken) {
    return null;
  }

  await cleanupExpiredSessions(db);

  const sessionCandidates = [sessionToken];
  const sessionSecret = getAdminBootstrapConfig(locals).sessionSecret?.trim();
  if (sessionSecret) {
    sessionCandidates.unshift(await createSessionTokenDigest(sessionToken, sessionSecret));
  }

  let row: {
    id: string;
    csrf_token: string;
    last_active_at: string;
    email: string;
    role: SessionUser["role"];
    name: string;
  } | null = null;

  for (const sessionId of sessionCandidates) {
    row = await db
      .prepare(
        `
          SELECT s.id, s.csrf_token, s.last_active_at, u.email, u.role, u.name
          FROM admin_sessions s
          JOIN admin_users u ON u.id = s.user_id
          WHERE s.id = ?
            AND s.revoked_at IS NULL
            AND u.active = 1
          LIMIT 1
        `,
      )
      .bind(sessionId)
      .first<{
        id: string;
        csrf_token: string;
        last_active_at: string;
        email: string;
        role: SessionUser["role"];
        name: string;
      }>();

    if (row) {
      break;
    }
  }

  if (!row) {
    return null;
  }

  const lastActiveAt = Date.parse(row.last_active_at);
  if (!Number.isFinite(lastActiveAt) || Date.now() - lastActiveAt > SESSION_TTL_MS) {
    await db
      .prepare(
        `
          UPDATE admin_sessions
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND revoked_at IS NULL
        `,
      )
      .bind(row.id)
      .run();
    return null;
  }

  await db.prepare("UPDATE admin_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id).run();
  return row;
}

export async function authenticateRuntimeAdminUser(
  email: string,
  password: string,
  locals?: App.Locals | null,
): Promise<SessionUser | null> {
  const db = getD1(locals);
  if (!db) {
    const localAdminAuth = await loadLocalAdminAuth();
    return localAdminAuth.authenticateAdminUser(email, password);
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return null;
  }

  const row = await db
    .prepare(
      `
        SELECT email, password_hash, role, name
        FROM admin_users
        WHERE email = ?
          AND active = 1
        LIMIT 1
      `,
    )
    .bind(normalizedEmail)
    .first<{
      email: string;
      password_hash: string;
      role: SessionUser["role"];
      name: string;
    }>();

  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return null;
  }

  return {
    email: row.email,
    role: row.role,
    name: row.name,
  };
}

export async function createRuntimeSession(
  user: SessionUser,
  metadata?: { ipAddress?: string | null; userAgent?: string | null },
  locals?: App.Locals | null,
) {
  const db = getD1(locals);
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.createSession(user, metadata);
  }

  const userRow = await db
    .prepare("SELECT id FROM admin_users WHERE email = ? AND active = 1 LIMIT 1")
    .bind(user.email.toLowerCase())
    .first<{ id: number }>();

  if (!userRow) {
    throw new Error(`Cannot create a session for unknown admin user ${user.email}.`);
  }

  const sessionToken = crypto.randomUUID();
  const csrfToken = crypto.randomUUID();
  const sessionSecret = getAdminBootstrapConfig(locals).sessionSecret?.trim();
  const storedSessionId = sessionSecret
    ? await createSessionTokenDigest(sessionToken, sessionSecret)
    : sessionToken;

  await db
    .prepare(
      `
        INSERT INTO admin_sessions (id, user_id, csrf_token, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .bind(storedSessionId, userRow.id, csrfToken, metadata?.ipAddress ?? null, metadata?.userAgent ?? null)
    .run();

  return sessionToken;
}

export async function getRuntimeSessionUser(sessionToken: string | null | undefined, locals?: App.Locals | null) {
  const db = getD1(locals);
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.getSessionUser(sessionToken);
  }

  const row = await getLiveD1SessionRow(db, sessionToken, locals);
  if (!row) {
    return null;
  }

  return {
    email: row.email,
    role: row.role,
    name: row.name,
  };
}

export async function getRuntimeCsrfToken(sessionToken: string | null | undefined, locals?: App.Locals | null) {
  const db = getD1(locals);
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.getCsrfToken(sessionToken);
  }

  const row = await getLiveD1SessionRow(db, sessionToken, locals);
  return row?.csrf_token ?? null;
}

export async function revokeRuntimeSession(sessionToken: string | null | undefined, locals?: App.Locals | null) {
  const db = getD1(locals);
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    localAdminStore.revokeSession(sessionToken);
    return;
  }

  if (!sessionToken) {
    return;
  }

  const sessionCandidates = [sessionToken];
  const sessionSecret = getAdminBootstrapConfig(locals).sessionSecret?.trim();
  if (sessionSecret) {
    sessionCandidates.unshift(await createSessionTokenDigest(sessionToken, sessionSecret));
  }

  for (const sessionId of sessionCandidates) {
    await db
      .prepare(
        `
          UPDATE admin_sessions
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND revoked_at IS NULL
        `,
      )
      .bind(sessionId)
      .run();
  }
}

async function recordRuntimeAudit(
  action: string,
  summary: string,
  actor: SessionUser,
  locals?: App.Locals | null,
) {
  const db = getD1(locals);
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    if (action === "auth.login") {
      localAdminStore.recordSuccessfulLogin(actor);
      return;
    }
    if (action === "auth.logout") {
      localAdminStore.recordLogout(actor);
      return;
    }
    return;
  }

  await db
    .prepare(
      `
        INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
        VALUES (?, ?, 'auth', ?, ?)
      `,
    )
    .bind(actor.email, action, actor.email, summary)
    .run();
}

export async function recordRuntimeSuccessfulLogin(actor: SessionUser, locals?: App.Locals | null) {
  return recordRuntimeAudit("auth.login", `${actor.name} signed in successfully.`, actor, locals);
}

export async function recordRuntimeLogout(actor: SessionUser, locals?: App.Locals | null) {
  return recordRuntimeAudit("auth.logout", `${actor.name} signed out.`, actor, locals);
}
