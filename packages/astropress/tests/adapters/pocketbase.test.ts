import { describe, expect, it } from "vitest";

import { readAstropressPocketbaseHostedConfig } from "../../src/adapters/pocketbase";

describe("readAstropressPocketbaseHostedConfig", () => {
	it("strips a single trailing slash from POCKETBASE_URL when building apiBaseUrl and previewBaseUrl", () => {
		const config = readAstropressPocketbaseHostedConfig({
			POCKETBASE_URL: "https://pocketbase.example.com/",
			POCKETBASE_EMAIL: "admin@example.com",
			POCKETBASE_PASSWORD: "secret",
		});
		expect(config.apiBaseUrl).toBe("https://pocketbase.example.com/api/astropress");
		expect(config.previewBaseUrl).toBe("https://pocketbase.example.com");
	});

	it("strips multiple trailing slashes from POCKETBASE_URL", () => {
		const config = readAstropressPocketbaseHostedConfig({
			POCKETBASE_URL: "https://pocketbase.example.com///",
			POCKETBASE_EMAIL: "admin@example.com",
			POCKETBASE_PASSWORD: "secret",
		});
		expect(config.apiBaseUrl).toBe("https://pocketbase.example.com/api/astropress");
		expect(config.previewBaseUrl).toBe("https://pocketbase.example.com");
	});

	it("preserves a URL with no trailing slash unchanged", () => {
		const config = readAstropressPocketbaseHostedConfig({
			POCKETBASE_URL: "https://pocketbase.example.com",
			POCKETBASE_EMAIL: "admin@example.com",
			POCKETBASE_PASSWORD: "secret",
		});
		expect(config.apiBaseUrl).toBe("https://pocketbase.example.com/api/astropress");
		expect(config.previewBaseUrl).toBe("https://pocketbase.example.com");
	});

	it("preserves the literal /api/astropress suffix exactly (kills mutants on the suffix string)", () => {
		const config = readAstropressPocketbaseHostedConfig({
			POCKETBASE_URL: "https://pb.example.com",
			POCKETBASE_EMAIL: "a@b.com",
			POCKETBASE_PASSWORD: "p",
		});
		expect(config.apiBaseUrl.endsWith("/api/astropress")).toBe(true);
		expect(config.apiBaseUrl).not.toBe(config.previewBaseUrl);
	});

	it("populates email and password verbatim without altering casing or punctuation", () => {
		const config = readAstropressPocketbaseHostedConfig({
			POCKETBASE_URL: "https://pb.example.com",
			POCKETBASE_EMAIL: "Admin@Example.COM",
			POCKETBASE_PASSWORD: "secretP@ss/w0rd",
		});
		expect(config.email).toBe("Admin@Example.COM");
		expect(config.password).toBe("secretP@ss/w0rd");
		expect(config.url).toBe("https://pb.example.com");
	});

	it("trims surrounding whitespace from POCKETBASE_URL", () => {
		const config = readAstropressPocketbaseHostedConfig({
			POCKETBASE_URL: "  https://pb.example.com  ",
			POCKETBASE_EMAIL: "a@b.com",
			POCKETBASE_PASSWORD: "p",
		});
		expect(config.url).toBe("https://pb.example.com");
		expect(config.apiBaseUrl).toBe("https://pb.example.com/api/astropress");
	});

	it("trims surrounding whitespace from POCKETBASE_EMAIL", () => {
		const config = readAstropressPocketbaseHostedConfig({
			POCKETBASE_URL: "https://pb.example.com",
			POCKETBASE_EMAIL: "  admin@example.com\t",
			POCKETBASE_PASSWORD: "p",
		});
		expect(config.email).toBe("admin@example.com");
	});

	it("trims surrounding whitespace from POCKETBASE_PASSWORD", () => {
		const config = readAstropressPocketbaseHostedConfig({
			POCKETBASE_URL: "https://pb.example.com",
			POCKETBASE_EMAIL: "a@b.com",
			POCKETBASE_PASSWORD: "\n  secret  \n",
		});
		expect(config.password).toBe("secret");
	});

	it("throws when POCKETBASE_URL is missing", () => {
		expect(() => readAstropressPocketbaseHostedConfig({})).toThrowError(/POCKETBASE_URL/);
	});

	it("throws when POCKETBASE_EMAIL is missing", () => {
		expect(() =>
			readAstropressPocketbaseHostedConfig({
				POCKETBASE_URL: "https://pb.example.com",
				POCKETBASE_PASSWORD: "secret",
			}),
		).toThrowError(/POCKETBASE_EMAIL/);
	});

	it("throws when POCKETBASE_PASSWORD is missing", () => {
		expect(() =>
			readAstropressPocketbaseHostedConfig({
				POCKETBASE_URL: "https://pb.example.com",
				POCKETBASE_EMAIL: "admin@example.com",
			}),
		).toThrowError(/POCKETBASE_PASSWORD/);
	});
});
