import { describe, expect, it } from "vitest";

import type { ProviderKind } from "../src/platform-contracts";
import {
	getFirstPartyProviderTarget,
	listFirstPartyProviderTargets,
} from "../src/provider-targets";

describe("provider targets", () => {
	it("includes the required first-party providers for v1", () => {
		const providers = listFirstPartyProviderTargets().map(
			(provider) => provider.id,
		);
		expect(providers).toEqual(
			expect.arrayContaining(["github-pages", "cloudflare", "supabase"]),
		);
	});

	it("describes github pages as a static publish target without a database", () => {
		const provider = getFirstPartyProviderTarget("github-pages");
		expect(provider.runtime).toBe("static");
		expect(provider.capabilities.staticPublishing).toBe(true);
		expect(provider.capabilities.database).toBe(false);
		expect(provider.capabilities.gitSync).toBe(true);
	});

	it("describes cloudflare and supabase as admin-capable runtimes", () => {
		for (const providerId of ["cloudflare", "supabase"] as const) {
			const provider = getFirstPartyProviderTarget(providerId);
			expect(provider.adminSurface).toBe("astropress");
			expect(provider.capabilities.hostedAdmin).toBe(true);
			expect(provider.capabilities.database).toBe(true);
		}
	});

	it("listFirstPartyProviderTargets returns no duplicates", () => {
		const ids = listFirstPartyProviderTargets().map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("entries carry the FirstPartyProviderTarget shape", () => {
		for (const t of listFirstPartyProviderTargets()) {
			expect(typeof t.id).toBe("string");
			expect(t.id.length).toBeGreaterThan(0);
			expect(typeof t.label).toBe("string");
			expect(typeof t.runtime).toBe("string");
			expect(typeof t.canonicalDeploySurface).toBe("string");
			expect(["astropress", "provider-managed"]).toContain(t.adminSurface);
		}
	});

	const ALL: ProviderKind[] = [
		"github-pages",
		"cloudflare",
		"supabase",
		"custom",
	];

	it.each(ALL)("getFirstPartyProviderTarget — id matches for %s", (key) => {
		const t = getFirstPartyProviderTarget(key);
		expect(t).toBeDefined();
		expect(t.id).toBe(key);
	});

	it("returns the same reference across calls for the same key", () => {
		const a = getFirstPartyProviderTarget("cloudflare");
		const b = getFirstPartyProviderTarget("cloudflare");
		expect(a).toBe(b);
	});
});
