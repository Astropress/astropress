/**
 * Mirror of `integrations-repository.test.ts` for the D1 repository.
 *
 * Every test that the sqlite repo's suite carries has a parity test
 * here so a future refactor of either implementation surfaces drift
 * (e.g. reseal-on-read predicate flip, ON CONFLICT shape regression,
 * column-order shuffle). The audit at
 * `tooling/scripts/audit-integration-secrets-schema-parity.ts`
 * enforces the SQL-body parity statically; this file enforces
 * behavioural parity at runtime.
 *
 * Backing store: `SqliteBackedD1Database` (the same fixture used by
 * the rest of the D1-shape suite). It implements the D1 SDK surface
 * on top of `node:sqlite`, so we're exercising the same SQL grammar
 * Cloudflare's D1 ships with for the tested operations.
 */

import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { sealIntegrationSecret } from "../src/integration-secret-envelope";
import {
	createD1IntegrationsRepository,
	type D1IntegrationsRepository,
} from "../src/sqlite-runtime/integrations-d1";
import { makeDb } from "./helpers/make-db.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";

const ROOT = "test-root-current";
const PREV = "test-root-previous";
const NOW = "2026-05-02T12:00:00.000Z";

let db: DatabaseSync;
let d1: SqliteBackedD1Database;
let repo: D1IntegrationsRepository;

beforeEach(() => {
	db = makeDb();
	db.exec("PRAGMA foreign_keys = ON");
	d1 = new SqliteBackedD1Database(db);
	repo = createD1IntegrationsRepository({
		getDb: () => d1,
		now: () => NOW,
	});
});

describe("createD1IntegrationsRepository — status surface", () => {
	it("returns undefined for an unknown integration", async () => {
		expect(await repo.findStatus("newsletter", "listmonk")).toBeUndefined();
		expect(await repo.listStatuses()).toEqual([]);
	});

	it("connect() persists status and a sealed secret atomically via batch", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: '{"baseUrl":"https://example.test"}',
				secretFields: { apiKey: "lm-key-CANARY-status" },
				now: NOW,
			},
			ROOT,
		);
		const status = await repo.findStatus("newsletter", "listmonk");
		expect(status).toMatchObject({
			domain: "newsletter",
			provider: "listmonk",
			status: "connected",
			configJson: '{"baseUrl":"https://example.test"}',
			connectedAt: NOW,
			lastCheckAt: null,
			lastError: null,
		});
		// Both rows must be present — the atomic-batch invariant.
		const secretRow = db
			.prepare("SELECT COUNT(*) AS n FROM integration_secrets WHERE domain=? AND provider=?")
			.get("newsletter", "listmonk") as { n: number };
		expect(secretRow.n).toBe(1);
	});

	it("listStatuses() never reads secret columns (no plaintext leak path)", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "lm-key-LEAKED-via-list" },
				now: NOW,
			},
			ROOT,
		);
		const statuses = await repo.listStatuses();
		for (const row of statuses) {
			const json = JSON.stringify(row);
			expect(json).not.toContain("lm-key-LEAKED-via-list");
			expect(json).not.toMatch(/ciphertext|dek_wrap|wrap_/);
		}
	});

	it("listStatuses() returns rows ordered by (domain, provider) ascending", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "k1" },
				now: NOW,
			},
			ROOT,
		);
		await repo.connect(
			{
				domain: "analytics",
				provider: "plausible",
				configJson: "{}",
				secretFields: { apiKey: "k2" },
				now: NOW,
			},
			ROOT,
		);
		const ordered = (await repo.listStatuses()).map((r) => `${r.domain}/${r.provider}`);
		expect(ordered).toEqual(["analytics/plausible", "newsletter/listmonk"]);
	});

	it("updateStatus()/disconnect() tolerate a D1 result without `meta` (defensive `?.` branch)", async () => {
		// Cloudflare's D1 SDK occasionally returns 0-row results
		// without a `meta` field. Build a minimal D1 mock that omits
		// it and confirm both methods still return false rather than
		// throwing (the `result.meta?.changes ?? 0` fallback).
		const mockNoMetaDb = {
			prepare: () => ({
				bind: () => ({
					first: async () => null,
					all: async () => ({ success: true, results: [] }),
					run: async () => ({ success: true, results: [] /* no `meta` */ }),
				}),
			}),
			batch: async () => [],
		};
		const mockRepo = createD1IntegrationsRepository({
			getDb: () => mockNoMetaDb as never,
			now: NOW,
		});
		expect(
			await mockRepo.updateStatus({
				domain: "newsletter",
				provider: "listmonk",
				status: "connected",
				lastCheckAt: NOW,
			}),
		).toBe(false);
		expect(await mockRepo.disconnect("newsletter", "listmonk")).toBe(false);
	});

	it("updateStatus() with no lastError supplied stores NULL (covers the `?? null` default branch)", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "k" },
				now: NOW,
			},
			ROOT,
		);
		const ok = await repo.updateStatus({
			domain: "newsletter",
			provider: "listmonk",
			status: "connected",
			lastCheckAt: "2026-05-02T13:00:00Z",
			// lastError omitted on purpose — exercises the `?? null` fallback
		});
		expect(ok).toBe(true);
		const row = db
			.prepare("SELECT last_error FROM connected_integrations WHERE domain=? AND provider=?")
			.get("newsletter", "listmonk") as { last_error: string | null };
		expect(row.last_error).toBeNull();
	});

	it("updateStatus() flips state and returns true; missing row returns false", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "k" },
				now: NOW,
			},
			ROOT,
		);
		const ok = await repo.updateStatus({
			domain: "newsletter",
			provider: "listmonk",
			status: "error",
			lastCheckAt: "2026-05-02T12:30:00Z",
			lastError: "INTEGRATION_VERIFY_FAILED",
		});
		expect(ok).toBe(true);
		expect((await repo.findStatus("newsletter", "listmonk"))?.status).toBe("error");

		const missing = await repo.updateStatus({
			domain: "newsletter",
			provider: "ghost",
			status: "error",
			lastCheckAt: NOW,
		});
		expect(missing).toBe(false);
	});

	it("disconnect() removes the row and returns true; absent row returns false", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "k" },
				now: NOW,
			},
			ROOT,
		);
		expect(await repo.disconnect("newsletter", "listmonk")).toBe(true);
		expect(await repo.findStatus("newsletter", "listmonk")).toBeUndefined();
		expect(await repo.disconnect("nope", "nope")).toBe(false);
	});
});

