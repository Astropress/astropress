import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import * as adminStoreDispatch from "../src/admin-store-dispatch";
import { _resetRegistryForTests, registerProvider } from "../src/integrations/registry";
import {
	connectIntegrationAction,
	disconnectIntegrationAction,
	reverifyIntegrationAction,
	setActiveIntegrationProviderAction,
} from "../src/runtime-actions-integrations";
import * as runtimeEnv from "../src/runtime-env";
import { createIntegrationsRepository } from "../src/sqlite-runtime/integrations";
import { createD1IntegrationsRepository } from "../src/sqlite-runtime/integrations-d1";
import { makeDb } from "./helpers/make-db.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";

interface FakeRepo {
	connect: ReturnType<typeof vi.fn>;
	updateStatus: ReturnType<typeof vi.fn>;
	disconnect: ReturnType<typeof vi.fn>;
	findStatus: ReturnType<typeof vi.fn>;
	listStatuses: ReturnType<typeof vi.fn>;
	findSecret: ReturnType<typeof vi.fn>;
	listPreviousKidContexts: ReturnType<typeof vi.fn>;
}

function makeRepo(): FakeRepo {
	return {
		connect: vi.fn(async () => {}),
		updateStatus: vi.fn(() => true),
		disconnect: vi.fn(() => true),
		findStatus: vi.fn(),
		listStatuses: vi.fn(() => []),
		findSecret: vi.fn(),
		listPreviousKidContexts: vi.fn(() => []),
	};
}

function withRepo(repo: FakeRepo | null) {
	// Stub the dispatch helper to always run the local-store branch
	// (no D1 binding) and hand back a minimal store with the repo.
	vi.spyOn(adminStoreDispatch, "withLocalStoreFallback").mockImplementation(
		async (_locals, _onD1, onLocal) => onLocal({ integrations: repo ?? undefined } as never),
	);
}

function withD1Backed(db: DatabaseSync) {
	// Stub the dispatch helper to take the D1 branch with a real D1
	// shape (sqlite-backed) so the D1IntegrationsRepository write
	// path runs to completion end-to-end.
	const d1 = new SqliteBackedD1Database(db);
	vi.spyOn(adminStoreDispatch, "withLocalStoreFallback").mockImplementation(
		async (_locals, onD1, _onLocal) => onD1(d1 as never),
	);
	return d1;
}

const FIELDS_SCHEMA = z.object({ apiKey: z.string().min(1) });

beforeEach(() => {
	_resetRegistryForTests();
	registerProvider("newsletter", {
		id: "fake-listmonk",
		label: "Fake Listmonk",
		fields: FIELDS_SCHEMA,
	});
});

afterEach(() => {
	vi.restoreAllMocks();
	_resetRegistryForTests();
});

