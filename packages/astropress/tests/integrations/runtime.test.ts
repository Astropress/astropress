import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
	_resetRegistryForTests,
	registerProvider,
} from "../../src/integrations/registry";
import {
	createRequestProviderCache,
	getConnectedProvider,
	listRegisteredProvidersForDomain,
} from "../../src/integrations/runtime";
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

beforeEach(() => {
	db = makeDb();
	db.exec("PRAGMA foreign_keys = ON");
	repo = createIntegrationsRepository({
		getDb: () => db as never,
		now: () => NOW,
	});
	_resetRegistryForTests();
	registerProvider("newsletter", {
		id: "listmonk",
		label: "Listmonk",
		fields,
	});
});

afterEach(() => {
	_resetRegistryForTests();
});

describe("getConnectedProvider", () => {
	it("returns the decoded fields for a connected row", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "live-key" },
				now: NOW,
			},
			ROOT,
		);
		const result = await getConnectedProvider({
			domain: "newsletter",
			repo,
			rootSecrets: { current: ROOT },
		});
		expect(result?.providerId).toBe("listmonk");
		expect(result?.fields.apiKey).toBe("live-key");
	});

	it("returns undefined when no row exists for the domain", async () => {
		const result = await getConnectedProvider({
			domain: "analytics",
			repo,
			rootSecrets: { current: ROOT },
		});
		expect(result).toBeUndefined();
	});

	it("returns undefined when only a different domain has a connected row", async () => {
		// Forces the .filter(s.domain === args.domain) predicate to do
		// real work — without it, a connected newsletter row would mask
		// our analytics domain's lack of connection.
		registerProvider("analytics", {
			id: "plausible",
			label: "Plausible",
			fields,
		});
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
		const result = await getConnectedProvider({
			domain: "analytics",
			repo,
			rootSecrets: { current: ROOT },
		});
		expect(result).toBeUndefined();
	});

	it("picks the connected row from the requested domain when multiple domains are connected", async () => {
		registerProvider("analytics", {
			id: "plausible",
			label: "Plausible",
			fields,
		});
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "newsletter-key" },
				now: NOW,
			},
			ROOT,
		);
		await repo.connect(
			{
				domain: "analytics",
				provider: "plausible",
				configJson: "{}",
				secretFields: { apiKey: "analytics-key" },
				now: NOW,
			},
			ROOT,
		);
		const result = await getConnectedProvider({
			domain: "analytics",
			repo,
			rootSecrets: { current: ROOT },
		});
		expect(result?.providerId).toBe("plausible");
		expect(result?.fields.apiKey).toBe("analytics-key");
	});

	it("ignores connected rows from other domains when querying an alphabetically-later domain", async () => {
		// listStatuses returns rows ORDER BY domain ASC, so without the
		// .filter(s.domain === args.domain) call the .find(connected)
		// would latch onto the analytics row first and try to look up
		// "plausible" under "newsletter" — which is not registered there
		// and would return undefined. The filter must do real work for
		// this assertion to pass.
		registerProvider("analytics", {
			id: "plausible",
			label: "Plausible",
			fields,
		});
		await repo.connect(
			{
				domain: "analytics",
				provider: "plausible",
				configJson: "{}",
				secretFields: { apiKey: "analytics-key" },
				now: NOW,
			},
			ROOT,
		);
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "newsletter-key" },
				now: NOW,
			},
			ROOT,
		);
		const result = await getConnectedProvider({
			domain: "newsletter",
			repo,
			rootSecrets: { current: ROOT },
		});
		expect(result?.providerId).toBe("listmonk");
		expect(result?.fields.apiKey).toBe("newsletter-key");
	});

	it("returns undefined when status is 'error'", async () => {
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
		repo.updateStatus({
			domain: "newsletter",
			provider: "listmonk",
			status: "error",
			lastCheckAt: NOW,
			lastError: "INTEGRATION_VERIFY_FAILED",
		});
		const result = await getConnectedProvider({
			domain: "newsletter",
			repo,
			rootSecrets: { current: ROOT },
		});
		expect(result).toBeUndefined();
	});

	it("returns undefined when status is 'paused'", async () => {
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
		repo.updateStatus({
			domain: "newsletter",
			provider: "listmonk",
			status: "paused",
			lastCheckAt: NOW,
		});
		const result = await getConnectedProvider({
			domain: "newsletter",
			repo,
			rootSecrets: { current: ROOT },
		});
		expect(result).toBeUndefined();
	});

	it("returns undefined when findSecret returns undefined (status row exists but secret was deleted)", async () => {
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
		// Wipe the secret row directly while leaving the status row in
		// place; getConnectedProvider must not return a half-connected
		// view to the runtime.
		db.prepare(
			"DELETE FROM integration_secrets WHERE domain=? AND provider=?",
		).run("newsletter", "listmonk");
		const result = await getConnectedProvider({
			domain: "newsletter",
			repo,
			rootSecrets: { current: ROOT },
		});
		expect(result).toBeUndefined();
	});

	it("returns undefined when provider is not registered", async () => {
		_resetRegistryForTests();
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
		const result = await getConnectedProvider({
			domain: "newsletter",
			repo,
			rootSecrets: { current: ROOT },
		});
		expect(result).toBeUndefined();
	});

	it("uses runtimeShape for validation when provided", async () => {
		_resetRegistryForTests();
		registerProvider("newsletter", {
			id: "strict",
			label: "Strict",
			fields,
			runtimeShape: z.object({ apiKey: z.string().min(20) }),
		});
		await repo.connect(
			{
				domain: "newsletter",
				provider: "strict",
				configJson: "{}",
				secretFields: { apiKey: "short" },
				now: NOW,
			},
			ROOT,
		);
		const result = await getConnectedProvider({
			domain: "newsletter",
			repo,
			rootSecrets: { current: ROOT },
		});
		// Runtime shape rejects short keys → undefined.
		expect(result).toBeUndefined();
	});

	it("rotation: opens against previous key when current is wrong", async () => {
		const PREV = "test-root-previous";
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "rotated-key" },
				now: NOW,
			},
			PREV,
		);
		db.prepare(
			"UPDATE integration_secrets SET kid='previous' WHERE domain=? AND provider=?",
		).run("newsletter", "listmonk");
		const result = await getConnectedProvider({
			domain: "newsletter",
			repo,
			rootSecrets: { current: ROOT, previous: PREV },
		});
		expect(result?.fields.apiKey).toBe("rotated-key");
	});
});

