import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import {
	type IntegrationsRepository,
	createIntegrationsRepository,
} from "../src/sqlite-runtime/integrations";
import { makeDb } from "./helpers/make-db.js";

const ROOT = "test-root-current";
const PREV = "test-root-previous";
const NOW = "2026-05-02T12:00:00.000Z";

let db: DatabaseSync;
let repo: IntegrationsRepository;

beforeEach(() => {
	db = makeDb();
	db.exec("PRAGMA foreign_keys = ON");
	repo = createIntegrationsRepository({
		getDb: () => db as never,
		now: () => NOW,
	});
});

describe("createIntegrationsRepository — status surface", () => {
	it("returns undefined for an unknown integration", () => {
		expect(repo.findStatus("newsletter", "listmonk")).toBeUndefined();
		expect(repo.listStatuses()).toEqual([]);
	});

	it("connect() persists status and a sealed secret", async () => {
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
		const status = repo.findStatus("newsletter", "listmonk");
		expect(status).toMatchObject({
			domain: "newsletter",
			provider: "listmonk",
			status: "connected",
			configJson: '{"baseUrl":"https://example.test"}',
			connectedAt: NOW,
			lastCheckAt: null,
			lastError: null,
		});
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
		const statuses = repo.listStatuses();
		// No status row should expose anything resembling a secret column.
		for (const row of statuses) {
			const json = JSON.stringify(row);
			expect(json).not.toContain("lm-key-LEAKED-via-list");
			expect(json).not.toMatch(/ciphertext|dek_wrap|wrap_/);
		}
	});

	it("updateStatus() flips state and records error code", async () => {
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
		const updated = repo.updateStatus({
			domain: "newsletter",
			provider: "listmonk",
			status: "error",
			lastCheckAt: "2026-05-02T13:00:00.000Z",
			lastError: "INTEGRATION_VERIFY_FAILED",
		});
		expect(updated).toBe(true);
		const status = repo.findStatus("newsletter", "listmonk");
		expect(status?.status).toBe("error");
		expect(status?.lastError).toBe("INTEGRATION_VERIFY_FAILED");
	});

	it("disconnect() removes status and cascades to secret row", async () => {
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
		expect(repo.disconnect("newsletter", "listmonk")).toBe(true);
		expect(repo.findStatus("newsletter", "listmonk")).toBeUndefined();
		const remaining = db
			.prepare("SELECT count(*) AS n FROM integration_secrets")
			.get() as { n: number };
		expect(remaining.n).toBe(0);
	});

	it("disconnect() returns false on missing rows", () => {
		expect(repo.disconnect("nope", "nope")).toBe(false);
	});
});

describe("createIntegrationsRepository — secret surface", () => {
	it("findSecret() returns plaintext fields after connect", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "lm-key-X", baseUrl: "https://x.test" },
				now: NOW,
			},
			ROOT,
		);
		const fields = await repo.findSecret("newsletter", "listmonk", {
			current: ROOT,
		});
		expect(fields).toEqual({ apiKey: "lm-key-X", baseUrl: "https://x.test" });
	});

	it("findSecret() throws when no key in either slot matches", async () => {
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
		await expect(
			repo.findSecret("newsletter", "listmonk", { current: "wrong" }),
		).rejects.toThrow();
	});

	it("findSecret() returns undefined for unknown integration", async () => {
		expect(
			await repo.findSecret("newsletter", "missing", { current: ROOT }),
		).toBeUndefined();
	});

	it("two-key rotation: previous-key seal opens and reseals under current", async () => {
		// Simulate a row sealed under PREV by direct insert with kid=previous.
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "rotation-canary" },
				now: NOW,
			},
			PREV,
		);
		// Mark the existing row as previous-rooted (this is what the rotation
		// script targets: rows whose KEK derives from the old rootSecret).
		db.prepare(
			"UPDATE integration_secrets SET kid='previous' WHERE domain=? AND provider=?",
		).run("newsletter", "listmonk");

		const before = db
			.prepare("SELECT kid, ciphertext FROM integration_secrets")
			.get() as { kid: string; ciphertext: string };
		expect(before.kid).toBe("previous");

		const fields = await repo.findSecret<{ apiKey: string }>(
			"newsletter",
			"listmonk",
			{ current: ROOT, previous: PREV },
		);
		expect(fields?.apiKey).toBe("rotation-canary");

		const after = db
			.prepare("SELECT kid, ciphertext FROM integration_secrets")
			.get() as { kid: string; ciphertext: string };
		expect(after.kid).toBe("current");
		expect(after.ciphertext).not.toBe(before.ciphertext);
	});

	it("guarded reseal is a no-op if a concurrent reseal raced ahead", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "race-canary" },
				now: NOW,
			},
			PREV,
		);
		db.prepare(
			"UPDATE integration_secrets SET kid='previous' WHERE domain=? AND provider=?",
		).run("newsletter", "listmonk");

		// Snapshot the row, then simulate a concurrent admin write that
		// already rotated the record forward by manually rewriting under
		// the current key.
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "race-canary" },
				now: NOW,
			},
			ROOT,
		);
		const racedAhead = db
			.prepare("SELECT kid, ciphertext FROM integration_secrets")
			.get() as { kid: string; ciphertext: string };
		expect(racedAhead.kid).toBe("current");

		// Now a stale read decides to reseal — but our guard refuses to
		// overwrite the racing record because ciphertext + kid differ.
		// The simplest assertion: the row stays under current key and the
		// repository still returns the right plaintext.
		const fields = await repo.findSecret<{ apiKey: string }>(
			"newsletter",
			"listmonk",
			{ current: ROOT, previous: PREV },
		);
		expect(fields?.apiKey).toBe("race-canary");
		const final = db.prepare("SELECT kid FROM integration_secrets").get() as {
			kid: string;
		};
		expect(final.kid).toBe("current");
	});

	it("listPreviousKidContexts() reports rows still on the previous key", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "k" },
				now: NOW,
			},
			PREV,
		);
		db.prepare(
			"UPDATE integration_secrets SET kid='previous' WHERE domain=? AND provider=?",
		).run("newsletter", "listmonk");

		const pending = repo.listPreviousKidContexts();
		expect(pending).toEqual([{ domain: "newsletter", provider: "listmonk" }]);

		await repo.findSecret("newsletter", "listmonk", {
			current: ROOT,
			previous: PREV,
		});
		expect(repo.listPreviousKidContexts()).toEqual([]);
	});
});

describe("createIntegrationsRepository — privacy invariants", () => {
	it("ciphertext bytes do not contain the plaintext canary", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "PLAINTEXT-CANARY-XYZ" },
				now: NOW,
			},
			ROOT,
		);
		const row = db
			.prepare(
				"SELECT ciphertext, dek_wrap FROM integration_secrets WHERE domain=? AND provider=?",
			)
			.get("newsletter", "listmonk") as {
			ciphertext: string;
			dek_wrap: string;
		};
		expect(row.ciphertext).not.toContain("PLAINTEXT-CANARY-XYZ");
		expect(row.dek_wrap).not.toContain("PLAINTEXT-CANARY-XYZ");
	});
});
