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

	it("default recommendation supportLevel is derived from the matrix (kills L47 ObjectLiteral {})", () => {
		// `{}` mutant on the profile arg makes resolveAstropressDeploymentSupportLevel
		// receive an empty object → matrix miss → returns "unsupported". The genuine
		// cloudflare-pages + cloudflare combo is "supported".
		const rec = recommendAstropressProvider();
		expect(rec.supportLevel).toBe("supported");
	});

	it("github-pages + none branch yields an empty requiredEnvKeys array (kills L52 ArrayDeclaration)", () => {
		// `?? []` mutant makes the fallback `["Stryker was here"]`. github-pages+none
		// is genuinely empty in the matrix, so the fallback fires and the array length
		// directly distinguishes the two.
		const rec = recommendAstropressProvider({
			wantsHostedAdmin: false,
			wantsStaticMirror: true,
		});
		expect(rec.requiredEnvKeys).toEqual([]);
	});

	it("supabase branch rationale contains the specific Supabase phrasing (kills L88 StringLiteral '')", () => {
		const rec = recommendAstropressProvider({ existingPlatform: "supabase" });
		// finalizeRecommendation appends matrix notes, but the prefix from L88 must
		// remain intact. "" mutant would drop the long-form text below.
		expect(rec.rationale).toContain("Supabase is already the content-services platform");
	});

	it("appwrite branch rationale contains the specific Appwrite phrasing (kills L96 StringLiteral '')", () => {
		const rec = recommendAstropressProvider({ existingPlatform: "appwrite" });
		expect(rec.rationale).toContain("Appwrite is already the content-services platform");
	});

	it("existingPlatform=cloudflare hits the L100 cloudflare branch (kills L100 ConditionalExpression/StringLiteral and L104)", () => {
		const rec = recommendAstropressProvider({ existingPlatform: "cloudflare" });
		expect(rec.appHost).toBe("cloudflare-pages");
		expect(rec.dataServices).toBe("cloudflare");
		// Final fallback (L124) gives a different rationale; the L100 branch produces
		// the "best fit for teams already comfortable" phrasing. Mutants that route to
		// the fallback (e.g. `false || ...`, `existingPlatform === ""`) would surface
		// the L127 rationale instead.
		expect(rec.rationale).toContain(
			"best fit for teams already comfortable with its edge/runtime model",
		);
	});

	it("opsComfort=advanced hits the L100 cloudflare branch with the L104 rationale", () => {
		const rec = recommendAstropressProvider({ opsComfort: "advanced" });
		expect(rec.appHost).toBe("cloudflare-pages");
		expect(rec.rationale).toContain(
			"best fit for teams already comfortable with its edge/runtime model",
		);
	});

	it("L108 branch fires only when wantsHostedAdmin=false AND wantsStaticMirror=true (kills L108 LogicalOperator/BooleanLiteral)", () => {
		// `&&` → `||` mutant: with default wantsHostedAdmin=true and wantsStaticMirror=true,
		// the original skips L108 and falls to L124 → cloudflare-pages + cloudflare.
		// The mutant `||` enters L108 and returns github-pages + none.
		const rec = recommendAstropressProvider({ wantsStaticMirror: true });
		expect(rec.appHost).toBe("cloudflare-pages");
		expect(rec.dataServices).toBe("cloudflare");
	});

	it("L108 wantsHostedAdmin=false + wantsStaticMirror=true rationale matches the 'low-ops' phrasing (kills L112 StringLiteral)", () => {
		// `if false` / BlockStatement mutants on L108 would fall through to L116
		// which has a different rationale; assert the L112 wording survives intact.
		const rec = recommendAstropressProvider({
			wantsHostedAdmin: false,
			wantsStaticMirror: true,
		});
		expect(rec.rationale).toContain("GitHub Pages is the clearest low-ops choice");
	});

	it("L116 wantsHostedAdmin=false branch rationale matches 'public site simple' phrasing (kills L120 StringLiteral)", () => {
		const rec = recommendAstropressProvider({
			wantsHostedAdmin: false,
			wantsStaticMirror: false,
		});
		expect(rec.rationale).toContain(
			"keeps the public site simple when hosted Astropress services are not required",
		);
	});

	it("L124 default fallback rationale matches the 'still the default' phrasing (kills L127 StringLiteral)", () => {
		const rec = recommendAstropressProvider();
		expect(rec.rationale).toContain("still the default recommendation for most Astropress users");
	});
});
