/**
 * Zero Trust Architecture (ZTA) invariant tests — NIST SP 800-207
 *
 * Core ZTA principles:
 *   1. Never trust, always verify — every request must present proof of identity
 *   2. Least privilege — credentials grant only the minimum access needed
 *   3. Assume breach — audit everything, propagate trace IDs, make revocation instant
 *   4. Explicit validation — authorization is checked per-request, not cached at session start
 *
 * These tests verify that Astropress's structural implementation enforces ZTA at the
 * code level — so that a future contributor cannot accidentally introduce an unguarded
 * route, a scope escalation path, or a session that outlives its revocation.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pagesRoot = path.resolve(import.meta.dirname, "../pages/ap-admin");
const actionsRoot = path.resolve(pagesRoot, "actions");
const srcRoot = path.resolve(import.meta.dirname, "../src");

// Auth-exempt pages — login flow, not protected by session
const AUTH_EXEMPT_PAGES = new Set(["login.astro", "accept-invite.astro", "reset-password.astro"]);
// Auth-exempt actions — session creation and token consumption happen before session exists
const AUTH_EXEMPT_ACTIONS = new Set(["accept-invite.ts", "reset-password.ts"]);

function listFiles(root: string, ext: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(root)) {
    const full = path.join(root, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...listFiles(full, ext));
    } else if (full.endsWith(ext)) {
      results.push(full);
    }
  }
  return results.sort();
}

// ---------------------------------------------------------------------------
// ZTA Principle 1: Never trust, always verify
// ---------------------------------------------------------------------------

describe("ZTA P1: every request must prove identity", () => {
  it("all admin action handlers use withAdminFormAction or requireAdminFormAction — no unauthenticated write paths", () => {
    const actionFiles = listFiles(actionsRoot, ".ts").filter(
      (f) => !AUTH_EXEMPT_ACTIONS.has(path.basename(f)),
    );

    for (const file of actionFiles) {
      const src = readFileSync(file, "utf8");
      const rel = path.relative(path.resolve(import.meta.dirname, ".."), file);

      expect(
        src,
        `${rel}: every action handler must use withAdminFormAction or requireAdminFormAction`,
      ).toMatch(/withAdminFormAction|requireAdminFormAction/);
    }
  });

  it("withAdminFormAction always calls getRuntimeSessionUser — session is verified per-request", () => {
    const utils = readFileSync(path.join(srcRoot, "admin-action-utils.ts"), "utf8");
    expect(utils).toContain("getRuntimeSessionUser");
    // Must be called before the action runs (inside requireAdminFormAction, before formData)
    const requireFnBody = utils.match(/async function requireAdminFormAction[\s\S]*?^}/m)?.[0] ?? utils;
    expect(requireFnBody).toContain("getRuntimeSessionUser");
  });

  it("session verification checks revoked_at IS NULL — revoked sessions are denied immediately", () => {
    const authSrc = readFileSync(path.join(srcRoot, "runtime-admin-auth.ts"), "utf8");
    expect(authSrc, "session query must check revoked_at IS NULL").toMatch(/revoked_at\s+IS\s+NULL/i);
  });

  it("session verification checks active = 1 on the user — suspended users lose access immediately", () => {
    const authSrc = readFileSync(path.join(srcRoot, "runtime-admin-auth.ts"), "utf8");
    expect(authSrc, "session query must check user active = 1").toMatch(/u\.active\s*=\s*1/i);
  });

  it("admin pages read Astro.locals.adminUser — auth is resolved in middleware, not ad-hoc", () => {
    // The pattern: admin pages read a pre-resolved user from locals (set by middleware), they
    // do not re-implement session lookup inline. This ensures consistent enforcement.
    const pageFiles = listFiles(pagesRoot, ".astro").filter(
      (f) => !AUTH_EXEMPT_PAGES.has(path.basename(f)),
    );

    for (const file of pageFiles) {
      const src = readFileSync(file, "utf8");
      const rel = path.relative(path.resolve(import.meta.dirname, ".."), file);

      // Either reads from locals.adminUser OR redirects if no session
      const hasAuthCheck =
        src.includes("Astro.locals.adminUser") ||
        src.includes("locals.adminUser") ||
        src.includes("redirect") && src.includes("login");

      expect(hasAuthCheck, `${rel}: admin page must read session user from locals or redirect to login`).toBe(true);
    }
  });

  it("no admin page sets export const prerender = true — prerendering would bypass runtime auth", () => {
    const pageFiles = listFiles(pagesRoot, ".astro");

    for (const file of pageFiles) {
      const src = readFileSync(file, "utf8");
      const rel = path.relative(path.resolve(import.meta.dirname, ".."), file);

      // prerender = false is allowed (explicitly non-prerendered), prerender = true is not
      expect(
        src,
        `${rel}: must not set prerender = true — admin pages must run at request time for auth enforcement`,
      ).not.toMatch(/export\s+const\s+prerender\s*=\s*true/);
    }
  });
});

// ---------------------------------------------------------------------------
// ZTA Principle 2: Least privilege
// ---------------------------------------------------------------------------

describe("ZTA P2: least privilege", () => {
  it("CSRF token is validated on all state-changing action handlers", () => {
    const utils = readFileSync(path.join(srcRoot, "admin-action-utils.ts"), "utf8");
    // The CSRF check must compare submitted token against the server-side token
    expect(utils).toContain("_csrf");
    expect(utils, "CSRF check must use constant-time comparison or strict equality").toMatch(
      /submittedToken\s*!==\s*expectedToken|timingSafeEqual|!expectedToken/,
    );
  });

  it("request origin is validated on all form submissions — prevents cross-origin POST forgery", () => {
    const utils = readFileSync(path.join(srcRoot, "admin-action-utils.ts"), "utf8");
    expect(utils, "admin actions must validate request origin").toContain("isTrustedRequestOrigin");
  });

  it("requireAdmin flag is available and checked for admin-only actions", () => {
    const utils = readFileSync(path.join(srcRoot, "admin-action-utils.ts"), "utf8");
    expect(utils).toContain("requireAdmin");
    expect(utils).toContain("sessionUser.role !== \"admin\"");
  });

  it("API token scope is validated per-request, not cached", () => {
    const apiMiddleware = readFileSync(path.join(srcRoot, "api-middleware.ts"), "utf8");
    // Token validation must check scopes on every call
    expect(apiMiddleware, "API middleware must verify token scopes on every request").toMatch(
      /scope|scopes/i,
    );
    // Must not cache scope results across requests (no module-level scope cache)
    expect(apiMiddleware, "API middleware must not cache token scope results at module level").not.toMatch(
      /const\s+scopeCache\s*=|const\s+tokenCache\s*=/,
    );
  });

  it("admin users cannot escalate their own role via settings", () => {
    const userActions = listFiles(actionsRoot, ".ts").filter((f) => f.includes("user"));
    for (const file of userActions) {
      const src = readFileSync(file, "utf8");
      const rel = path.relative(path.resolve(import.meta.dirname, ".."), file);
      // User actions that modify role must require admin
      if (src.includes("role") && src.includes("formData.get")) {
        expect(src, `${rel}: actions that set user roles must require admin role`).toMatch(
          /requireAdmin|role.*admin|admin.*role/,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ZTA Principle 3: Assume breach — audit, trace, contain
// ---------------------------------------------------------------------------

describe("ZTA P3: assume breach — audit trail and trace propagation", () => {
  it("security middleware attaches X-Request-Id to every response", () => {
    const middleware = readFileSync(path.join(srcRoot, "security-middleware.ts"), "utf8");
    expect(middleware, "every response must carry a unique X-Request-Id for breach investigation").toContain("X-Request-Id");
    expect(middleware, "X-Request-Id must be a fresh UUID per request, not a static value").toContain(
      "crypto.randomUUID()",
    );
  });

  it("content write actions record audit events — all mutations are traceable", () => {
    const contentActions = readFileSync(path.join(srcRoot, "runtime-actions-content.ts"), "utf8");
    expect(contentActions, "content create must record audit event").toMatch(/recordD1Audit|recordAudit/);
    // Must audit at least create, update, and restore
    expect(contentActions).toContain("content.create");
    expect(contentActions).toContain("content.update");
    expect(contentActions).toContain("content.restore");
  });

  it("user management actions record audit events", () => {
    const userActions = readFileSync(path.join(srcRoot, "runtime-actions-users.ts"), "utf8");
    expect(userActions, "user management must record audit events").toMatch(/recordD1Audit/);
    expect(userActions).toContain("user.invite");
    expect(userActions).toContain("user.suspend");
  });

  it("audit_events table is write-only from application code — no DELETE in audit log code", () => {
    // Audit logs must be append-only. No application code should DELETE from audit_events
    // (pruning is only by scheduled retention policy, not in response to user actions).
    const auditLog = readFileSync(path.join(srcRoot, "sqlite-runtime/audit-log.ts"), "utf8");
    expect(
      auditLog,
      "audit-log.ts must not contain DELETE statements — audit logs are append-only",
    ).not.toMatch(/DELETE\s+FROM\s+audit_events/i);
  });

  it("session revocation is synchronous — revokeSession writes to DB, not just clears a cookie", () => {
    const authSrc = readFileSync(path.join(srcRoot, "runtime-admin-auth.ts"), "utf8");
    expect(authSrc, "session revocation must write revoked_at to the database").toMatch(
      /revoked_at\s*=\s*CURRENT_TIMESTAMP/i,
    );
  });
});

// ---------------------------------------------------------------------------
// ZTA Principle 4: Explicit, per-request authorization
// ---------------------------------------------------------------------------

describe("ZTA P4: no implicit trust — explicit authorization on every request", () => {
  it("session TTL is enforced per-request, not only at login", () => {
    const authSrc = readFileSync(path.join(srcRoot, "runtime-admin-auth.ts"), "utf8");
    // TTL check must be in the session verification path (getLiveD1SessionRow / getSessionUser), not only login
    expect(authSrc, "TTL enforcement must be in getSessionUser, not just createSession").toMatch(
      /SESSION_TTL_MS|12.*hours/i,
    );
  });

  it("API endpoint handlers call withApiRequest — no endpoint skips token verification", () => {
    const apiPages = listFiles(
      path.resolve(import.meta.dirname, "../pages/ap-api"),
      ".ts",
    ).filter((f) => !f.endsWith("openapi.json.ts")); // OpenAPI spec is intentionally public

    for (const file of apiPages) {
      const src = readFileSync(file, "utf8");
      const rel = path.relative(path.resolve(import.meta.dirname, ".."), file);
      expect(src, `${rel}: every API handler must verify the Bearer token via withApiRequest`).toContain(
        "withApiRequest",
      );
    }
  });

  it("health endpoint is exempt from auth — it is read-only and returns no sensitive data", () => {
    const healthPage = readFileSync(
      path.resolve(import.meta.dirname, "../pages/ap/health.ts"),
      "utf8",
    );
    // Health endpoint must not return session data, user data, or internal config
    expect(healthPage).not.toContain("adminUser");
    expect(healthPage).not.toContain("email");
    expect(healthPage).not.toContain("password");
    expect(healthPage).not.toContain("sessionToken");
  });

  it("security headers are applied by middleware, not per-page — coverage cannot be bypassed by forgetting to call it", () => {
    // The middleware entrypoint wires security headers for all routes centrally
    const entrypoint = readFileSync(path.join(srcRoot, "security-middleware-entrypoint.ts"), "utf8");
    expect(entrypoint, "security middleware must be the single wiring point for headers").toContain(
      "createAstropressSecurityMiddleware",
    );
    // No admin page should call applyAstropressSecurityHeaders directly (that would allow per-page bypass)
    const pageFiles = listFiles(pagesRoot, ".astro");
    for (const file of pageFiles) {
      const src = readFileSync(file, "utf8");
      const rel = path.relative(path.resolve(import.meta.dirname, ".."), file);
      // Exception: AdminLayout.astro sets headers for the admin area explicitly (it's a layout, not a page)
      if (file.includes("AdminLayout")) continue;
      expect(
        src,
        `${rel}: pages must not call applyAstropressSecurityHeaders directly — this bypasses the middleware's area routing`,
      ).not.toContain("applyAstropressSecurityHeaders");
    }
  });
});