describe("createD1IntegrationsRepository — secret surface", () => {
	it("findSecret() roundtrips the exact secret field set", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "lm-key-roundtrip", listId: "42" },
				now: NOW,
			},
			ROOT,
		);
		const opened = await repo.findSecret<Record<string, string>>("newsletter", "listmonk", {
			current: ROOT,
		});
		expect(opened).toEqual({ apiKey: "lm-key-roundtrip", listId: "42" });
	});

	it("findSecret() returns undefined for an unknown integration", async () => {
		const opened = await repo.findSecret("newsletter", "ghost", { current: ROOT });
		expect(opened).toBeUndefined();
	});

	it("accepts a literal-string `now` option (used by short-lived action handlers)", async () => {
		// The factory accepts `now: string | (() => string)`. Action
		// handlers (connect/reverify/disconnect) pass a single ISO
		// string they computed up front; long-lived hosts pass a
		// callable so reseal-on-read uses a fresh timestamp per call.
		// Both forms must reach the same reseal-rotated_at column.
		const FIXED_NOW = "2030-06-15T08:00:00.000Z";
		const stringNowRepo = createD1IntegrationsRepository({ getDb: () => d1, now: FIXED_NOW });
		const sealed = await sealIntegrationSecret(
			{ apiKey: "string-now-canary" },
			{ domain: "newsletter", provider: "listmonk" },
			PREV,
		);
		db.prepare(
			"INSERT INTO connected_integrations (domain, provider, status, config_json, connected_at, last_check_at, last_error) VALUES (?, ?, 'connected', '{}', ?, NULL, NULL)",
		).run("newsletter", "listmonk", NOW);
		db.prepare(
			"INSERT INTO integration_secrets (domain, provider, envelope_v, kid, wrap_salt, wrap_iv, dek_wrap, data_iv, ciphertext, rotated_at) VALUES (?, ?, ?, 'previous', ?, ?, ?, ?, ?, ?)",
		).run(
			"newsletter",
			"listmonk",
			sealed.v,
			sealed.wrap_salt,
			sealed.wrap_iv,
			sealed.dek_wrap,
			sealed.data_iv,
			sealed.ciphertext,
			NOW,
		);
		await stringNowRepo.findSecret("newsletter", "listmonk", {
			current: ROOT,
			previous: PREV,
		});
		const row = db
			.prepare("SELECT rotated_at FROM integration_secrets WHERE domain=? AND provider=?")
			.get("newsletter", "listmonk") as { rotated_at: string };
		// Reseal-on-read must have stamped rotated_at with the literal
		// string, proving the string-path of the `now` resolution was
		// taken and its callable wrapper was invoked.
		expect(row.rotated_at).toBe(FIXED_NOW);
	});

	it("two-key rotation: previous-key seal opens and reseals under current", async () => {
		// Seal directly with PREV, then flip kid='previous' so the
		// reseal predicate fires.
		const sealed = await sealIntegrationSecret(
			{ apiKey: "rotation-canary" },
			{ domain: "newsletter", provider: "listmonk" },
			PREV,
		);
		db.prepare(
			"INSERT INTO connected_integrations (domain, provider, status, config_json, connected_at, last_check_at, last_error) VALUES (?, ?, 'connected', '{}', ?, NULL, NULL)",
		).run("newsletter", "listmonk", NOW);
		db.prepare(
			"INSERT INTO integration_secrets (domain, provider, envelope_v, kid, wrap_salt, wrap_iv, dek_wrap, data_iv, ciphertext, rotated_at) VALUES (?, ?, ?, 'previous', ?, ?, ?, ?, ?, ?)",
		).run(
			"newsletter",
			"listmonk",
			sealed.v,
			sealed.wrap_salt,
			sealed.wrap_iv,
			sealed.dek_wrap,
			sealed.data_iv,
			sealed.ciphertext,
			NOW,
		);
		const before = db
			.prepare("SELECT kid FROM integration_secrets WHERE domain=? AND provider=?")
			.get("newsletter", "listmonk") as { kid: string };
		expect(before.kid).toBe("previous");

		const opened = await repo.findSecret<{ apiKey: string }>("newsletter", "listmonk", {
			current: ROOT,
			previous: PREV,
		});
		expect(opened?.apiKey).toBe("rotation-canary");
		const after = db
			.prepare("SELECT kid FROM integration_secrets WHERE domain=? AND provider=?")
			.get("newsletter", "listmonk") as { kid: string };
		expect(after.kid).toBe("current");
	});

	it("does NOT reseal when current-key reads succeed even with previous supplied", async () => {
		// Guards the reseal predicate
		//   `usedKid === "previous" && rootSecrets.previous`
		// — both halves matter, and the mutation-gate proves it.
		// Mutating `&&` to `||` would make this case reseal (current
		// open + previous supplied → false && truthy → false, vs
		// false || truthy → truthy → reseal fires).
		//
		// We detect a stray reseal three ways: rotated_at advances,
		// ciphertext changes (every reseal generates a fresh IV), and
		// the round-trippable plaintext stays correct.
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "no-reseal-with-prev" },
				now: NOW,
			},
			ROOT,
		);
		const before = db
			.prepare(
				"SELECT rotated_at, ciphertext FROM integration_secrets WHERE domain=? AND provider=?",
			)
			.get("newsletter", "listmonk") as { rotated_at: string; ciphertext: string };

		// Use a repo whose now() is *distinct* from the connect()
		// timestamp so a stray reseal would visibly move rotated_at.
		const LATER = "2099-12-31T23:59:59.000Z";
		const laterRepo = createD1IntegrationsRepository({
			getDb: () => d1,
			now: () => LATER,
		});
		const opened = await laterRepo.findSecret<{ apiKey: string }>("newsletter", "listmonk", {
			current: ROOT,
			previous: PREV,
		});
		expect(opened?.apiKey).toBe("no-reseal-with-prev");

		const after = db
			.prepare(
				"SELECT rotated_at, ciphertext FROM integration_secrets WHERE domain=? AND provider=?",
			)
			.get("newsletter", "listmonk") as { rotated_at: string; ciphertext: string };
		expect(after.rotated_at).toBe(before.rotated_at);
		expect(after.ciphertext).toBe(before.ciphertext);
		expect(after.rotated_at).not.toBe(LATER); // belt-and-braces against a same-second flake
	});

	it("reseal predicate: usedKid='previous' but rootSecrets.previous absent → no reseal", async () => {
		// Pin the second half of the && — even with kid='previous', if
		// the caller didn't supply a previous candidate (e.g. emergency
		// rotation removed the old key), the guarded UPDATE must not
		// fire. Only the current-key open path remains.
		const sealedUnderRoot = await sealIntegrationSecret(
			{ apiKey: "previous-kid-no-prev-candidate" },
			{ domain: "newsletter", provider: "listmonk" },
			ROOT,
		);
		db.prepare(
			"INSERT INTO connected_integrations (domain, provider, status, config_json, connected_at, last_check_at, last_error) VALUES (?, ?, 'connected', '{}', ?, NULL, NULL)",
		).run("newsletter", "listmonk", NOW);
		db.prepare(
			"INSERT INTO integration_secrets (domain, provider, envelope_v, kid, wrap_salt, wrap_iv, dek_wrap, data_iv, ciphertext, rotated_at) VALUES (?, ?, ?, 'previous', ?, ?, ?, ?, ?, ?)",
		).run(
			"newsletter",
			"listmonk",
			sealedUnderRoot.v,
			sealedUnderRoot.wrap_salt,
			sealedUnderRoot.wrap_iv,
			sealedUnderRoot.dek_wrap,
			sealedUnderRoot.data_iv,
			sealedUnderRoot.ciphertext,
			NOW,
		);
		// rootSecrets supplies ONLY current — the open path tries current,
		// which succeeds (same key was used to seal). usedKid will be
		// "current", and even if it were "previous" the second AND
		// clause would be falsy. No reseal expected.
		const opened = await repo.findSecret<{ apiKey: string }>("newsletter", "listmonk", {
			current: ROOT,
		});
		expect(opened?.apiKey).toBe("previous-kid-no-prev-candidate");
		const after = db
			.prepare("SELECT kid FROM integration_secrets WHERE domain=? AND provider=?")
			.get("newsletter", "listmonk") as { kid: string };
		// kid was 'previous' going in; no reseal happened (no rootSecrets.previous), so it's still 'previous'.
		expect(after.kid).toBe("previous");
	});

	it("does NOT reseal when current-key reads succeed (no-op fast path)", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "no-reseal-canary" },
				now: NOW,
			},
			ROOT,
		);
		const beforeRotated = db
			.prepare("SELECT rotated_at FROM integration_secrets WHERE domain=? AND provider=?")
			.get("newsletter", "listmonk") as { rotated_at: string };
		await repo.findSecret("newsletter", "listmonk", { current: ROOT, previous: PREV });
		const afterRotated = db
			.prepare("SELECT rotated_at FROM integration_secrets WHERE domain=? AND provider=?")
			.get("newsletter", "listmonk") as { rotated_at: string };
		expect(afterRotated.rotated_at).toBe(beforeRotated.rotated_at);
	});

	it("listPreviousKidContexts() returns only kid='previous' rows", async () => {
		// Two current-kid rows + one manually-flagged previous-kid row.
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "k1" },
				now: NOW,
			},
			ROOT,
		);
		await repo.connect(
			{
				domain: "analytics",
				provider: "plausible",
				configJson: "{}",
				secretFields: { apiKey: "k2" },
				now: NOW,
			},
			ROOT,
		);
		db.prepare(
			"UPDATE integration_secrets SET kid='previous' WHERE domain='analytics' AND provider='plausible'",
		).run();
		const previous = await repo.listPreviousKidContexts();
		expect(previous).toEqual([{ domain: "analytics", provider: "plausible" }]);
	});
});

