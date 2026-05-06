import { describe, expect, it } from "vitest";

import {
	type AstropressAppHost,
	getAstropressAppHostTarget,
	listAstropressAppHosts,
} from "../src/app-host-targets";

describe("listAstropressAppHosts", () => {
	it("returns one entry per known app host", () => {
		const all = listAstropressAppHosts();
		expect(all.length).toBeGreaterThan(0);
		const ids = all.map((t) => t.id);
		// Use Set: the accessor must return entries (not the keys), so each
		// entry has a unique id matching its key.
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("returns objects with the AstropressAppHostTarget shape (id, label, runtime, etc.)", () => {
		for (const t of listAstropressAppHosts()) {
			expect(typeof t.id).toBe("string");
			expect(t.id.length).toBeGreaterThan(0);
			expect(typeof t.label).toBe("string");
			expect(t.label.length).toBeGreaterThan(0);
			expect(typeof t.runtime).toBe("string");
			expect(typeof t.supportsStatic).toBe("boolean");
			expect(typeof t.supportsServerRuntime).toBe("boolean");
			expect(typeof t.notes).toBe("string");
		}
	});
});

describe("getAstropressAppHostTarget", () => {
	const ALL_HOSTS: AstropressAppHost[] = [
		"github-pages",
		"cloudflare-pages",
		"vercel",
		"netlify",
		"render-static",
		"render-web",
		"gitlab-pages",
		"fly-io",
		"coolify",
		"digitalocean",
		"railway",
		"custom",
	];

	it.each(ALL_HOSTS)("returns the entry whose id matches %s", (host) => {
		const t = getAstropressAppHostTarget(host);
		expect(t).toBeDefined();
		expect(t.id).toBe(host);
	});

	it("returns the same reference for the same key (no per-call cloning)", () => {
		const a = getAstropressAppHostTarget("vercel");
		const b = getAstropressAppHostTarget("vercel");
		expect(a).toBe(b);
	});
});
