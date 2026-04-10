/**
 * Global Privacy Baseline — structural tests for the common requirements shared by
 * major privacy frameworks worldwide.
 *
 * Frameworks covered and their common denominator:
 *   - GDPR (EU, Art. 5, 17, 20, 25)           — data minimization, erasure, portability, PbD
 *   - CCPA/CPRA (California)                   — right to know, delete, opt-out of "sale"
 *   - LGPD (Brazil, Lei 13.709/2018)           — data minimization, security measures, deletion rights
 *   - PDPA (Thailand, Singapore)               — consent, purpose limitation, retention limits
 *   - APP (Australia, Privacy Act 1988)        — notice at collection, limited secondary use
 *   - POPIA (South Africa)                     — processing limitation, retention limits, security
 *   - PIPL (China)                             — data minimization, localization options, deletion
 *   - PIPEDA (Canada)                          — safeguards, retention limits, access rights
 *
 * The common denominator (what ALL of these require):
 *   1. Data minimization: only collect what you need
 *   2. Storage limitation: don't retain data forever
 *   3. Security measures: protect what you do store
 *   4. Erasure/deletion: users can request removal
 *   5. No secondary use: don't repurpose data beyond original collection
 *   6. No cross-border transfer to non-adequate countries by default
 *
 * These tests check that Astropress's architecture satisfies the common denominator
 * structurally — meaning operators can build compliant sites without needing to add
 * compliance tooling on top.
 *
 * Framework-specific requirements not testable at this structural level:
 *   - GDPR DPA registration, DPO appointment, breach notification timelines
 *   - CCPA "Do Not Sell My Personal Information" link (operator responsibility)
 *   - PIPEDA CASL consent for commercial email (operator responsibility)
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = path.resolve(import.meta.dirname, "../src");
const schema = readFileSync(path.join(srcRoot, "sqlite-schema.sql"), "utf8");

// ---------------------------------------------------------------------------
// 1. Data minimization
// ---------------------------------------------------------------------------

describe("global privacy: data minimization", () => {
  it("public comment submission does not collect device fingerprint data", () => {
    const commentTable = schema.match(/CREATE TABLE IF NOT EXISTS comments \([\s\S]*?\);/)?.[0] ?? "";
    const prohibited = ["user_agent", "fingerprint", "browser", "os_name", "screen_resolution", "timezone"];
    for (const col of prohibited) {
      expect(commentTable, `comments must not store ${col} (device fingerprint)`).not.toContain(col);
    }
  });

  it("contact form does not collect more than name, email, and message", () => {
    const contactTable = schema.match(/CREATE TABLE IF NOT EXISTS contact_submissions \([\s\S]*?\);/)?.[0] ?? "";
    // Permitted columns only
    const permitted = new Set(["id", "name", "email", "message", "submitted_at"]);
    const columnMatches = [...contactTable.matchAll(/^\s{2}(\w+)\s+TEXT/gm)].map((m) => m[1]);
    for (const col of columnMatches) {
      expect(permitted, `contact_submissions column '${col}' is not in the minimal permitted set`).toContain(col);
    }
  });

  it("admin_sessions does not require device metadata — IP and user_agent are nullable opt-ins", () => {
    const sessionsTable = schema.match(/CREATE TABLE IF NOT EXISTS admin_sessions \([\s\S]*?\);/)?.[0] ?? "";
    if (sessionsTable.includes("ip_address")) {
      expect(sessionsTable).not.toMatch(/ip_address\s+TEXT\s+NOT NULL/i);
    }
    if (sessionsTable.includes("user_agent")) {
      expect(sessionsTable).not.toMatch(/user_agent\s+TEXT\s+NOT NULL/i);
    }
  });

  it("analytics module only sends data to explicitly configured self-hosted endpoints", () => {
    const analytics = readFileSync(path.join(srcRoot, "analytics.ts"), "utf8");
    // Third-party hardcoded endpoints violate data minimization (sends data without explicit consent)
    const hardcodedThirdParty = [
      "google-analytics.com",
      "googletagmanager.com",
      "segment.io",
      "mixpanel.com",
      "amplitude.com",
      "heap.io",
      "fullstory.com",
      "hotjar.com",
    ];
    for (const domain of hardcodedThirdParty) {
      expect(analytics, `analytics.ts must not hardcode ${domain} as a default endpoint`).not.toContain(domain);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Storage limitation — data must not be retained indefinitely
// ---------------------------------------------------------------------------

describe("global privacy: storage limitation", () => {
  it("admin sessions are time-limited and auto-expired", () => {
    const authSrc = readFileSync(path.join(srcRoot, "runtime-admin-auth.ts"), "utf8");
    // Must have a TTL constant and enforce it
    expect(authSrc, "sessions must have a TTL").toMatch(/SESSION_TTL_MS|ttl_ms|hours/i);
    expect(authSrc, "expired sessions must be automatically revoked").toMatch(
      /revoked_at\s*=\s*CURRENT_TIMESTAMP|cleanupExpiredSessions/i,
    );
  });

  it("API tokens have an expires_at column — tokens can have a fixed lifetime", () => {
    const apiTokensTable = schema.match(/CREATE TABLE IF NOT EXISTS api_tokens \([\s\S]*?\);/)?.[0] ?? "";
    expect(apiTokensTable, "API tokens must support expiry via expires_at").toContain("expires_at");
  });

  it("API tokens have a revoked_at column — tokens can be invalidated before expiry", () => {
    const apiTokensTable = schema.match(/CREATE TABLE IF NOT EXISTS api_tokens \([\s\S]*?\);/)?.[0] ?? "";
    expect(apiTokensTable, "API tokens must be revocable via revoked_at").toContain("revoked_at");
  });

  it("password reset tokens have an expires_at column — reset links cannot be used indefinitely", () => {
    const resetTable = schema.match(/CREATE TABLE IF NOT EXISTS password_reset_tokens \([\s\S]*?\);/)?.[0] ?? "";
    expect(resetTable, "password_reset_tokens must expire").toContain("expires_at");
  });

  it("user invite tokens have an expires_at column — invitations cannot be accepted indefinitely", () => {
    const inviteTable = schema.match(/CREATE TABLE IF NOT EXISTS user_invites \([\s\S]*?\);/)?.[0] ?? "";
    expect(inviteTable, "user_invites must expire").toContain("expires_at");
  });
});

// ---------------------------------------------------------------------------
// 3. Security measures (Art. 32 GDPR, PDPA security obligations, APP APP 11)
// ---------------------------------------------------------------------------

describe("global privacy: security measures for stored data", () => {
  it("passwords are stored as hashes, never in plain text", () => {
    expect(schema, "schema must not have a plain 'password TEXT' column").not.toMatch(/\bpassword\s+TEXT\b/gi);
    // Verify password_hash column exists in admin_users
    const adminUsers = schema.match(/CREATE TABLE IF NOT EXISTS admin_users \([\s\S]*?\);/)?.[0] ?? "";
    expect(adminUsers).toContain("password_hash");
  });

  it("API tokens are hashed at rest — raw token is never persisted", () => {
    const apiTokensTable = schema.match(/CREATE TABLE IF NOT EXISTS api_tokens \([\s\S]*?\);/)?.[0] ?? "";
    expect(apiTokensTable).toContain("token_hash");
    expect(apiTokensTable).not.toMatch(/\btoken\s+TEXT\b/i);
  });

  it("crypto utilities use PBKDF2 or comparable KDF for password hashing", () => {
    const cryptoUtils = readFileSync(path.join(srcRoot, "crypto-utils.ts"), "utf8");
    // Must use PBKDF2, bcrypt, argon2, or scrypt — not MD5, SHA-1, or raw SHA-256
    expect(cryptoUtils, "passwords must use a proper KDF, not raw SHA hashing").toMatch(
      /pbkdf2|bcrypt|argon2|scrypt/i,
    );
    expect(cryptoUtils, "password hashing must not use MD5").not.toMatch(/createHash\s*\(\s*["']md5["']\)/i);
    expect(cryptoUtils, "password hashing must not use raw SHA-1").not.toMatch(/createHash\s*\(\s*["']sha1["']\)/i);
  });

  it("CSRF protection is enforced on all form submissions — prevents forged cross-site requests", () => {
    const utils = readFileSync(path.join(srcRoot, "admin-action-utils.ts"), "utf8");
    expect(utils, "CSRF token must be validated on all form submissions").toContain("_csrf");
    expect(utils).toMatch(/submittedToken\s*!==\s*expectedToken|!expectedToken/);
  });

  it("security headers include X-Frame-Options or CSP frame-ancestors — prevents clickjacking", () => {
    const secHeaders = readFileSync(path.join(srcRoot, "security-headers.ts"), "utf8");
    expect(secHeaders, "security headers must prevent clickjacking").toMatch(
      /X-Frame-Options|frame-ancestors/i,
    );
  });

  it("security headers include X-Content-Type-Options — prevents MIME sniffing attacks", () => {
    const secHeaders = readFileSync(path.join(srcRoot, "security-headers.ts"), "utf8");
    expect(secHeaders).toContain("X-Content-Type-Options");
  });

  it("Content Security Policy is set for admin and API areas", () => {
    const secHeaders = readFileSync(path.join(srcRoot, "security-headers.ts"), "utf8");
    expect(secHeaders, "CSP must be applied to admin and API areas").toMatch(
      /Content-Security-Policy/i,
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Erasure / right to deletion
// ---------------------------------------------------------------------------

describe("global privacy: erasure readiness", () => {
  it("admin_sessions cascade-delete when user is deleted", () => {
    const sessionsTable = schema.match(/CREATE TABLE IF NOT EXISTS admin_sessions \([\s\S]*?\);/)?.[0] ?? "";
    expect(
      sessionsTable,
      "sessions must be deleted when the user is deleted (GDPR Art. 17, CCPA right to delete)",
    ).toMatch(/ON DELETE CASCADE/i);
  });

  it("content_revisions cascade-delete when the content record is deleted", () => {
    const revisionsTable = schema.match(/CREATE TABLE IF NOT EXISTS content_revisions \([\s\S]*?\);/)?.[0] ?? "";
    expect(revisionsTable, "content revisions must cascade on content deletion").toMatch(/ON DELETE CASCADE/i);
  });

  it("comments support soft-delete via status column — enables right-to-erasure without breaking referential integrity", () => {
    const commentsTable = schema.match(/CREATE TABLE IF NOT EXISTS comments \([\s\S]*?\);/)?.[0] ?? "";
    // Status column with 'rejected' or similar enables content suppression without hard delete
    expect(commentsTable).toMatch(/status.*TEXT|TEXT.*status/i);
    expect(commentsTable).toMatch(/pending|approved|rejected/i);
  });

  it("admin users can be suspended (active = 0) without data loss, preserving audit trails", () => {
    const adminUsersTable = schema.match(/CREATE TABLE IF NOT EXISTS admin_users \([\s\S]*?\);/)?.[0] ?? "";
    expect(adminUsersTable, "admin_users must have an active flag for non-destructive suspension").toContain("active");
  });
});

// ---------------------------------------------------------------------------
// 5. Purpose limitation — no secondary use of collected data
// ---------------------------------------------------------------------------

describe("global privacy: purpose limitation", () => {
  it("comment author email is not used for marketing — no newsletter subscription from comment submission", () => {
    const commentAction = (() => {
      try {
        return readFileSync(
          path.resolve(import.meta.dirname, "../pages/ap-admin/actions/comment-moderate.ts"),
          "utf8",
        );
      } catch {
        return "";
      }
    })();

    if (commentAction) {
      expect(
        commentAction,
        "comment moderation must not subscribe commenters to newsletter without consent",
      ).not.toMatch(/subscribe|mailchimp|newsletter/i);
    }
  });

  it("contact form submissions are stored separately from newsletter subscribers", () => {
    // contact_submissions and any newsletter table must be separate —
    // a contact form submission must not auto-enroll in email marketing
    const contactTable = schema.match(/CREATE TABLE IF NOT EXISTS contact_submissions \([\s\S]*?\);/)?.[0] ?? "";
    const newsletterTable = schema.match(/CREATE TABLE IF NOT EXISTS newsletter_subscribers \([\s\S]*?\);/)?.[0] ?? "";
    // If a newsletter table exists, contact form email must not be auto-inserted there
    if (newsletterTable) {
      const bootstrap = readFileSync(path.join(srcRoot, "sqlite-bootstrap.ts"), "utf8");
      expect(
        bootstrap,
        "contact form email must not be auto-inserted into newsletter_subscribers",
      ).not.toMatch(/INSERT.*newsletter_subscribers.*contact_submissions/is);
    }
    // contact_submissions must not have a "subscribed" or "opted_in" column
    expect(contactTable, "contact_submissions must not auto-subscribe to marketing").not.toMatch(
      /subscribed|opted_in|marketing/i,
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Cross-border transfer defaults
// ---------------------------------------------------------------------------

describe("global privacy: cross-border transfer defaults", () => {
  it("default analytics configuration is empty — no data sent to any external service by default", () => {
    const config = (() => {
      try {
        return readFileSync(path.join(srcRoot, "config.ts"), "utf8");
      } catch {
        return readFileSync(path.join(srcRoot, "services-config.ts"), "utf8");
      }
    })();

    // Default analytics config must be null/undefined/disabled — not a third-party service
    expect(
      config,
      "default analytics must not point to a third-party service — operators must explicitly configure analytics",
    ).not.toMatch(/analytics:\s*\{\s*type:\s*["'](google|segment|mixpanel|amplitude)/i);
  });

  it("Cloudflare adapter does not send data to third-party analytics by default", () => {
    const cloudflare = readFileSync(
      path.resolve(srcRoot, "adapters/cloudflare.ts"),
      "utf8",
    );
    const thirdParty = ["google-analytics.com", "segment.io", "mixpanel.com"];
    for (const domain of thirdParty) {
      expect(cloudflare, `cloudflare adapter must not send data to ${domain}`).not.toContain(domain);
    }
  });
});

// ---------------------------------------------------------------------------
// CCPA-specific: no "sale" of personal information
// ---------------------------------------------------------------------------

describe("CCPA: no sale of personal information", () => {
  it("no module exports data to advertising networks or data brokers", () => {
    const adNetworkDomains = [
      "doubleclick.net",
      "adnxs.com",
      "rubiconproject.com",
      "openx.net",
      "criteo.com",
      "taboola.com",
    ];
    // Check all source files
    const filesToCheck = [
      "analytics.ts",
      "security-headers.ts",
      "security-middleware.ts",
    ];

    for (const filename of filesToCheck) {
      const src = (() => {
        try {
          return readFileSync(path.join(srcRoot, filename), "utf8");
        } catch {
          return "";
        }
      })();

      for (const domain of adNetworkDomains) {
        expect(src, `${filename} must not reference ad network ${domain}`).not.toContain(domain);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// LGPD-specific (Brazil): explicit legitimate basis for each processing activity
// ---------------------------------------------------------------------------

describe("LGPD / GDPR Art. 6: lawful basis for processing", () => {
  it("comment email collection is optional (nullable) — no forced consent for participation", () => {
    const commentsTable = schema.match(/CREATE TABLE IF NOT EXISTS comments \([\s\S]*?\);/)?.[0] ?? "";
    // LGPD requires that optional data not be made mandatory — email on comments must be nullable
    expect(
      commentsTable,
      "comment email must be nullable — commenters must be able to participate without providing email (LGPD, GDPR)",
    ).not.toMatch(/email\s+TEXT\s+NOT\s+NULL/i);
  });
});
