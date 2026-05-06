import { describe, expect, it } from "vitest";

import { createAstropressSupabaseAdapter } from "../../src/adapters/supabase";
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