describe("createD1IntegrationsRepository — explicit active-provider selection (#127)", () => {
	async function connect(domain: string, provider: string) {
		await repo.connect(
			{ domain, provider, configJson: "{}", secretFields: { apiKey: `${provider}-key` }, now: NOW },
			ROOT,
		);
	}
	const activeOf = async (domain: string) =>
		(await repo.listStatuses())
			.filter((s) => s.domain === domain && s.isActive)
			.map((s) => s.provider);

	it("marks the first connected provider in a domain active automatically", async () => {
		await connect("newsletter", "listmonk");
		expect(await activeOf("newsletter")).toEqual(["listmonk"]);
		// isActive maps from is_active === 1, not the row's mere presence.
		const status = await repo.findStatus("newsletter", "listmonk");
		expect(status?.isActive).toBe(true);
	});

	it("does NOT steal the active selection when a second provider connects", async () => {
		await connect("newsletter", "listmonk");
		await connect("newsletter", "mailchimp");
		// First stays active; the late arrival is connected-but-inactive.
		expect(await activeOf("newsletter")).toEqual(["listmonk"]);
		expect((await repo.findStatus("newsletter", "mailchimp"))?.isActive).toBe(false);
	});

	it("setActiveProvider switches the active row and returns true", async () => {
		await connect("newsletter", "listmonk");
		await connect("newsletter", "mailchimp");
		expect(await repo.setActiveProvider("newsletter", "mailchimp")).toBe(true);
		expect(await activeOf("newsletter")).toEqual(["mailchimp"]);
	});

	it("setActiveProvider returns false for a provider that is not connected (no row activated)", async () => {
		await connect("newsletter", "listmonk");
		// Refuses the switch (the target isn't connected, so MARK_ACTIVE changes
		// no rows → false). It never activates the bogus provider.
		expect(await repo.setActiveProvider("newsletter", "ghost")).toBe(false);
		expect(await activeOf("newsletter")).not.toContain("ghost");
	});

	it("scopes active selection per domain — a second domain's first provider is independently active", async () => {
		await connect("newsletter", "listmonk");
		await connect("analytics", "plausible");
		expect(await activeOf("newsletter")).toEqual(["listmonk"]);
		expect(await activeOf("analytics")).toEqual(["plausible"]);
	});
});
