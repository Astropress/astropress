import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
	connectIntegration,
	reverifyIntegration,
	runProviderVerify,
} from "../../src/integrations/connect-flow";
import {
	type RegisteredProvider,
	_resetRegistryForTests,
	registerProvider,
} from "../../src/integrations/registry";
import {
	type IntegrationsRepository,
	createIntegrationsRepository,
} from "../../src/sqlite-runtime/integrations";
import { makeDb } from "../helpers/make-db.js";

const ROOT = "test-root-current";
const NOW = "2026-05-02T12:00:00.000Z";

let db: DatabaseSync;
let repo: IntegrationsRepository;

const fields = z.object({ apiKey: z.string().min(1) });

function makeProvider(opts: {
	verify?: (
		fields: { apiKey: string },
		ctx: { signal: AbortSignal },
	) => Promise<void>;
	defaultErrorCode?: "INTEGRATION_AUTH_REJECTED" | "INTEGRATION_VERIFY_FAILED";
}): RegisteredProvider<{ apiKey: string }> {
	_resetRegistryForTests();
	return registerProvider("newsletter", {
		id: "test",
		label: "Test",
		fields,
		verify: opts.verify,
		defaultErrorCode: opts.defaultErrorCode,
	});
}

beforeEach(() => {
	db = makeDb();
	db.exec("PRAGMA foreign_keys = ON");
	repo = createIntegrationsRepository({
		getDb: () => db as never,
		now: () => NOW,
	});
});

afterEach(() => {
	_resetRegistryForTests();
});

describe("runProviderVerify", () => {
	it("returns ok=true when no verify callback is registered", async () => {
		const provider = makeProvider({ verify: undefined });
		const result = await runProviderVerify(provider, { apiKey: "k" });
		expect(result.ok).toBe(true);
	});

	it("returns ok=true on a successful verify", async () => {
		const provider = makeProvider({ verify: async () => {} });
		const result = await runProviderVerify(provider, { apiKey: "k" });
		expect(result.ok).toBe(true);
	});

	it("maps a thrown Error to INTEGRATION_VERIFY_FAILED", async () => {
		const provider = makeProvider({
			verify: async () => {
				throw new Error("upstream-401");
			},
		});
		const result = await runProviderVerify(provider, { apiKey: "k" });
		expect(result).toEqual({ ok: false, code: "INTEGRATION_VERIFY_FAILED" });
	});

	it("maps a thrown AbortError to INTEGRATION_TIMEOUT", async () => {
		const provider = makeProvider({
			verify: async () => {
				const e = new Error("aborted");
				e.name = "AbortError";
				throw e;
			},
		});
		const result = await runProviderVerify(provider, { apiKey: "k" });
		expect(result).toEqual({ ok: false, code: "INTEGRATION_TIMEOUT" });
	});

	it("aborts the verify after the timeout window", async () => {
		const provider = makeProvider({
			verify: async (_, { signal }) => {
				await new Promise((resolve, reject) => {
					signal.addEventListener("abort", () => {
						const err = new Error("aborted");
						err.name = "AbortError";
						reject(err);
					});
					setTimeout(resolve, 1000);
				});
			},
		});
		const start = Date.now();
		const result = await runProviderVerify(provider, { apiKey: "k" }, 50);
		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(500);
		expect(result).toEqual({ ok: false, code: "INTEGRATION_TIMEOUT" });
	});

	it("respects defaultErrorCode when the thrown error has no hint", async () => {
		const provider = makeProvider({
			verify: async () => {
				throw new Error("upstream-403");
			},
			defaultErrorCode: "INTEGRATION_AUTH_REJECTED",
		});
		const result = await runProviderVerify(provider, { apiKey: "k" });
		expect(result).toEqual({
			ok: false,
			code: "INTEGRATION_AUTH_REJECTED",
		});
	});
});

