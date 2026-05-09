import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import * as adminStoreDispatch from "../src/admin-store-dispatch";
import { _resetRegistryForTests, registerProvider } from "../src/integrations/registry";
import {
	connectIntegrationAction,
	disconnectIntegrationAction,
	reverifyIntegrationAction,
} from "../src/runtime-actions-integrations";

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

function withD1Fallback() {
	// Stub the dispatch helper to take the D1 branch — the action
	// passes a typed-error fallback as onD1; assert it's invoked and
	// its return value is propagated.
	vi.spyOn(adminStoreDispatch, "withLocalStoreFallback").mockImplementation(
		async (_locals, onD1, _onLocal) => onD1({} as never),
	);
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

	it("returns INTEGRATIONS_NOT_AVAILABLE on the D1 path (no local store)", async () => {
		withD1Fallback();
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

	it("returns INTEGRATIONS_NOT_AVAILABLE on the D1 path (no local store)", async () => {
		withD1Fallback();
		const r = await reverifyIntegrationAction(null, "newsletter", "fake-listmonk", { apiKey: "k" });
		expect(r).toEqual({
			ok: false,
			status: "error",
			code: "INTEGRATIONS_NOT_AVAILABLE",
		});
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

	it("returns INTEGRATIONS_NOT_AVAILABLE on the D1 path (no local store)", async () => {
		withD1Fallback();
		const r = await disconnectIntegrationAction(null, "newsletter", "fake-listmonk");
		expect(r).toEqual({ ok: false, code: "INTEGRATIONS_NOT_AVAILABLE" });
	});

	it("calls repo.disconnect with the (domain, providerId) pair", async () => {
		const repo = makeRepo();
		withRepo(repo);
		const r = await disconnectIntegrationAction(null, "newsletter", "fake-listmonk");
		expect(r).toEqual({ ok: true });
		expect(repo.disconnect).toHaveBeenCalledWith("newsletter", "fake-listmonk");
	});
});