describe("connectIntegrationAction", () => {
	it("returns INTEGRATION_PROVIDER_NOT_FOUND when the provider is not registered", async () => {
		const r = await connectIntegrationAction(null, {
			domain: "newsletter",
			providerId: "missing",
			fields: { apiKey: "k" },
		});
		expect(r).toEqual({
			ok: false,
			status: "error",
			code: "INTEGRATION_PROVIDER_NOT_FOUND",
		});
	});

	it("returns INTEGRATIONS_NOT_AVAILABLE when the local admin store has no integrations repo", async () => {
		withRepo(null);
		const r = await connectIntegrationAction(null, {
			domain: "newsletter",
			providerId: "fake-listmonk",
			fields: { apiKey: "k" },
		});
		expect(r).toEqual({
			ok: false,
			status: "error",
			code: "INTEGRATIONS_NOT_AVAILABLE",
		});
	});

	it("D1 path: connect writes the status + sealed-secret rows atomically via batch", async () => {
		const db = makeDb();
		withD1Backed(db);
		const r = await connectIntegrationAction(null, {
			domain: "newsletter",
			providerId: "fake-listmonk",
			fields: { apiKey: "k-d1-canary" },
		});
		expect(r.ok).toBe(true);
		// Read back via the sqlite repo (same underlying tables).
		const repo = createIntegrationsRepository({
			getDb: () => db as never,
			now: () => "2026-05-18T00:00:00Z",
		});
		expect(repo.findStatus("newsletter", "fake-listmonk")?.status).toBe("connected");
	});

	it("calls repo.connect with the validated fields when the provider exists and the repo is available", async () => {
		const repo = makeRepo();
		withRepo(repo);
		const r = await connectIntegrationAction(null, {
			domain: "newsletter",
			providerId: "fake-listmonk",
			fields: { apiKey: "k" },
		});
		expect(r.ok).toBe(true);
		expect(repo.connect).toHaveBeenCalledOnce();
		const [callArgs] = repo.connect.mock.calls[0];
		expect(callArgs.secretFields).toEqual({ apiKey: "k" });
		expect(callArgs.domain).toBe("newsletter");
		expect(callArgs.provider).toBe("fake-listmonk");
	});

	it("returns ROOT_SECRET_UNCONFIGURED when the root-secret resolver fails closed (#126)", async () => {
		// getAstropressRootSecret throws in production with no configured secret;
		// connect must surface a typed error before sealing any credential.
		const spy = vi.spyOn(runtimeEnv, "getAstropressRootSecret").mockImplementation(() => {
			throw new Error("ASTROPRESS_ROOT_SECRET must be configured in production");
		});
		const repo = makeRepo();
		withRepo(repo);
		const r = await connectIntegrationAction(null, {
			domain: "newsletter",
			providerId: "fake-listmonk",
			fields: { apiKey: "k" },
		});
		expect(r).toEqual({ ok: false, status: "error", code: "ROOT_SECRET_UNCONFIGURED" });
		expect(repo.connect).not.toHaveBeenCalled();
		spy.mockRestore();
	});
});

describe("reverifyIntegrationAction", () => {
	it("returns INTEGRATION_PROVIDER_NOT_FOUND when the provider is not registered", async () => {
		const r = await reverifyIntegrationAction(null, "newsletter", "missing", {
			apiKey: "k",
		});
		expect(r).toEqual({
			ok: false,
			status: "error",
			code: "INTEGRATION_PROVIDER_NOT_FOUND",
		});
	});

	it("returns INTEGRATIONS_NOT_AVAILABLE when the repo is missing", async () => {
		withRepo(null);
		const r = await reverifyIntegrationAction(null, "newsletter", "fake-listmonk", { apiKey: "k" });
		expect(r).toEqual({
			ok: false,
			status: "error",
			code: "INTEGRATIONS_NOT_AVAILABLE",
		});
	});

	it("D1 path: reverify awaits the async updateStatus write (no fire-and-forget)", async () => {
		const db = makeDb();
		withD1Backed(db);
		// Seed an existing 'connected' row that reverify will flip.
		db.prepare(
			"INSERT INTO connected_integrations (domain, provider, status, config_json, connected_at, last_check_at, last_error) VALUES (?, ?, 'connected', '{}', '2026-01-01', NULL, NULL)",
		).run("newsletter", "fake-listmonk");
		const r = await reverifyIntegrationAction(null, "newsletter", "fake-listmonk", {
			apiKey: "k-canary",
		});
		expect(r.ok).toBe(true);
		const row = db
			.prepare(
				"SELECT status, last_check_at FROM connected_integrations WHERE domain=? AND provider=?",
			)
			.get("newsletter", "fake-listmonk") as { status: string; last_check_at: string | null };
		expect(row.status).toBe("connected");
		expect(row.last_check_at).not.toBeNull(); // proves updateStatus ran
	});

	it("calls repo.updateStatus with status='connected' when verify passes (no provider.verify => trivially ok)", async () => {
		const repo = makeRepo();
		withRepo(repo);
		const r = await reverifyIntegrationAction(null, "newsletter", "fake-listmonk", { apiKey: "k" });
		expect(r.ok).toBe(true);
		expect(repo.updateStatus).toHaveBeenCalledOnce();
		const [updateArgs] = repo.updateStatus.mock.calls[0];
		expect(updateArgs.status).toBe("connected");
	});
});

