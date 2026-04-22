import {
	getFirstPartyProviderTarget,
	listFirstPartyProviderTargets,
} from "@astropress-diy/astropress";
import { describe, expect, it } from "vitest";

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
});
