import { describe, expect, it } from "vitest";
import {
	createAstropressTursoAdapter,
	createAstropressTursoHostedAdapter,
	readAstropressTursoHostedConfig,
} from "../src/adapters/turso.js";

describe("readAstropressTursoHostedConfig", () => {
	it("reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from env", () => {
		const config = readAstropressTursoHostedConfig({
			TURSO_DATABASE_URL: "libsql://astropress-prod.turso.io",
			TURSO_AUTH_TOKEN: "token-abc",
		});
		expect(config.databaseUrl).toBe("libsql://astropress-prod.turso.io");
		expect(config.authToken).toBe("token-abc");
		expect(config.apiBaseUrl).toContain("astropress-prod");
	});

	it("accepts https:// connection strings", () => {
		const config = readAstropressTursoHostedConfig({
			TURSO_DATABASE_URL: "https://astropress-prod.turso.io",
			TURSO_AUTH_TOKEN: "token-abc",
		});
		expect(config.databaseUrl).toBe("https://astropress-prod.turso.io");
	});

	it("throws when TURSO_DATABASE_URL is missing", () => {
		expect(() => readAstropressTursoHostedConfig({ TURSO_AUTH_TOKEN: "token-abc" })).toThrow(
			/TURSO_DATABASE_URL/,
		);
	});

	it("throws when TURSO_DATABASE_URL is not a libsql:// or https:// URL", () => {
		expect(() =>
			readAstropressTursoHostedConfig({
				TURSO_DATABASE_URL: "mysql://host/db",
				TURSO_AUTH_TOKEN: "token-abc",
			}),
		).toThrow(/libsql/);
	});

	it("throws when TURSO_AUTH_TOKEN is missing", () => {
		expect(() =>
			readAstropressTursoHostedConfig({
				TURSO_DATABASE_URL: "libsql://astropress-prod.turso.io",
			}),
		).toThrow(/TURSO_AUTH_TOKEN/);
	});
});

describe("createAstropressTursoAdapter", () => {
	it("creates an adapter with database-only capabilities", () => {
		const adapter = createAstropressTursoAdapter();
		expect(adapter.capabilities.name).toBe("turso");
		expect(adapter.capabilities.database).toBe(true);
		expect(adapter.capabilities.objectStorage).toBe(false);
		expect(adapter.capabilities.serverRuntime).toBe(true);
		expect(adapter.capabilities.hostedAdmin).toBe(false);
		expect(adapter.capabilities.previewEnvironments).toBe(false);
	});

	it("accepts custom backing adapter options", () => {
		const adapter = createAstropressTursoAdapter({
			defaultCapabilities: { gitSync: true },
		});
		expect(adapter.capabilities.gitSync).toBe(true);
		expect(adapter.capabilities.database).toBe(true);
	});
});

describe("createAstropressTursoHostedAdapter", () => {
	const validEnv = {
		TURSO_DATABASE_URL: "libsql://astropress-prod.turso.io",
		TURSO_AUTH_TOKEN: "token-abc",
	};

	it("creates an adapter with database-only capabilities", () => {
		const adapter = createAstropressTursoHostedAdapter({ env: validEnv });
		expect(adapter.capabilities.name).toBe("turso");
		expect(adapter.capabilities.database).toBe(true);
		expect(adapter.capabilities.objectStorage).toBe(false);
		expect(adapter.capabilities.hostedAdmin).toBe(false);
	});

	it("sets the Turso Dashboard hostPanel link", () => {
		const adapter = createAstropressTursoHostedAdapter({ env: validEnv });
		const panel = adapter.capabilities.hostPanel;
		expect(panel).toBeTruthy();
		expect((panel as { url: string }).url).toContain("astropress-prod");
		expect((panel as { label: string }).label).toBe("Turso Dashboard");
	});

	it("accepts explicit config bypassing env read", () => {
		const adapter = createAstropressTursoHostedAdapter({
			config: {
				databaseUrl: "libsql://astropress-prod.turso.io",
				authToken: "token-abc",
				apiBaseUrl: "https://app.turso.tech/databases/astropress-prod",
			},
		});
		expect(adapter.capabilities.name).toBe("turso");
	});

	it("throws when TURSO_DATABASE_URL is missing and no explicit config", () => {
		expect(() => createAstropressTursoHostedAdapter({ env: {} })).toThrow(/TURSO_DATABASE_URL/);
	});

	it("trims whitespace from TURSO_DATABASE_URL (pins L49 .trim())", () => {
		const config = readAstropressTursoHostedConfig({
			TURSO_DATABASE_URL: "  libsql://x.turso.io  ",
			TURSO_AUTH_TOKEN: "tok",
		});
		expect(config.databaseUrl).toBe("libsql://x.turso.io");
	});

	it("treats whitespace-only TURSO_DATABASE_URL as missing (pins L49 .trim() vs raw)", () => {
		expect(() =>
			readAstropressTursoHostedConfig({
				TURSO_DATABASE_URL: "   ",
				TURSO_AUTH_TOKEN: "tok",
			}),
		).toThrow(/TURSO_DATABASE_URL/);
	});

	it("trims whitespace from TURSO_AUTH_TOKEN (pins L59 .trim())", () => {
		const config = readAstropressTursoHostedConfig({
			TURSO_DATABASE_URL: "libsql://x.turso.io",
			TURSO_AUTH_TOKEN: "  tok  ",
		});
		expect(config.authToken).toBe("tok");
	});

	it("treats whitespace-only TURSO_AUTH_TOKEN as missing (pins L59 .trim() vs raw)", () => {
		expect(() =>
			readAstropressTursoHostedConfig({
				TURSO_DATABASE_URL: "libsql://x.turso.io",
				TURSO_AUTH_TOKEN: "   ",
			}),
		).toThrow(/TURSO_AUTH_TOKEN/);
	});

	it("derives dbName by anchored strip of libsql:// prefix (pins L67 ^ anchor)", () => {
		const config = readAstropressTursoHostedConfig({
			TURSO_DATABASE_URL: "libsql://mydb.turso.io",
			TURSO_AUTH_TOKEN: "tok",
		});
		// dbName before `.turso.io` is mydb
		expect(config.apiBaseUrl).toContain("/mydb");
	});

	it("derives dbName by anchored strip of https:// prefix (pins L68 ^ anchor + replacement '')", () => {
		const config = readAstropressTursoHostedConfig({
			TURSO_DATABASE_URL: "https://mydb-https.turso.io",
			TURSO_AUTH_TOKEN: "tok",
		});
		expect(config.apiBaseUrl).toContain("/mydb-https");
		expect(config.apiBaseUrl).not.toContain("Stryker");
	});

	it("defaultCapabilities is gitSync:false / previewEnvironments:false / serverRuntime:true (pins L35/L86/L87 booleans)", () => {
		const adapter = createAstropressTursoHostedAdapter({ env: validEnv });
		expect(adapter.capabilities.gitSync).toBe(false);
		expect(adapter.capabilities.previewEnvironments).toBe(false);
		expect(adapter.capabilities.serverRuntime).toBe(true);
	});
});
