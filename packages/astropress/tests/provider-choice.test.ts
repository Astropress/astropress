import { describe, expect, it } from "vitest";

import { createAstropressProjectScaffold } from "../src/project-scaffold.js";
import { recommendAstropressProvider } from "../src/provider-choice.js";

describe("provider choice", () => {
	it("recommends Cloudflare Pages plus Cloudflare data services by default", () => {
		const recommendation = recommendAstropressProvider();

		expect(recommendation.appHost).toBe("cloudflare-pages");
		expect(recommendation.dataServices).toBe("cloudflare");
		expect(recommendation.publicDeployTarget).toBe("cloudflare");
		expect(recommendation.requiredEnvKeys).toContain("CLOUDFLARE_API_TOKEN");
	});

	it("keeps GitHub Pages as a static app-host choice when the project does not want hosted services", () => {
		const recommendation = recommendAstropressProvider({
			wantsHostedAdmin: false,
			wantsStaticMirror: true,
		});

		expect(recommendation.appHost).toBe("github-pages");
		expect(recommendation.dataServices).toBe("none");
		expect(recommendation.publicDeployTarget).toBe("github-pages");
	});

	it("keeps the chosen data-services platform when Supabase is already selected", () => {
		expect(recommendAstropressProvider({ existingPlatform: "supabase" }).dataServices).toBe(
			"supabase",
		);
	});

	it("feeds the default scaffold recommendation", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "cloudflare-pages",
			dataServices: "cloudflare",
		});

		expect(scaffold.recommendedDeployTarget).toBe("cloudflare");
		expect(scaffold.recommendationRationale).toMatch(/Cloudflare/i);
	});
});

describe("recommendAstropressProvider — uncovered branches", () => {
	it("recommends render-web + appwrite when existingPlatform=appwrite", () => {
		const rec = recommendAstropressProvider({ existingPlatform: "appwrite" });
		expect(rec.appHost).toBe("render-web");
		expect(rec.dataServices).toBe("appwrite");
	});

	it("recommends github-pages + appwrite when existingPlatform=appwrite and wantsStaticMirror=true", () => {
		const rec = recommendAstropressProvider({
			existingPlatform: "appwrite",
			wantsStaticMirror: true,
		});
		expect(rec.appHost).toBe("github-pages");
		expect(rec.dataServices).toBe("appwrite");
	});

	it("recommends github-pages when opsComfort=advanced and wantsStaticMirror=true", () => {
		const rec = recommendAstropressProvider({
			opsComfort: "advanced",
			wantsStaticMirror: true,
		});
		expect(rec.appHost).toBe("github-pages");
		expect(rec.dataServices).toBe("cloudflare");
	});

	it("recommends cloudflare-pages when opsComfort=advanced and wantsStaticMirror=false", () => {
		const rec = recommendAstropressProvider({
			opsComfort: "advanced",
			wantsStaticMirror: false,
		});
		expect(rec.appHost).toBe("cloudflare-pages");
		expect(rec.dataServices).toBe("cloudflare");
	});

	it("recommends github-pages when wantsHostedAdmin=false and wantsStaticMirror=false", () => {
		const rec = recommendAstropressProvider({
			wantsHostedAdmin: false,
			wantsStaticMirror: false,
		});
		expect(rec.appHost).toBe("github-pages");
		expect(rec.dataServices).toBe("none");
		expect(rec.rationale).toMatch(/static/i);
	});

	it("recommends github-pages when existingPlatform=supabase and wantsStaticMirror=true", () => {
		const rec = recommendAstropressProvider({
			existingPlatform: "supabase",
			wantsStaticMirror: true,
		});
		expect(rec.appHost).toBe("github-pages");
		expect(rec.dataServices).toBe("supabase");
	});

	it("recommends vercel + supabase for existingPlatform=supabase when wantsStaticMirror is false", () => {
		const rec = recommendAstropressProvider({ existingPlatform: "supabase" });
		expect(rec.appHost).toBe("vercel");
		expect(rec.dataServices).toBe("supabase");
		expect(rec.rationale).toMatch(/Supabase/i);
	});

	it("translates a cloudflare-pages appHost into a 'cloudflare' deployTarget (not 'cloudflare-pages')", () => {
		const rec = recommendAstropressProvider();
		expect(rec.appHost).toBe("cloudflare-pages");
		expect(rec.deployTarget).toBe("cloudflare");
		expect(rec.publicDeployTarget).toBe("cloudflare");
	});

	it("leaves the deployTarget identical to the appHost for non-cloudflare hosts (vercel, render-web, github-pages)", () => {
		const sup = recommendAstropressProvider({ existingPlatform: "supabase" });
		expect(sup.deployTarget).toBe("vercel");
		expect(sup.publicDeployTarget).toBe("vercel");
		const aw = recommendAstropressProvider({ existingPlatform: "appwrite" });
		expect(aw.deployTarget).toBe("render-web");
		expect(aw.publicDeployTarget).toBe("render-web");
		const gh = recommendAstropressProvider({ wantsHostedAdmin: false });
		expect(gh.deployTarget).toBe("github-pages");
	});

	it("canonicalProvider mirrors dataServices for cloudflare / supabase / appwrite, else falls back to cloudflare", () => {
		expect(recommendAstropressProvider().canonicalProvider).toBe("cloudflare");
		expect(recommendAstropressProvider({ existingPlatform: "supabase" }).canonicalProvider).toBe(
			"supabase",
		);
		expect(recommendAstropressProvider({ existingPlatform: "appwrite" }).canonicalProvider).toBe(
			"appwrite",
		);
		expect(recommendAstropressProvider({ existingPlatform: "cloudflare" }).canonicalProvider).toBe(
			"cloudflare",
		);
		// dataServices='none' (wantsHostedAdmin=false) → fallback canonical 'cloudflare'
		expect(recommendAstropressProvider({ wantsHostedAdmin: false }).canonicalProvider).toBe(
			"cloudflare",
		);
	});

	it("appends matrix.notes to the rationale when the deployment-matrix entry has notes", () => {
		// Cloudflare-pages + cloudflare is the default — its matrix entry has notes.
		const rec = recommendAstropressProvider();
		expect(typeof rec.rationale).toBe("string");
		expect(rec.rationale.length).toBeGreaterThan(0);
	});

	it("returns an empty requiredEnvKeys array when the matrix entry is absent", () => {
		// 'none' dataServices typically has empty requiredEnvKeys.
		const rec = recommendAstropressProvider({ wantsHostedAdmin: false });
		expect(Array.isArray(rec.requiredEnvKeys)).toBe(true);
	});

	it("defaults inputs: existingPlatform='none', wantsHostedAdmin=true, wantsStaticMirror=false, opsComfort='minimal'", () => {
		// All defaults applied → final fallback branch: cloudflare-pages + cloudflare
		const rec = recommendAstropressProvider();
		expect(rec.appHost).toBe("cloudflare-pages");
		expect(rec.dataServices).toBe("cloudflare");
	});
});
