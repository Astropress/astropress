import { describe, expect, it } from "vitest";
import {
	createAstropressNeonAdapter,
	createAstropressNeonHostedAdapter,
	readAstropressNeonHostedConfig,
} from "../src/adapters/neon.js";

describe("readAstropressNeonHostedConfig", () => {
	it("reads DATABASE_URL from env", () => {
		const config = readAstropressNeonHostedConfig({
			DATABASE_URL:
				"postgresql://user:pass@ep-example.us-east-1.aws.neon.tech/neondb",
		});
		expect(config.databaseUrl).toBe(
			"postgresql://user:pass@ep-example.us-east-1.aws.neon.tech/neondb",
		);
		expect(config.projectId).toBeUndefined();
		expect(config.apiBaseUrl).toBe("https://console.neon.tech");
	});

	it("includes project console URL when NEON_PROJECT_ID is set", () => {
		const config = readAstropressNeonHostedConfig({
			DATABASE_URL:
				"postgres://user:pass@ep-example.us-east-1.aws.neon.tech/neondb",
			NEON_PROJECT_ID: "proj-quiet-moon-123456",
		});
		expect(config.projectId).toBe("proj-quiet-moon-123456");
		expect(config.apiBaseUrl).toBe(
			"https://console.neon.tech/app/projects/proj-quiet-moon-123456",
		);
	});

	it("throws when DATABASE_URL is missing", () => {
		expect(() => readAstropressNeonHostedConfig({})).toThrow(/DATABASE_URL/);
	});

	it("throws when DATABASE_URL is not a postgres URL", () => {
		expect(() =>
			readAstropressNeonHostedConfig({
				DATABASE_URL: "mysql://user:pass@host/db",
			}),
		).toThrow(/postgres/);
	});

	it("accepts both postgres:// and postgresql:// schemes", () => {
		expect(() =>
			readAstropressNeonHostedConfig({
				DATABASE_URL: "postgres://u:p@host/db",
			}),
		).not.toThrow();
		expect(() =>
			readAstropressNeonHostedConfig({
				DATABASE_URL: "postgresql://u:p@host/db",
			}),
		).not.toThrow();
	});

	it("strips trailing whitespace from DATABASE_URL", () => {
		const config = readAstropressNeonHostedConfig({
			DATABASE_URL: "  postgres://u:p@host/db  ",
		});
		expect(config.databaseUrl).toBe("postgres://u:p@host/db");
	});
});

describe("createAstropressNeonAdapter", () => {
	it("creates an adapter with database-only capabilities", () => {
		const adapter = createAstropressNeonAdapter();
		expect(adapter.capabilities.name).toBe("neon");
		expect(adapter.capabilities.database).toBe(true);
		expect(adapter.capabilities.objectStorage).toBe(false);
		expect(adapter.capabilities.serverRuntime).toBe(false);
		expect(adapter.capabilities.hostedAdmin).toBe(false);
	});

	it("accepts custom backing adapter options", () => {
		const adapter = createAstropressNeonAdapter({
			defaultCapabilities: { gitSync: true },
		});
		expect(adapter.capabilities.gitSync).toBe(true);
		expect(adapter.capabilities.database).toBe(true);
	});
});

describe("createAstropressNeonHostedAdapter", () => {
	const validEnv = {
		DATABASE_URL:
			"postgres://user:pass@ep-example.us-east-1.aws.neon.tech/neondb",
		NEON_PROJECT_ID: "proj-silent-leaf-987654",
	};

	it("creates an adapter with database-only capabilities", () => {
		const adapter = createAstropressNeonHostedAdapter({ env: validEnv });
		expect(adapter.capabilities.name).toBe("neon");
		expect(adapter.capabilities.database).toBe(true);
		expect(adapter.capabilities.objectStorage).toBe(false);
		expect(adapter.capabilities.serverRuntime).toBe(false);
		expect(adapter.capabilities.hostedAdmin).toBe(false);
	});

	it("sets the Neon Console hostPanel link", () => {
		const adapter = createAstropressNeonHostedAdapter({ env: validEnv });
		const panel = adapter.capabilities.hostPanel;
		expect(panel).toBeTruthy();
		expect((panel as { url: string }).url).toContain("proj-silent-leaf-987654");
		expect((panel as { label: string }).label).toBe("Neon Console");
	});

	it("falls back to generic Neon Console URL when no project ID", () => {
		const adapter = createAstropressNeonHostedAdapter({
			env: { DATABASE_URL: "postgres://u:p@host/db" },
		});
		const panel = adapter.capabilities.hostPanel as { url: string };
		expect(panel.url).toBe("https://console.neon.tech");
	});

	it("accepts explicit config bypassing env read", () => {
		const adapter = createAstropressNeonHostedAdapter({
			config: {
				databaseUrl: "postgres://u:p@host/db",
				apiBaseUrl: "https://console.neon.tech",
			},
		});
		expect(adapter.capabilities.name).toBe("neon");
	});

	it("throws when DATABASE_URL is missing and no explicit config", () => {
		expect(() => createAstropressNeonHostedAdapter({ env: {} })).toThrow(
			/DATABASE_URL/,
		);
	});
});
