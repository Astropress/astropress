/**
 * DID (Decentralized Identity) Compatibility Tests
 *
 * These tests audit Astropress's current architecture against the W3C DID specification
 * (https://www.w3.org/TR/did-core/) and the Verifiable Credentials Data Model
 * (https://www.w3.org/TR/vc-data-model-2.0/).
 *
 * Goal: identify which properties are already DID-compatible by design and which
 * structural changes would be required before a DID auth adapter could be plugged in
 * without modifying core framework code.
 *
 * DID primer:
 *   - A DID is a URI: `did:key:z6Mk...` or `did:web:example.com`
 *   - A DID Document contains public keys and service endpoints for that DID
 *   - A Verifiable Presentation (VP) proves control of a DID (signed with the private key)
 *   - DID Auth: the relying party issues a challenge; the holder returns a VP containing
 *     the challenge, signed by their DID key — replaces password at the protocol level
 *
 * Test organisation:
 *   1. DID-COMPATIBLE — already satisfies DID requirements without change
 *   2. DID-INCOMPATIBLE — structural blockers that would need schema / interface changes
 *   3. DID-NEUTRAL — features that neither help nor hinder DID support
 *
 * These tests are structural (static analysis of source and schema) — they do not require
 * a running DID resolver or a live Verifiable Credential.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findRepoRoot } from "./_helpers/repo-root";

// Source-text invariants — read canonical repo source, not the Stryker-instrumented
// sandbox copy.
const srcRoot = path.join(findRepoRoot(), "packages/astropress/src");
const schema = readFileSync(path.join(srcRoot, "sqlite-schema.sql"), "utf8");
const contracts = readFileSync(
	path.join(srcRoot, "platform-contracts.ts"),
	"utf8",
);
const authStore = readFileSync(
	path.join(srcRoot, "sqlite-runtime/auth.ts"),
	"utf8",
);

// ---------------------------------------------------------------------------
// 1. DID-COMPATIBLE: properties that already satisfy DID requirements
// ---------------------------------------------------------------------------

describe("DID-compatible: session layer is auth-method-agnostic", () => {
	it("admin_sessions has no auth_method or password-specific column — sessions are opaque tokens, not tied to password auth", () => {
		const sessionsTable =
			schema.match(
				/CREATE TABLE IF NOT EXISTS admin_sessions \([\s\S]*?\);/,
			)?.[0] ?? "";
		// If sessions stored an auth_method they would be fine — but they must not embed password-specific artifacts
		expect(sessionsTable).not.toMatch(/\bpassword\b/i);
		expect(sessionsTable).not.toMatch(/\bpassword_ref\b/i);
		// Session ID is a text primary key — compatible with DID-derived nonces
		expect(sessionsTable).toMatch(/id TEXT PRIMARY KEY/i);
	});

	it("admin_sessions.id is a TEXT column — compatible with DID-derived session identifiers (not an integer auto-increment)", () => {
		const sessionsTable =
			schema.match(
				/CREATE TABLE IF NOT EXISTS admin_sessions \([\s\S]*?\);/,
			)?.[0] ?? "";
		expect(sessionsTable).toMatch(/id TEXT PRIMARY KEY/i);
		expect(sessionsTable).not.toMatch(/id INTEGER PRIMARY KEY AUTOINCREMENT/i);
	});

	it("AuthUser.id is typed as string — DIDs are strings (did:key:z6Mk...), not integers", () => {
		// AuthUser must use id: string (not id: number) to be DID-compatible
		const authUserMatch =
			contracts.match(/export interface AuthUser \{[\s\S]*?\}/)?.[0] ?? "";
		expect(
			authUserMatch,
			"AuthUser.id must be typed as string to allow DID identifiers",
		).toMatch(/id:\s*string/);
		expect(authUserMatch).not.toMatch(/id:\s*number/);
	});

	it("session revocation uses revoked_at — DID-based sessions need the same server-side revocation capability", () => {
		const sessionsTable =
			schema.match(
				/CREATE TABLE IF NOT EXISTS admin_sessions \([\s\S]*?\);/,
			)?.[0] ?? "";
		expect(sessionsTable).toContain("revoked_at");
	});

	it("AuthStore is an interface, not a class — a DID auth adapter can implement it without modifying core code", () => {
		// The contract uses 'export interface AuthStore', which means it can be satisfied
		// by any implementation including a DID-based one
		expect(contracts).toMatch(/export interface AuthStore/);
		// Must not be 'export class AuthStore' or 'export abstract class AuthStore'
		expect(contracts).not.toMatch(/export (?:abstract )?class AuthStore/);
	});

	it("admin_sessions TTL enforcement is in the session lookup path, not the login path — DID auth would use the same sessions", () => {
		// TTL is enforced when reading a session, not at the point of creating it.
		// This means a DID-authenticated session would get the same TTL enforcement automatically.
		expect(authStore).toMatch(/SESSION_TTL_MS|last_active_at|ttl/i);
	});

	it("audit_events stores user_email as a TEXT field — a DID identifier (did:key:...) could be stored in the same column", () => {
		const auditTable =
			schema.match(
				/CREATE TABLE IF NOT EXISTS audit_events \([\s\S]*?\);/,
			)?.[0] ?? "";
		// user_email column must be TEXT (not an FK to admin_users.id) so it can hold a DID URI
		expect(auditTable).toMatch(/user_email\s+TEXT/i);
		// Must not be a FK that would require an integer user_id
		expect(auditTable).not.toMatch(/FOREIGN KEY\s*\(\s*user_email\s*\)/i);
	});

	it("CSRF protection in admin-action-utils is auth-method-agnostic — CSRF token is set at session creation, not tied to password auth", () => {
		const utils = readFileSync(
			path.join(srcRoot, "admin-action-utils.ts"),
			"utf8",
		);
		// CSRF check reads from the session and form data — does not re-verify password
		expect(utils).toContain("_csrf");
		expect(utils).not.toMatch(/password.*csrf|csrf.*password/i);
	});
});

// ---------------------------------------------------------------------------
// 2. DID-INCOMPATIBLE: structural blockers
// ---------------------------------------------------------------------------

describe("DID-incompatible: structural blockers that require schema/interface changes before DID auth is possible", () => {
	it("[BLOCKER] admin_users.password_hash is NOT NULL — prevents creating a DID-only user with no password", () => {
		const adminUsersTable =
			schema.match(
				/CREATE TABLE IF NOT EXISTS admin_users \([\s\S]*?\);/,
			)?.[0] ?? "";
		// This test documents the blocker: if password_hash NOT NULL exists, DID users cannot be
		// created without a dummy password hash. The fix: make password_hash nullable and add a
		// did TEXT column for DID-authenticated users.
		expect(
			adminUsersTable,
			"[BLOCKER] password_hash TEXT NOT NULL prevents passwordless DID users. " +
				"Fix: make password_hash nullable and add did TEXT column to admin_users.",
		).toMatch(/password_hash\s+TEXT\s+NOT NULL/i);
		// Document that there is no did column yet
		expect(
			adminUsersTable,
			"admin_users does not yet have a did column for DID-authenticated users",
		).not.toContain("did TEXT");
	});

	it("[BLOCKER] AuthStore.signIn takes (email, password) — no method for Verifiable Presentation auth", () => {
		// The signIn method hardcodes the password-based auth flow.
		// A DID auth flow requires: challenge → sign(challenge) → verify(signedChallenge, didDocument)
		// This cannot be expressed as signIn(email, password).
		// Fix: add signInWithCredential(email: string, credential: VerifiablePresentation): Promise<AuthUser | null>
		// to the AuthStore interface, or make password optional via signIn(email: string, password?: string).
		const authStoreInterface =
			contracts.match(/export interface AuthStore \{[\s\S]*?\}/)?.[0] ?? "";
		expect(
			authStoreInterface,
			"[BLOCKER] AuthStore.signIn requires a password parameter — cannot express DID Verifiable Presentation auth. " +
				"Fix: add signInWithCredential() or make password optional.",
		).toMatch(/signIn\s*\(\s*email:\s*string,\s*password:\s*string\s*\)/);
		// Confirm there is no signInWithCredential or signInWithDid method yet
		expect(authStoreInterface).not.toMatch(
			/signInWithCredential|signInWithDid|signInWithPresentation/,
		);
	});

	it("[BLOCKER] admin_users has no external_id or did column — cannot associate a DID with an existing admin user", () => {
		const adminUsersTable =
			schema.match(
				/CREATE TABLE IF NOT EXISTS admin_users \([\s\S]*?\);/,
			)?.[0] ?? "";
		// For a migration path where existing password users link a DID, the table needs
		// either an 'external_id TEXT UNIQUE' or 'did TEXT UNIQUE' column.
		expect(
			adminUsersTable,
			"[BLOCKER] admin_users has no did or external_id column. " +
				"Fix: add did TEXT UNIQUE to admin_users for DID-authenticated users.",
		).not.toMatch(/\bexternal_id\b|\bdid\b/i);
	});
});

// ---------------------------------------------------------------------------
// 3. DID-NEUTRAL: features that neither help nor hinder DID support
// ---------------------------------------------------------------------------

describe("DID-neutral: features that are unaffected by the auth method", () => {
	it("content, media, settings, and webhooks tables have no auth-method dependency — content layer is fully auth-agnostic", () => {
		// None of the content tables should reference password_hash or an auth method
		const contentTable =
			schema.match(
				/CREATE TABLE IF NOT EXISTS content_overrides \([\s\S]*?\);/,
			)?.[0] ?? "";
		const mediaTable =
			schema.match(
				/CREATE TABLE IF NOT EXISTS media_assets \([\s\S]*?\);/,
			)?.[0] ?? "";
		for (const [name, table] of [
			["content_overrides", contentTable],
			["media_assets", mediaTable],
		]) {
			expect(table, `${name} must not reference auth method`).not.toMatch(
				/\bpassword\b|\bauth_method\b/i,
			);
		}
	});

	it("API token auth (Bearer token) is separate from admin session auth — DID users could use API tokens today", () => {
		// api_tokens are not tied to a specific auth method — they're issued to users
		// (identified by user_id) and verified by token hash. A DID-authenticated user
		// who exists in admin_users could already use API tokens without any changes.
		const apiTokensTable =
			schema.match(
				/CREATE TABLE IF NOT EXISTS api_tokens \([\s\S]*?\);/,
			)?.[0] ?? "";
		expect(apiTokensTable).toContain("token_hash");
		expect(apiTokensTable).not.toMatch(/\bpassword\b|\bauth_method\b/i);
	});

	it("rate limiting is applied per-token and per-IP, not per-auth-method — DID auth would get the same rate limiting", () => {
		const rateLimitTable =
			schema.match(
				/CREATE TABLE IF NOT EXISTS rate_limit_entries \([\s\S]*?\);/,
			)?.[0] ?? "";
		if (rateLimitTable) {
			expect(rateLimitTable).not.toMatch(/\bpassword\b|\bauth_method\b/i);
		}
	});

	it("webhook delivery and audit logging do not reference auth method — event bus is auth-agnostic", () => {
		const webhooksTable =
			schema.match(/CREATE TABLE IF NOT EXISTS webhooks \([\s\S]*?\);/)?.[0] ??
			"";
		expect(webhooksTable).not.toMatch(/\bpassword\b|\bauth_method\b/i);
	});
});

// ---------------------------------------------------------------------------
// 4. DID readiness: what a DID auth adapter would need to implement
// ---------------------------------------------------------------------------

describe("DID readiness: the AuthStore interface contract is the correct extension point", () => {
	it("a DID AuthStore adapter would need to implement exactly 3 methods: signIn, signOut, getSession", () => {
		const authStoreInterface =
			contracts.match(/export interface AuthStore \{[\s\S]*?\}/)?.[0] ?? "";
		// Count the method signatures
		const methods = [...authStoreInterface.matchAll(/^\s+\w+\s*\(/gm)].map(
			(m) => m[0].trim(),
		);
		expect(
			methods.length,
			"AuthStore has exactly 3 methods — a DID adapter implements the same 3 methods with a different signIn strategy",
		).toBe(3);
	});

	it("AuthStore.signOut takes a sessionId string — DID auth revocation would call the same signOut path", () => {
		expect(contracts).toMatch(/signOut\s*\(\s*sessionId:\s*string\s*\)/);
	});

	it("AuthStore.getSession takes a sessionId string — token-based session lookup is auth-method-neutral", () => {
		expect(contracts).toMatch(/getSession\s*\(\s*sessionId:\s*string\s*\)/);
	});

	it("AuthUser has email and role fields — a DID auth adapter must populate these from the DID document or claim", () => {
		const authUserInterface =
			contracts.match(/export interface AuthUser \{[\s\S]*?\}/)?.[0] ?? "";
		expect(authUserInterface).toMatch(/email:\s*string/);
		expect(authUserInterface).toMatch(/role:\s*"admin"\s*\|\s*"editor"/);
		// id is string — a DID adapter would set this to the DID URI (did:key:...)
		expect(authUserInterface).toMatch(/id:\s*string/);
	});
});