describe("createRequestProviderCache", () => {
	it("decrypts only once across multiple calls", async () => {
		await repo.connect(
			{
				domain: "newsletter",
				provider: "listmonk",
				configJson: "{}",
				secretFields: { apiKey: "cache-key" },
				now: NOW,
			},
			ROOT,
		);
		let calls = 0;
		const wrappedRepo: IntegrationsRepository = {
			...repo,
			findSecret: async (...args) => {
				calls += 1;
				return repo.findSecret(...args);
			},
		};
		const cache = createRequestProviderCache({
			domain: "newsletter",
			repo: wrappedRepo,
			rootSecrets: { current: ROOT },
		});
		const first = await cache();
		const second = await cache();
		expect(first?.fields.apiKey).toBe("cache-key");
		expect(second).toBe(first);
		expect(calls).toBe(1);
	});
});

describe("listRegisteredProvidersForDomain", () => {
	it("returns id+label pairs for the domain", () => {
		registerProvider("newsletter", {
			id: "mailchimp",
			label: "Mailchimp",
			fields,
		});
		const out = listRegisteredProvidersForDomain("newsletter")
			.map((p) => p.id)
			.sort();
		expect(out).toEqual(["listmonk", "mailchimp"]);
	});

	it("returns empty array for a domain with no registrations", () => {
		expect(listRegisteredProvidersForDomain("monitoring")).toEqual([]);
	});
});
