import { describe, expect, it, vi } from "vitest";

import {
	createAstropressSupabaseAdapter,
	createAstropressSupabaseHostedAdapter,
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

describe("createAstropressSupabaseHostedAdapter", () => {
	const env = {
		SUPABASE_URL: "https://x.supabase.co",
		SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
	};

	it("routes through the hosted-API adapter when no stores are provided and invokes fetchImpl (pins L75 condition chain)", async () => {
		const fetchImpl = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }) as never);
		const adapter = createAstropressSupabaseHostedAdapter({
			env,
			fetchImpl: fetchImpl as never,
		});
		await adapter.content.list("post");
		expect(fetchImpl).toHaveBeenCalled();
		expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("functions/v1/astropress");
		expect(adapter.capabilities.name).toBe("supabase");
	});

	it.each([
		["backingAdapter"],
		["content"],
		["media"],
		["revisions"],
		["auth"],
	] as const)("does NOT call fetchImpl when only `%s` is supplied (pins each L75 `!options.x &&` clause)", async (key) => {
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
		const adapter = createAstropressSupabaseHostedAdapter({
			env,
			...(isolated as Parameters<typeof createAstropressSupabaseHostedAdapter>[0]),
			fetchImpl: fetchImpl as never,
		});
		await adapter.content.list("post");
		expect(fetchImpl).not.toHaveBeenCalled();
	});
});
