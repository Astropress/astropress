import { describe, expect, it } from "vitest";
import {
	createAstropressNhostAdapter,
	createAstropressNhostHostedAdapter,
	readAstropressNhostHostedConfig,
} from "../src/adapters/nhost.js";

describe("readAstropressNhostHostedConfig", () => {
	const validEnv = {
		NHOST_SUBDOMAIN: "abcdefgh",
		NHOST_REGION: "eu-central-1",
		NHOST_ADMIN_SECRET: "super-secret-key",
	};

	it("reads all required env vars", () => {
		const config = readAstropressNhostHostedConfig(validEnv);
		expect(config.subdomain).toBe("abcdefgh");
		expect(config.region).toBe("eu-central-1");
		expect(config.adminSecret).toBe("super-secret-key");
	});

	it("builds the correct API base URL", () => {
		const config = readAstropressNhostHostedConfig(validEnv);
		expect(config.apiBaseUrl).toBe(
			"https://abcdefgh.eu-central-1.nhost.run/v1/functions/astropress",
		);
	});

	it("builds the correct preview (console) URL", () => {
		const config = readAstropressNhostHostedConfig(validEnv);
		expect(config.previewBaseUrl).toBe(
			"https://abcdefgh.eu-central-1.nhost.run/console",
		);
	});

	it("throws when NHOST_SUBDOMAIN is missing", () => {
		expect(() =>
			readAstropressNhostHostedConfig({
				...validEnv,
				NHOST_SUBDOMAIN: undefined,
			}),
		).toThrow(/NHOST_SUBDOMAIN/);
	});

	it("throws when NHOST_REGION is missing", () => {
		expect(() =>
			readAstropressNhostHostedConfig({ ...validEnv, NHOST_REGION: undefined }),
		).toThrow(/NHOST_REGION/);
	});

	it("throws when NHOST_ADMIN_SECRET is missing", () => {
		expect(() =>
			readAstropressNhostHostedConfig({
				...validEnv,
				NHOST_ADMIN_SECRET: undefined,
			}),
		).toThrow(/NHOST_ADMIN_SECRET/);
	});

	it("strips whitespace from env values", () => {
		const config = readAstropressNhostHostedConfig({
			NHOST_SUBDOMAIN: "  abcdefgh  ",
			NHOST_REGION: "  eu-central-1  ",
			NHOST_ADMIN_SECRET: "  secret  ",
		});
		expect(config.subdomain).toBe("abcdefgh");
		expect(config.region).toBe("eu-central-1");
		expect(config.adminSecret).toBe("secret");
	});
});

describe("createAstropressNhostAdapter", () => {
	it("creates an adapter with full capabilities", () => {
		const adapter = createAstropressNhostAdapter();
		expect(adapter.capabilities.name).toBe("nhost");
		expect(adapter.capabilities.database).toBe(true);
		expect(adapter.capabilities.objectStorage).toBe(true);
		expect(adapter.capabilities.serverRuntime).toBe(true);
		expect(adapter.capabilities.hostedAdmin).toBe(true);
	});
});

describe("createAstropressNhostHostedAdapter", () => {
	const validEnv = {
		NHOST_SUBDOMAIN: "abcdefgh",
		NHOST_REGION: "eu-central-1",
		NHOST_ADMIN_SECRET: "super-secret-key",
	};

	it("creates a hosted API adapter with full capabilities", () => {
		const adapter = createAstropressNhostHostedAdapter({ env: validEnv });
		expect(adapter.capabilities.name).toBe("nhost");
		expect(adapter.capabilities.database).toBe(true);
		expect(adapter.capabilities.objectStorage).toBe(true);
		expect(adapter.capabilities.serverRuntime).toBe(true);
		expect(adapter.capabilities.hostedAdmin).toBe(true);
	});

	it("sets the Nhost Console hostPanel link", () => {
		const adapter = createAstropressNhostHostedAdapter({ env: validEnv });
		const panel = adapter.capabilities.hostPanel as {
			url: string;
			label: string;
		};
		expect(panel).toBeTruthy();
		expect(panel.url).toBe("https://abcdefgh.eu-central-1.nhost.run/console");
		expect(panel.label).toBe("Nhost Console");
	});

	it("accepts explicit config bypassing env read", () => {
		const adapter = createAstropressNhostHostedAdapter({
			config: {
				subdomain: "xyz",
				region: "us-east-1",
				adminSecret: "s3cr3t",
				apiBaseUrl: "https://xyz.us-east-1.nhost.run/v1/functions/astropress",
				previewBaseUrl: "https://xyz.us-east-1.nhost.run/console",
			},
		});
		expect(adapter.capabilities.name).toBe("nhost");
	});

	it("falls back to hosted platform adapter when backing stores are provided", () => {
		const mockContent = {
			async list() {
				return [];
			},
			async get() {
				return null;
			},
			async save(r: unknown) {
				return r as never;
			},
			async delete() {},
		};
		const adapter = createAstropressNhostHostedAdapter({
			env: validEnv,
			content: mockContent,
		});
		expect(adapter.capabilities.name).toBe("nhost");
	});

	it("throws when required env vars are missing and no explicit config", () => {
		expect(() => createAstropressNhostHostedAdapter({ env: {} })).toThrow(
			/NHOST_SUBDOMAIN/,
		);
	});
});
