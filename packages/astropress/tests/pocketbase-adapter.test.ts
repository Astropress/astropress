import { describe, expect, it } from "vitest";
import {
	createAstropressPocketbaseAdapter,
	createAstropressPocketbaseHostedAdapter,
	readAstropressPocketbaseHostedConfig,
} from "../src/adapters/pocketbase.js";
import { createHostedStores } from "./helpers/provider-test-fixtures.js";

describe("readAstropressPocketbaseHostedConfig", () => {
	it("reads all required env vars", () => {
		const config = readAstropressPocketbaseHostedConfig({
			POCKETBASE_URL: "https://pb.example.com",
			POCKETBASE_EMAIL: "admin@example.com",
			POCKETBASE_PASSWORD: "secret123",
		});
		expect(config.url).toBe("https://pb.example.com");
		expect(config.email).toBe("admin@example.com");
		expect(config.password).toBe("secret123");
		expect(config.apiBaseUrl).toBe("https://pb.example.com/api/astropress");
		expect(config.previewBaseUrl).toBe("https://pb.example.com");
	});

	it("strips trailing slash from url before building apiBaseUrl", () => {
		const config = readAstropressPocketbaseHostedConfig({
			POCKETBASE_URL: "https://pb.example.com/",
			POCKETBASE_EMAIL: "admin@example.com",
			POCKETBASE_PASSWORD: "secret123",
		});
		expect(config.apiBaseUrl).toBe("https://pb.example.com/api/astropress");
		expect(config.previewBaseUrl).toBe("https://pb.example.com");
	});

	it("throws when POCKETBASE_URL is missing", () => {
		expect(() =>
			readAstropressPocketbaseHostedConfig({
				POCKETBASE_EMAIL: "admin@example.com",
				POCKETBASE_PASSWORD: "secret123",
			}),
		).toThrow(/POCKETBASE_URL/);
	});

	it("throws when POCKETBASE_EMAIL is missing", () => {
		expect(() =>
			readAstropressPocketbaseHostedConfig({
				POCKETBASE_URL: "https://pb.example.com",
				POCKETBASE_PASSWORD: "secret123",
			}),
		).toThrow(/POCKETBASE_EMAIL/);
	});

	it("throws when POCKETBASE_PASSWORD is missing", () => {
		expect(() =>
			readAstropressPocketbaseHostedConfig({
				POCKETBASE_URL: "https://pb.example.com",
				POCKETBASE_EMAIL: "admin@example.com",
			}),
		).toThrow(/POCKETBASE_PASSWORD/);
	});
});

describe("createAstropressPocketbaseAdapter", () => {
	it("reports providerName as pocketbase", () => {
		const adapter = createAstropressPocketbaseAdapter({
			...createHostedStores(),
		});
		expect(adapter.capabilities.name).toBe("pocketbase");
	});

	it("has database and objectStorage capabilities", () => {
		const adapter = createAstropressPocketbaseAdapter({
			...createHostedStores(),
		});
		expect(adapter.capabilities.database).toBe(true);
		expect(adapter.capabilities.objectStorage).toBe(true);
		expect(adapter.capabilities.serverRuntime).toBe(true);
		expect(adapter.capabilities.hostedAdmin).toBe(true);
	});

	it("stores and retrieves content via backing adapter", async () => {
		const adapter = createAstropressPocketbaseAdapter({
			...createHostedStores(),
		});
		await adapter.content.save({
			id: "pb-test-post",
			kind: "post",
			slug: "pb-test-post",
			status: "published",
			title: "PocketBase test post",
		});
		const record = await adapter.content.get("pb-test-post");
		expect(record).toMatchObject({
			slug: "pb-test-post",
			title: "PocketBase test post",
		});
	});

	it("auth signIn works via backing adapter", async () => {
		const adapter = createAstropressPocketbaseAdapter({
			...createHostedStores(),
		});
		const user = await adapter.auth.signIn("admin@example.com", "password");
		expect(user).toMatchObject({ email: "admin@example.com", role: "admin" });
	});
});

describe("createAstropressPocketbaseHostedAdapter", () => {
	const env = {
		POCKETBASE_URL: "https://pb.example.com",
		POCKETBASE_EMAIL: "admin@example.com",
		POCKETBASE_PASSWORD: "secret123",
	};

	it("creates an adapter with pocketbase providerName", () => {
		const adapter = createAstropressPocketbaseHostedAdapter({
			env,
			...createHostedStores(),
		});
		expect(adapter.capabilities.name).toBe("pocketbase");
	});

	it("has all required capabilities", () => {
		const adapter = createAstropressPocketbaseHostedAdapter({
			env,
			...createHostedStores(),
		});
		expect(adapter.capabilities.database).toBe(true);
		expect(adapter.capabilities.objectStorage).toBe(true);
		expect(adapter.capabilities.serverRuntime).toBe(true);
		expect(adapter.capabilities.hostedAdmin).toBe(true);
	});

	it("preview URL uses the previewBaseUrl path", async () => {
		const adapter = createAstropressPocketbaseHostedAdapter({
			env,
			...createHostedStores(),
		});
		const preview = await adapter.preview?.create({ recordId: "my-post" });
		expect(preview?.url).toContain("pb.example.com");
		expect(preview?.url).toContain("preview");
	});

	it("uses hosted API adapter when no stores are provided", () => {
		const adapter = createAstropressPocketbaseHostedAdapter({
			config: {
				url: "https://pb.example.com",
				email: "admin@example.com",
				password: "secret123",
				apiBaseUrl: "https://pb.example.com/api/astropress",
				previewBaseUrl: "https://pb.example.com",
			},
			fetchImpl: async () => new Response(JSON.stringify([]), { status: 200 }),
		});
		expect(adapter.capabilities.name).toBe("pocketbase");
		expect(adapter.capabilities.database).toBe(true);
	});

	it("respects backing adapter stores when provided", async () => {
		const stores = createHostedStores();
		const adapter = createAstropressPocketbaseHostedAdapter({ env, ...stores });
		await adapter.content.save({
			id: "pb-hosted-post",
			kind: "post",
			slug: "pb-hosted-post",
			status: "published",
			title: "Hosted post",
		});
		expect(await adapter.content.get("pb-hosted-post")).toMatchObject({
			slug: "pb-hosted-post",
		});
	});

	it("forwards staticPublishing from defaultCapabilities through the platform path", () => {
		const adapter = createAstropressPocketbaseHostedAdapter({
			env,
			...createHostedStores(),
			defaultCapabilities: { staticPublishing: true },
		});
		expect(adapter.capabilities.staticPublishing).toBe(true);
	});

	it("forwards staticPublishing from defaultCapabilities through the hosted-API path", () => {
		const adapter = createAstropressPocketbaseHostedAdapter({
			env,
			fetchImpl: async () => new Response(JSON.stringify([]), { status: 200 }),
			defaultCapabilities: { staticPublishing: true },
		});
		expect(adapter.capabilities.staticPublishing).toBe(true);
	});
});

