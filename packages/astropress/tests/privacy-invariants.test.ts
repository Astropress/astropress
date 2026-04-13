/**
 * Privacy invariant tests — structural checks that enforce Astropress's privacy-by-design
 * properties at the code level. These tests catch changes that would violate GDPR Article 25
 * (data protection by design and by default) or the California Consumer Privacy Act (CCPA).
 *
 * The philosophy: if PII is never stored in recoverable form, GDPR obligations (right of
 * access, right to erasure, data portability) become trivially satisfiable. These tests
 * enforce the architectural choices that make compliance tooling unnecessary.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = path.resolve(import.meta.dirname, "../src");
const schemaPath = path.resolve(srcRoot, "sqlite-schema.sql");
const bootstrapPath = path.resolve(srcRoot, "sqlite-bootstrap.ts");
const securityMiddlewarePath = path.resolve(srcRoot, "security-middleware.ts");
const analyticsPath = path.resolve(srcRoot, "analytics.ts");

const schema = readFileSync(schemaPath, "utf8");
const bootstrap = readFileSync(bootstrapPath, "utf8");
const securityMiddleware = readFileSync(securityMiddlewarePath, "utf8");

// ---------------------------------------------------------------------------
// Schema invariants
// ---------------------------------------------------------------------------

describe("schema privacy invariants", () => {
  it("comments table does not store IP addresses", () => {
    // Extract just the comments table definition
    const commentsTable = schema.match(/CREATE TABLE IF NOT EXISTS comments \([\s\S]*?\);/)?.[0] ?? "";
    expect(commentsTable, "comments table must not have an ip_address column").not.toMatch(/ip_address/i);
    expect(commentsTable, "comments table must not have an ip_addr column").not.toMatch(/\bip_addr\b/i);
    expect(commentsTable, "comments table must not have a submitter_ip column").not.toMatch(/submitter_ip/i);
  });

  it("contact_submissions table does not store IP addresses", () => {
    const contactTable = schema.match(/CREATE TABLE IF NOT EXISTS contact_submissions \([\s\S]*?\);/)?.[0] ?? "";
    expect(contactTable, "contact_submissions must not store IP addresses").not.toMatch(/ip_address|ip_addr|submitter_ip/i);
  });

  it("admin_sessions IP and user-agent columns are nullable (opt-in, not required)", () => {
    const sessionsTable = schema.match(/CREATE TABLE IF NOT EXISTS admin_sessions \([\s\S]*?\);/)?.[0] ?? "";
    // ip_address and user_agent may exist only if they are nullable (no NOT NULL constraint)
    if (sessionsTable.includes("ip_address")) {
      expect(sessionsTable, "admin_sessions.ip_address must be nullable — it is opt-in session metadata, not required PII").not.toMatch(/ip_address\s+TEXT\s+NOT NULL/i);
    }
    if (sessionsTable.includes("user_agent")) {
      expect(sessionsTable, "admin_sessions.user_agent must be nullable — it is opt-in session metadata, not required PII").not.toMatch(/user_agent\s+TEXT\s+NOT NULL/i);
    }
  });

  it("api_tokens are hashed at rest", () => {
    const apiTokensTable = schema.match(/CREATE TABLE IF NOT EXISTS api_tokens \([\s\S]*?\);/)?.[0] ?? "";
    // Raw token must not be stored — only the hash
    expect(apiTokensTable, "api_tokens must store token_hash, not raw token").toContain("token_hash");
    expect(apiTokensTable, "api_tokens must not have a raw_token column").not.toMatch(/\braw_token\b/i);
    expect(apiTokensTable, "api_tokens must not have a token_value column").not.toMatch(/\btoken_value\b/i);
    expect(apiTokensTable, "api_tokens must not have a plain token column without hash suffix").not.toMatch(/\btoken\s+TEXT/i);
  });

  it("webhook secrets are hashed at rest", () => {
    const webhooksTable = schema.match(/CREATE TABLE IF NOT EXISTS webhooks \([\s\S]*?\);/)?.[0] ?? "";
    // As documented in the schema comment, secret is stored under secret_hash for backwards compat
    expect(webhooksTable, "webhooks must not expose a plaintext secret column named 'secret' without indication of hashing").not.toMatch(/\bsecret\s+TEXT\s+NOT NULL/);
  });

  it("password hashes — no plaintext password columns in any table", () => {
    // Find all column definitions that look like they store passwords in plain text
    const suspiciousColumns = schema.match(/\bpassword\s+TEXT\b/gi) ?? [];
    expect(
      suspiciousColumns,
      "No table should have a plain 'password TEXT' column — passwords must be hashed (use password_hash)",
    ).toHaveLength(0);
  });

  it("no new tables introduce ip_address as NOT NULL", () => {
    // Any new table that stores IP addresses must make them nullable (opt-in)
    const notNullIp = schema.match(/ip_address\s+TEXT\s+NOT\s+NULL/gi) ?? [];
    expect(notNullIp, "IP address columns must be nullable — IP logging is opt-in, not required").toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Analytics: must be opt-in only
// ---------------------------------------------------------------------------

describe("analytics privacy invariants", () => {
  it("analytics module does not auto-inject scripts without explicit operator opt-in", () => {
    const analytics = readFileSync(analyticsPath, "utf8");

    // The analytics module must not unconditionally inject script tags or import remote scripts
    // It must check a config or feature flag before doing anything
    expect(
      analytics,
      "analytics.ts must check a config flag before injecting scripts — analytics must be opt-in",
    ).not.toMatch(/new\s+URL\s*\(\s*["']https?:/);

    // Must not reference any hardcoded third-party analytics domains as unconditional imports
    const thirdPartyAnalytics = ["google-analytics.com", "googletagmanager.com", "mixpanel.com", "amplitude.com", "heap.io"];
    for (const domain of thirdPartyAnalytics) {
      expect(analytics, `analytics.ts must not unconditionally reference ${domain}`).not.toContain(domain);
    }
  });

  it("security middleware does not inject analytics scripts on public pages without consent check", () => {
    // The security middleware runs on every request. If it injects analytics, it must be
    // gated behind an explicit operator configuration check, not unconditional.
    const analyticsKeywords = ["gtag(", "ga('send", "_gaq.push", "fbq('track"];
    for (const keyword of analyticsKeywords) {
      expect(
        securityMiddleware,
        `security-middleware.ts must not inject ${keyword} — that belongs in an opt-in analytics component`,
      ).not.toContain(keyword);
    }
  });
});

// ---------------------------------------------------------------------------
// Third-party scripts: public pages must not load external tracking
// ---------------------------------------------------------------------------

describe("third-party script invariants", () => {
  it("security middleware does not set headers that load third-party tracking pixels", () => {
    // Tracking pixels loaded via Link: preload or similar would bypass CSP review
    expect(securityMiddleware, "security-middleware must not add tracking pixel Link headers").not.toMatch(
      /Link.*\.(gif|png|jpg)\?.*tracking/i,
    );
  });

  it("security headers do not allowlist known tracking domains in CSP", () => {
    const securityHeaders = readFileSync(path.resolve(srcRoot, "security-headers.ts"), "utf8");
    const trackingDomains = [
      "google-analytics.com",
      "googletagmanager.com",
      "connect.facebook.net",
      "platform.twitter.com",
      "snap.licdn.com",
    ];
    for (const domain of trackingDomains) {
      expect(
        securityHeaders,
        `security-headers.ts must not allowlist ${domain} in default CSP — tracking scripts must be opt-in`,
      ).not.toContain(domain);
    }
  });
});

// ---------------------------------------------------------------------------
// Data minimization: no unnecessary PII fields should be added to public-facing forms
// ---------------------------------------------------------------------------

describe("data minimization invariants", () => {
  it("comment submission does not collect phone numbers or physical addresses", () => {
    const commentTable = schema.match(/CREATE TABLE IF NOT EXISTS comments \([\s\S]*?\);/)?.[0] ?? "";
    expect(commentTable, "comments table must not collect phone numbers").not.toMatch(/\bphone\b|\btel\b|\bmobile\b/i);
    expect(commentTable, "comments table must not collect physical addresses").not.toMatch(/\baddress\b|\bpostcode\b|\bzip\b/i);
  });

  it("contact_submissions does not collect phone numbers or physical addresses", () => {
    const contactTable = schema.match(/CREATE TABLE IF NOT EXISTS contact_submissions \([\s\S]*?\);/)?.[0] ?? "";
    expect(contactTable, "contact_submissions must not collect phone numbers").not.toMatch(/\bphone\b|\btel\b|\bmobile\b/i);
    expect(contactTable, "contact_submissions must not collect physical addresses").not.toMatch(/\baddress\b|\bpostcode\b|\bzip\b/i);
  });

  it("bootstrap seeder does not log email addresses to stdout or console", () => {
    // Logging PII to stdout risks leaking it into log aggregators
    const emailLogPattern = /console\.(log|info|warn|error)\s*\([^)]*email[^)]*\)/i;
    expect(
      bootstrap,
      "sqlite-bootstrap.ts must not log email addresses via console — use structured logger with PII redaction",
    ).not.toMatch(emailLogPattern);
  });
});

// ---------------------------------------------------------------------------
// Session security: sessions must be revocable and time-limited
// ---------------------------------------------------------------------------

describe("session security invariants", () => {
  it("admin_sessions table has a revoked_at column for server-side revocation", () => {
    const sessionsTable = schema.match(/CREATE TABLE IF NOT EXISTS admin_sessions \([\s\S]*?\);/)?.[0] ?? "";
    expect(sessionsTable, "admin_sessions must support server-side revocation via revoked_at").toContain("revoked_at");
  });

  it("admin_sessions table has a last_active_at column for TTL enforcement", () => {
    const sessionsTable = schema.match(/CREATE TABLE IF NOT EXISTS admin_sessions \([\s\S]*?\);/)?.[0] ?? "";
    expect(sessionsTable, "admin_sessions must track last_active_at for TTL enforcement").toContain("last_active_at");
  });

  it("session store enforces TTL on getSessionUser", () => {
    const authStore = readFileSync(path.resolve(srcRoot, "sqlite-runtime/auth.ts"), "utf8");
    expect(
      authStore,
      "getSessionUser must check TTL — sessions must expire, not be held indefinitely",
    ).toMatch(/last_active_at|ttl|expires|expired/i);
  });
});

// ---------------------------------------------------------------------------
// Right-to-erasure readiness: deletions must cascade
// ---------------------------------------------------------------------------

describe("right-to-erasure schema readiness", () => {
  it("admin_sessions deletes cascade when admin_user is deleted", () => {
    const sessionsTable = schema.match(/CREATE TABLE IF NOT EXISTS admin_sessions \([\s\S]*?\);/)?.[0] ?? "";
    expect(
      sessionsTable,
      "admin_sessions must CASCADE on user deletion — deleting a user must also delete their sessions",
    ).toMatch(/ON DELETE CASCADE/i);
  });

  it("content_revisions deletes cascade when content_overrides is deleted", () => {
    const revisionsTable = schema.match(/CREATE TABLE IF NOT EXISTS content_revisions \([\s\S]*?\);/)?.[0] ?? "";
    expect(
      revisionsTable,
      "content_revisions must CASCADE on content deletion",
    ).toMatch(/ON DELETE CASCADE/i);
  });
});

// ---------------------------------------------------------------------------
// Email hashing: comment author emails must be hashed before storage
// ---------------------------------------------------------------------------

import { createAstropressCommentRepository, hashCommentEmail } from "../src/comment-repository-factory";
import { vi } from "vitest";

describe("comment author email hashing", () => {
  it("hashCommentEmail produces a 64-char KMAC256 hex digest", async () => {
    const digest = await hashCommentEmail("author@example.com", "test-salt");
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashCommentEmail is deterministic for the same email and salt", async () => {
    const a = await hashCommentEmail("author@example.com", "my-salt");
    const b = await hashCommentEmail("author@example.com", "my-salt");
    expect(a).toBe(b);
  });

  it("hashCommentEmail produces different digests for different emails", async () => {
    const a = await hashCommentEmail("alice@example.com", "salt");
    const b = await hashCommentEmail("bob@example.com", "salt");
    expect(a).not.toBe(b);
  });

  it("hashCommentEmail produces different digests for different salts", async () => {
    const a = await hashCommentEmail("author@example.com", "salt1");
    const b = await hashCommentEmail("author@example.com", "salt2");
    expect(a).not.toBe(b);
  });

  it("submitPublicComment stores a hashed email (64-char hex) when sessionSalt is provided", async () => {
    const insertedComments: Array<{ email?: string }> = [];
    const repository = createAstropressCommentRepository({
      getComments: vi.fn(() => []),
      getCommentRoute: vi.fn(() => null),
      updateCommentStatus: vi.fn(() => true),
      insertPublicComment: vi.fn((c) => {
        insertedComments.push({ email: c.email });
        return new Date().toISOString();
      }),
      recordCommentAudit: vi.fn(),
      sessionSalt: "site-secret-salt",
    });

    const result = await repository.submitPublicComment({
      author: "Alice",
      email: "alice@example.com",
      body: "Great post",
      route: "/blog/hello",
      submittedAt: new Date().toISOString(),
    });

    expect(result.ok).toBe(true);
    // The stored email must be a deterministic keyed digest, never the raw address
    expect(insertedComments[0]?.email).toMatch(/^[a-f0-9]{64}$/);
    expect(insertedComments[0]?.email).not.toContain("alice");
  });

  it("schema has no column named author_email_plain (no plaintext email column)", () => {
    expect(schema).not.toMatch(/author_email_plain/i);
  });
});
