import { describe, expect, it } from "vitest";

import {
	type AstropressDataServices,
	getAstropressDataServiceTarget,
	listAstropressDataServiceTargets,
} from "../src/data-service-targets";

describe("listAstropressDataServiceTargets", () => {
	it("returns one entry per known data service", () => {
		const all = listAstropressDataServiceTargets();
		expect(all.length).toBeGreaterThan(0);
		const ids = all.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("returns objects with the AstropressDataServiceTarget shape", () => {
		for (const t of listAstropressDataServiceTargets()) {
			expect(typeof t.id).toBe("string");
			expect(t.id.length).toBeGreaterThan(0);
			expect(typeof t.label).toBe("string");
			expect(t.label.length).toBeGreaterThan(0);
			expect(typeof t.kind).toBe("string");
			expect(typeof t.providesDatabase).toBe("boolean");
			expect(typeof t.providesObjectStorage).toBe("boolean");
			expect(typeof t.providesAuth).toBe("boolean");
			expect(typeof t.notes).toBe("string");
		}
	});
});

describe("getAstropressDataServiceTarget", () => {
	const ALL: AstropressDataServices[] = [
		"none",
		"cloudflare",
		"supabase",
		"appwrite",
		"pocketbase",
		"neon",
		"nhost",
		"turso",
		"custom",
	];

	it.each(ALL)("returns the entry whose id matches %s", (key) => {
		const t = getAstropressDataServiceTarget(key);
		expect(t).toBeDefined();
		expect(t.id).toBe(key);
	});

	it("returns the same reference for the same key", () => {
		const a = getAstropressDataServiceTarget("supabase");
		const b = getAstropressDataServiceTarget("supabase");
		expect(a).toBe(b);
	});
});
