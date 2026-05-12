import { describe, expect, it } from "vitest";

import {
	createAstropressSupabaseAdapter,
	readAstropressSupabaseHostedConfig,
} from "../../src/adapters/supabase";
import { createAstropressInMemoryPlatformAdapter } from "../../src/in-memory-platform-adapter";

describe("createAstropressSupabaseAdapter", () => {
	it("throws when called with no configuration at all", () => {
		expect(() => createAstropressSupabaseAdapter()).toThrowError(
			/requires backingAdapter or one of auth\/content\/media\/revisions/,
		);
	});

	it("throws when called with empty options object", () => {
		expect(() => createAstropressSupabaseAdapter({})).toThrowError(/requires backingAdapter/);
	});

	it("accepts a backingAdapter", () => {
		const backing = createAstropressInMemoryPlatformAdapter({
			capabilities: { name: "sqlite" },
		});
		const adapter = createAstropressSupabaseAdapter({
			backingAdapter: backing,
		});
		expect(adapter.capabilities.name).toBe("supabase");
	});

	it("accepts a granular content store without a full backingAdapter", () => {
		const backing = createAstropressInMemoryPlatformAdapter({
			capabilities: { name: "sqlite" },
		});
		const adapter = createAstropressSupabaseAdapter({
			content: backing.content,
		});
		expect(adapter.capabilities.name).toBe("supabase");
	});

	it("accepts a granular auth store", () => {
		const backing = createAstropressInMemoryPlatformAdapter({
			capabilities: { name: "sqlite" },
		});
		const adapter = createAstropressSupabaseAdapter({ auth: backing.auth });
		expect(adapter.capabilities.name).toBe("supabase");
	});

	it("error message names the alternative escape hatch (createAstropressSupabaseSqliteAdapter)", () => {
		try {
			createAstropressSupabaseAdapter();
			throw new Error("expected throw");
		} catch (err) {
			expect(String(err)).toContain("createAstropressSupabaseSqliteAdapter");
		}
	});
});

describe("readAstropressSupabaseHostedConfig", () => {
	it("trims whitespace from SUPABASE_URL (.trim())", () => {
		const config = readAstropressSupabaseHostedConfig({
			SUPABASE_URL: "  https://x.supabase.co  ",
			SUPABASE_SERVICE_ROLE_KEY: "key",
		});
		expect(config.url).toBe("https://x.supabase.co");
	});

	it("trims whitespace from SUPABASE_SERVICE_ROLE_KEY (.trim())", () => {
		const config = readAstropressSupabaseHostedConfig({
			SUPABASE_URL: "https://x.supabase.co",
			SUPABASE_SERVICE_ROLE_KEY: "  key  ",
		});
		expect(config.serviceRoleKey).toBe("key");
	});

	it("treats whitespace-only SUPABASE_URL as missing", () => {
		expect(() =>
			readAstropressSupabaseHostedConfig({
				SUPABASE_URL: "   ",
				SUPABASE_SERVICE_ROLE_KEY: "key",
			}),
		).toThrow(/SUPABASE_URL/);
	});

	it("derives apiBaseUrl by stripping trailing slashes", () => {
		const config = readAstropressSupabaseHostedConfig({
			SUPABASE_URL: "https://x.supabase.co/",
			SUPABASE_SERVICE_ROLE_KEY: "key",
		});
		expect(config.apiBaseUrl).toBe("https://x.supabase.co/functions/v1/astropress");
	});
});
