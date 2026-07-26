import { describe, expect, it, vi } from "vitest";
import {
	createAstropressNhostAdapter,
	createAstropressNhostHostedAdapter,
	readAstropressNhostHostedConfig,
} from "../src/adapters/nhost.js";
import { createAstropressInMemoryPlatformAdapter } from "../src/in-memory-platform-adapter.js";

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
		expect(config.previewBaseUrl).toBe("https://abcdefgh.eu-central-1.nhost.run/console");
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
		expect(() => readAstropressNhostHostedConfig({ ...validEnv, NHOST_REGION: undefined })).toThrow(
			/NHOST_REGION/,
		);
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
			mode: string;
		};
		expect(panel).toBeTruthy();
		expect(panel.url).toBe("https://abcdefgh.eu-central-1.nhost.run/console");
		expect(panel.label).toBe("Nhost Console");
		// Pins L94 StringLiteral `mode: "link"`.
		expect(panel.mode).toBe("link");
	});

	it("routes through the hosted-API adapter when no stores are provided and invokes fetchImpl (pins L78 condition chain)", async () => {
		const fetchImpl = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }) as never);
		const adapter = createAstropressNhostHostedAdapter({
			env: validEnv,
			fetchImpl: fetchImpl as never,
		});
		await adapter.content.list("post");
		expect(fetchImpl).toHaveBeenCalled();
		expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("functions/astropress");
	});

	it.each([["backingAdapter"], ["content"], ["media"], ["revisions"], ["auth"]] as const)(
		"does NOT call fetchImpl when only `%s` is supplied (pins each L78 `!options.x &&` clause)",
		async (key) => {
			const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }) as never);
			const backing = createAstropressInMemoryPlatformAdapter({
				capabilities: { name: "sqlite" },
			});
			const isolated: Record<string, unknown> = {};
			if (key === "backingAdapter") {
				isolated.backingAdapter = backing;
			} else {
				isolated[key] = backing[key as "content" | "media" | "revisions" | "auth"];
			}
			const adapter = createAstropressNhostHostedAdapter({
				env: validEnv,
				...(isolated as Parameters<typeof createAstropressNhostHostedAdapter>[0]),
				fetchImpl: fetchImpl as never,
			});
			await adapter.content.list("post");
			expect(fetchImpl).not.toHaveBeenCalled();
		},
	);

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
		expect(() => createAstropressNhostHostedAdapter({ env: {} })).toThrow(/NHOST_SUBDOMAIN/);
	});

	it("trims whitespace from NHOST_SUBDOMAIN (pins L53 .trim())", () => {
		const config = readAstropressNhostHostedConfig({
			NHOST_SUBDOMAIN: "  xyz  ",
			NHOST_REGION: "us-east-1",
			NHOST_ADMIN_SECRET: "secret",
		});
		expect(config.subdomain).toBe("xyz");
	});

	it("treats whitespace-only NHOST_SUBDOMAIN as missing", () => {
		expect(() =>
			readAstropressNhostHostedConfig({
				NHOST_SUBDOMAIN: "   ",
				NHOST_REGION: "us-east-1",
				NHOST_ADMIN_SECRET: "secret",
			}),
		).toThrow();
	});

	it("trims whitespace from NHOST_REGION (pins L54 .trim())", () => {
		const config = readAstropressNhostHostedConfig({
			NHOST_SUBDOMAIN: "xyz",
			NHOST_REGION: "  us-east-1  ",
			NHOST_ADMIN_SECRET: "secret",
		});
		expect(config.region).toBe("us-east-1");
	});

	it("trims whitespace from NHOST_ADMIN_SECRET (pins L55 .trim())", () => {
		const config = readAstropressNhostHostedConfig({
			NHOST_SUBDOMAIN: "xyz",
			NHOST_REGION: "us-east-1",
			NHOST_ADMIN_SECRET: "  secret  ",
		});
		expect(config.adminSecret).toBe("secret");
	});
});