function createFetchSpy() {
	const calls: Array<{ url: string; init?: RequestInit }> = [];
	const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(url), init });
		return new Response(
			JSON.stringify({
				id: "spy-record",
				kind: "post",
				slug: "spy-record",
				status: "published",
				title: "Spy record",
			}),
			{ status: 200 },
		);
	}) as typeof fetch;
	return { calls, fetchImpl };
}

describe("createAstropressPocketbaseHostedAdapter store routing", () => {
	const env = {
		POCKETBASE_URL: "https://pb.example.com",
		POCKETBASE_EMAIL: "admin@example.com",
		POCKETBASE_PASSWORD: "secret123",
	};

	it("routes through the hosted API when no stores are provided", async () => {
		const { calls, fetchImpl } = createFetchSpy();
		const adapter = createAstropressPocketbaseHostedAdapter({ env, fetchImpl });
		await adapter.content.get("some-id");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toContain("https://pb.example.com/api/astropress");
	});

	it("sends the email:password access token as a Bearer authorization header", async () => {
		const { calls, fetchImpl } = createFetchSpy();
		const adapter = createAstropressPocketbaseHostedAdapter({ env, fetchImpl });
		await adapter.content.get("some-id");
		const headers = calls[0]?.init?.headers as Record<string, string> | undefined;
		expect(headers?.authorization).toBe("Bearer admin@example.com:secret123");
	});

	it("does not call the hosted API when a backing adapter is provided", async () => {
		const { calls, fetchImpl } = createFetchSpy();
		const backingAdapter = createAstropressPocketbaseHostedAdapter({
			...createHostedStores(),
			config: {
				url: "https://pb.example.com",
				email: "a@b.com",
				password: "p",
				apiBaseUrl: "https://pb.example.com/api/astropress",
				previewBaseUrl: "https://pb.example.com",
			},
		});
		const adapter = createAstropressPocketbaseHostedAdapter({ env, fetchImpl, backingAdapter });
		await adapter.content.save({
			id: "backed",
			kind: "post",
			slug: "backed",
			status: "published",
			title: "Backed",
		});
		expect(await adapter.content.get("backed")).toMatchObject({ slug: "backed" });
		expect(calls).toHaveLength(0);
	});

	it("does not call the hosted API when only a content store is provided", async () => {
		const { calls, fetchImpl } = createFetchSpy();
		const adapter = createAstropressPocketbaseHostedAdapter({
			env,
			fetchImpl,
			content: createHostedStores().content,
		});
		await adapter.content.save({
			id: "content-only",
			kind: "post",
			slug: "content-only",
			status: "published",
			title: "Content only",
		});
		expect(await adapter.content.get("content-only")).toMatchObject({ slug: "content-only" });
		expect(calls).toHaveLength(0);
	});

	it("does not call the hosted API when only a media store is provided", async () => {
		const { calls, fetchImpl } = createFetchSpy();
		const adapter = createAstropressPocketbaseHostedAdapter({
			env,
			fetchImpl,
			media: createHostedStores().media,
		});
		await adapter.media.put({ id: "asset-1", filename: "a.png", mimeType: "image/png" });
		expect(calls).toHaveLength(0);
	});

	it("does not call the hosted API when only a revisions store is provided", async () => {
		const { calls, fetchImpl } = createFetchSpy();
		const adapter = createAstropressPocketbaseHostedAdapter({
			env,
			fetchImpl,
			revisions: createHostedStores().revisions,
		});
		await adapter.revisions.list("record-1");
		expect(calls).toHaveLength(0);
	});

	it("does not call the hosted API when only an auth store is provided", async () => {
		const { calls, fetchImpl } = createFetchSpy();
		const adapter = createAstropressPocketbaseHostedAdapter({
			env,
			fetchImpl,
			auth: createHostedStores().auth,
		});
		await adapter.auth.signIn("admin@example.com", "password");
		expect(calls).toHaveLength(0);
	});
});

describe("createAstropressPocketbaseAdapter capabilities", () => {
	it("forwards staticPublishing from defaultCapabilities", () => {
		const adapter = createAstropressPocketbaseAdapter({
			...createHostedStores(),
			defaultCapabilities: { staticPublishing: true },
		});
		expect(adapter.capabilities.staticPublishing).toBe(true);
	});
});
