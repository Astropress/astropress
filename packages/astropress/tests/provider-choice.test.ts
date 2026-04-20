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
		expect(
			recommendAstropressProvider({ existingPlatform: "supabase" })
				.dataServices,
		).toBe("supabase");
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
});
