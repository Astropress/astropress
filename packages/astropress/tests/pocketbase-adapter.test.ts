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
});