describe("disconnectIntegrationAction", () => {
	it("returns INTEGRATIONS_NOT_AVAILABLE when the repo is missing", async () => {
		withRepo(null);
		const r = await disconnectIntegrationAction(null, "newsletter", "fake-listmonk");
		expect(r).toEqual({
			ok: false,
			code: "INTEGRATIONS_NOT_AVAILABLE",
		});
	});

	it("D1 path: disconnect deletes the row (awaiting the async repo call)", async () => {
		const db = makeDb();
		withD1Backed(db);
		db.prepare(
			"INSERT INTO connected_integrations (domain, provider, status, config_json, connected_at, last_check_at, last_error) VALUES (?, ?, 'connected', '{}', '2026-01-01', NULL, NULL)",
		).run("newsletter", "fake-listmonk");
		const r = await disconnectIntegrationAction(null, "newsletter", "fake-listmonk");
		expect(r).toEqual({ ok: true });
		const remaining = db
			.prepare("SELECT COUNT(*) AS n FROM connected_integrations WHERE domain=? AND provider=?")
			.get("newsletter", "fake-listmonk") as { n: number };
		expect(remaining.n).toBe(0);
	});

	it("calls repo.disconnect with the (domain, providerId) pair", async () => {
		const repo = makeRepo();
		withRepo(repo);
		const r = await disconnectIntegrationAction(null, "newsletter", "fake-listmonk");
		expect(r).toEqual({ ok: true });
		expect(repo.disconnect).toHaveBeenCalledWith("newsletter", "fake-listmonk");
	});
});

describe("setActiveIntegrationProviderAction (#127)", () => {
	const NOW = "2026-05-02T12:00:00.000Z";

	it("returns INTEGRATIONS_NOT_AVAILABLE when the local store has no integrations repo", async () => {
		withRepo(null);
		const r = await setActiveIntegrationProviderAction(null, "newsletter", "fake-listmonk");
		expect(r).toEqual({ ok: false, code: "INTEGRATIONS_NOT_AVAILABLE" });
	});

	it("local path: returns ok when the repo confirms the switch", async () => {
		const setActiveProvider = vi.fn(() => true);
		withRepo({ ...makeRepo(), setActiveProvider } as never);
		const r = await setActiveIntegrationProviderAction(null, "newsletter", "fake-listmonk");
		expect(r).toEqual({ ok: true });
		expect(setActiveProvider).toHaveBeenCalledWith("newsletter", "fake-listmonk");
	});

	it("local path: returns INTEGRATION_NOT_CONNECTED when the repo refuses the switch", async () => {
		withRepo({ ...makeRepo(), setActiveProvider: vi.fn(() => false) } as never);
		const r = await setActiveIntegrationProviderAction(null, "newsletter", "ghost");
		expect(r).toEqual({ ok: false, code: "INTEGRATION_NOT_CONNECTED" });
	});

	it("D1 path: activates a connected provider end-to-end", async () => {
		const db = makeDb();
		const d1 = withD1Backed(db);
		const repo = createD1IntegrationsRepository({ getDb: () => d1, now: () => NOW });
		await repo.connect(
			{
				domain: "newsletter",
				provider: "fake-listmonk",
				configJson: "{}",
				secretFields: { apiKey: "k" },
				now: NOW,
			},
			"root-secret",
		);
		const r = await setActiveIntegrationProviderAction(null, "newsletter", "fake-listmonk");
		expect(r).toEqual({ ok: true });
	});

	it("D1 path: returns INTEGRATION_NOT_CONNECTED for a provider with no connected row", async () => {
		const db = makeDb();
		withD1Backed(db);
		const r = await setActiveIntegrationProviderAction(null, "newsletter", "ghost");
		expect(r).toEqual({ ok: false, code: "INTEGRATION_NOT_CONNECTED" });
	});
});