describe("connectIntegration", () => {
	it("happy path: persists status + sealed secret on verify success", async () => {
		const provider = makeProvider({ verify: async () => {} });
		const result = await connectIntegration(repo, {
			provider,
			fields: { apiKey: "live-key" },
			now: NOW,
			rootSecret: ROOT,
		});
		expect(result).toEqual({ ok: true, status: "connected" });
		expect(repo.findStatus("newsletter", "test")?.status).toBe("connected");
		const decoded = await repo.findSecret<{ apiKey: string }>(
			"newsletter",
			"test",
			{ current: ROOT },
		);
		expect(decoded?.apiKey).toBe("live-key");
	});

	it("does NOT persist anything when field validation fails", async () => {
		const provider = makeProvider({ verify: async () => {} });
		const result = await connectIntegration(repo, {
			provider,
			// @ts-expect-error — empty key violates min(1)
			fields: { apiKey: "" },
			now: NOW,
			rootSecret: ROOT,
		});
		expect(result).toEqual({
			ok: false,
			status: "error",
			code: "INTEGRATION_VERIFY_FAILED",
		});
		expect(repo.findStatus("newsletter", "test")).toBeUndefined();
	});

	it("does NOT persist anything when verify throws", async () => {
		const provider = makeProvider({
			verify: async () => {
				throw new Error("nope");
			},
		});
		const result = await connectIntegration(repo, {
			provider,
			fields: { apiKey: "k" },
			now: NOW,
			rootSecret: ROOT,
		});
		expect(result.ok).toBe(false);
		expect(repo.findStatus("newsletter", "test")).toBeUndefined();
	});

	it("plumbs verifyTimeoutMs through", async () => {
		const provider = makeProvider({
			verify: async (_, { signal }) =>
				new Promise<void>((_, reject) => {
					signal.addEventListener("abort", () => {
						const e = new Error("aborted");
						e.name = "AbortError";
						reject(e);
					});
				}),
		});
		const result = await connectIntegration(repo, {
			provider,
			fields: { apiKey: "k" },
			now: NOW,
			rootSecret: ROOT,
			verifyTimeoutMs: 30,
		});
		expect(result).toEqual({
			ok: false,
			status: "error",
			code: "INTEGRATION_TIMEOUT",
		});
	});

	it("includes configJson when provided", async () => {
		const provider = makeProvider({ verify: async () => {} });
		await connectIntegration(repo, {
			provider,
			fields: { apiKey: "k" },
			configJson: '{"baseUrl":"https://x.test"}',
			now: NOW,
			rootSecret: ROOT,
		});
		expect(repo.findStatus("newsletter", "test")?.configJson).toBe(
			'{"baseUrl":"https://x.test"}',
		);
	});

	it("defaults configJson to '{}' when omitted", async () => {
		const provider = makeProvider({ verify: async () => {} });
		await connectIntegration(repo, {
			provider,
			fields: { apiKey: "k" },
			now: NOW,
			rootSecret: ROOT,
		});
		expect(repo.findStatus("newsletter", "test")?.configJson).toBe("{}");
	});
});

describe("reverifyIntegration", () => {
	it("flips the status to connected on success", async () => {
		const provider = makeProvider({ verify: async () => {} });
		await connectIntegration(repo, {
			provider,
			fields: { apiKey: "k" },
			now: NOW,
			rootSecret: ROOT,
		});
		// Manually flip to error first.
		repo.updateStatus({
			domain: "newsletter",
			provider: "test",
			status: "error",
			lastCheckAt: NOW,
			lastError: "INTEGRATION_VERIFY_FAILED",
		});
		const result = await reverifyIntegration(
			repo,
			provider,
			{ apiKey: "k" },
			"2026-05-02T13:00:00.000Z",
		);
		expect(result).toEqual({ ok: true, status: "connected" });
		const status = repo.findStatus("newsletter", "test");
		expect(status?.status).toBe("connected");
		expect(status?.lastError).toBeNull();
	});

	it("flips the status to error on failure", async () => {
		const provider = makeProvider({ verify: async () => {} });
		await connectIntegration(repo, {
			provider,
			fields: { apiKey: "k" },
			now: NOW,
			rootSecret: ROOT,
		});
		_resetRegistryForTests();
		const failingProvider = registerProvider("newsletter", {
			id: "test",
			label: "Test",
			fields,
			verify: async () => {
				throw new Error("upstream-down");
			},
		});
		const result = await reverifyIntegration(
			repo,
			failingProvider,
			{ apiKey: "k" },
			"2026-05-02T13:00:00.000Z",
		);
		expect(result.ok).toBe(false);
		const status = repo.findStatus("newsletter", "test");
		expect(status?.status).toBe("error");
		expect(status?.lastError).toBe("INTEGRATION_VERIFY_FAILED");
	});
});
