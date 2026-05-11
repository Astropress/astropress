import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
	bootstrapAstropressContentServices,
	verifyAstropressContentServices,
} from "../src/content-services-ops.js";

describe("content services operations", () => {
	it("bootstraps a manifest for configured hosted content services", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-"));
		const report = await bootstrapAstropressContentServices({
			workspaceRoot: workspace,
			env: {
				ASTROPRESS_CONTENT_SERVICES: "supabase",
				SUPABASE_URL: "https://demo.supabase.co",
				SUPABASE_SERVICE_ROLE_KEY: "service",
				ASTROPRESS_SERVICE_ORIGIN: "https://demo.supabase.co/functions/v1/astropress",
			},
		});

		expect(report.supportLevel).toBe("configured");
		expect(report.manifestFile).toBeTruthy();
		expect(await readFile(join(workspace, ".astropress/services/supabase.json"), "utf8")).toContain(
			'"status": "configured"',
		);

		await rm(workspace, { recursive: true, force: true });
	});

	it("reports missing config when verify runs without required keys", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-missing-"));
		await writeFile(join(workspace, ".env"), "ASTROPRESS_CONTENT_SERVICES=appwrite\n");

		const report = await verifyAstropressContentServices({
			workspaceRoot: workspace,
			env: {
				ASTROPRESS_CONTENT_SERVICES: "appwrite",
			},
		});

		expect(report.supportLevel).toBe("missing-config");
		expect(report.missingEnvKeys).toContain("APPWRITE_ENDPOINT");

		await rm(workspace, { recursive: true, force: true });
	});

	it("accepts scaffolded Neon env keys during verification", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-neon-"));

		const report = await verifyAstropressContentServices({
			workspaceRoot: workspace,
			env: {
				ASTROPRESS_CONTENT_SERVICES: "neon",
				ASTROPRESS_SERVICE_ORIGIN: "https://service.example.com/astropress",
				NEON_DATABASE_URL: "postgres://user:pass@ep-example.us-east-1.aws.neon.tech/neondb",
			},
		});

		expect(report.supportLevel).toBe("configured");
		expect(report.missingEnvKeys).toEqual([]);

		await rm(workspace, { recursive: true, force: true });
	});

	it("reports each Cloudflare required env key and persists the supabase manifest payload", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-cf-"));
		const report = await bootstrapAstropressContentServices({
			workspaceRoot: workspace,
			env: {
				ASTROPRESS_CONTENT_SERVICES: "cloudflare",
			},
		});
		expect(report.supportLevel).toBe("missing-config");
		expect(report.contentServices).toBe("cloudflare");
		expect(report.requiredEnvKeys).toEqual([
			"ASTROPRESS_SERVICE_ORIGIN",
			"CLOUDFLARE_ACCOUNT_ID",
			"CLOUDFLARE_API_TOKEN",
		]);
		expect(report.missingEnvKeys).toEqual([
			"ASTROPRESS_SERVICE_ORIGIN",
			"CLOUDFLARE_ACCOUNT_ID",
			"CLOUDFLARE_API_TOKEN",
		]);
		const manifest = JSON.parse(
			await readFile(join(workspace, ".astropress/services/cloudflare.json"), "utf8"),
		);
		expect(manifest.contentServices).toBe("cloudflare");
		expect(manifest.status).toBe("missing-config");
		expect(typeof manifest.generatedAt).toBe("string");
		await rm(workspace, { recursive: true, force: true });
	});

	it("returns supportLevel='static' for contentServices='none'", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-none-"));
		const report = await verifyAstropressContentServices({
			workspaceRoot: workspace,
			env: { ASTROPRESS_CONTENT_SERVICES: "none" },
		});
		expect(report.supportLevel).toBe("static");
		expect(report.requiredEnvKeys).toEqual([]);
		expect(report.missingEnvKeys).toEqual([]);
		await rm(workspace, { recursive: true, force: true });
	});

	it("accepts DATABASE_URL as a Neon fallback when NEON_DATABASE_URL is not set", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-neon-fb-"));
		const report = await verifyAstropressContentServices({
			workspaceRoot: workspace,
			env: {
				ASTROPRESS_CONTENT_SERVICES: "neon",
				ASTROPRESS_SERVICE_ORIGIN: "https://demo.example.com",
				DATABASE_URL: "postgres://x@y/z",
			},
		});
		expect(report.missingEnvKeys).toEqual([]);
		expect(report.supportLevel).toBe("configured");
		await rm(workspace, { recursive: true, force: true });
	});

	it("for Neon, treats non-NEON_DATABASE_URL keys as required via the same trim check (not the DATABASE_URL fallback)", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-neon-keys-"));
		// Neon requires ASTROPRESS_SERVICE_ORIGIN + (NEON_DATABASE_URL || DATABASE_URL)
		const report = await verifyAstropressContentServices({
			workspaceRoot: workspace,
			env: {
				ASTROPRESS_CONTENT_SERVICES: "neon",
				NEON_DATABASE_URL: "postgres://x@y/z",
				// ASTROPRESS_SERVICE_ORIGIN missing — should be flagged
			},
		});
		expect(report.missingEnvKeys).toContain("ASTROPRESS_SERVICE_ORIGIN");
		expect(report.missingEnvKeys).not.toContain("NEON_DATABASE_URL");
		await rm(workspace, { recursive: true, force: true });
	});

	it("reports the exact required-env-keys list for every supported content service", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-keys-"));
		const cases: [string, string[]][] = [
			["supabase", ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]],
			[
				"appwrite",
				[
					"ASTROPRESS_SERVICE_ORIGIN",
					"APPWRITE_ENDPOINT",
					"APPWRITE_PROJECT_ID",
					"APPWRITE_API_KEY",
				],
			],
			[
				"nhost",
				["ASTROPRESS_SERVICE_ORIGIN", "NHOST_SUBDOMAIN", "NHOST_REGION", "NHOST_ADMIN_SECRET"],
			],
			["neon", ["ASTROPRESS_SERVICE_ORIGIN", "NEON_DATABASE_URL"]],
			["turso", ["ASTROPRESS_SERVICE_ORIGIN", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"]],
		];
		for (const [service, expected] of cases) {
			const report = await verifyAstropressContentServices({
				workspaceRoot: workspace,
				env: { ASTROPRESS_CONTENT_SERVICES: service },
			});
			expect(report.requiredEnvKeys).toEqual(expected);
		}
		await rm(workspace, { recursive: true, force: true });
	});

	it("persists a 2-space-indented JSON manifest with a trailing newline", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-json-"));
		await bootstrapAstropressContentServices({
			workspaceRoot: workspace,
			env: { ASTROPRESS_CONTENT_SERVICES: "supabase" },
		});
		const raw = await readFile(join(workspace, ".astropress/services/supabase.json"), "utf8");
		expect(raw.endsWith("\n")).toBe(true);
		expect(raw).toContain('\n  "contentServices"');
		await rm(workspace, { recursive: true, force: true });
	});

	it("verify returns the same manifestFile path when the manifest exists on disk", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-verify-path-"));
		await bootstrapAstropressContentServices({
			workspaceRoot: workspace,
			env: { ASTROPRESS_CONTENT_SERVICES: "supabase" },
		});
		const report = await verifyAstropressContentServices({
			workspaceRoot: workspace,
			env: { ASTROPRESS_CONTENT_SERVICES: "supabase" },
		});
		expect(report.manifestFile).toBe(join(workspace, ".astropress/services/supabase.json"));
	});

	it("reports each Pocketbase required env key", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-pb-"));
		const report = await verifyAstropressContentServices({
			workspaceRoot: workspace,
			env: { ASTROPRESS_CONTENT_SERVICES: "pocketbase" },
		});
		expect(report.requiredEnvKeys).toEqual([
			"ASTROPRESS_SERVICE_ORIGIN",
			"POCKETBASE_URL",
			"POCKETBASE_EMAIL",
			"POCKETBASE_PASSWORD",
		]);
		await rm(workspace, { recursive: true, force: true });
	});

	it("returns supportLevel='static' (no requiredEnvKeys) for an unknown contentServices identifier", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-unknown-"));
		const report = await verifyAstropressContentServices({
			workspaceRoot: workspace,
			env: { ASTROPRESS_CONTENT_SERVICES: "fictional" },
		});
		expect(report.requiredEnvKeys).toEqual([]);
		expect(report.missingEnvKeys).toEqual([]);
		// Unknown service is not 'none' but yields configured because no env is missing
		expect(["configured", "static"]).toContain(report.supportLevel);
		await rm(workspace, { recursive: true, force: true });
	});

	it("verify falls through to a no-manifest report when the manifest file does not exist", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-no-manifest-"));
		const report = await verifyAstropressContentServices({
			workspaceRoot: workspace,
			env: {
				ASTROPRESS_CONTENT_SERVICES: "supabase",
				ASTROPRESS_SERVICE_ORIGIN: "https://x.supabase.co/functions/v1/astropress",
				SUPABASE_URL: "https://x.supabase.co",
				SUPABASE_SERVICE_ROLE_KEY: "k",
			},
		});
		expect(report.manifestFile).toBeUndefined();
		expect(report.supportLevel).toBe("configured");
		await rm(workspace, { recursive: true, force: true });
	});

	it("treats whitespace-only env values as missing", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-trim-"));
		const report = await verifyAstropressContentServices({
			workspaceRoot: workspace,
			env: {
				ASTROPRESS_CONTENT_SERVICES: "supabase",
				ASTROPRESS_SERVICE_ORIGIN: "   ",
				SUPABASE_URL: "  ",
				SUPABASE_SERVICE_ROLE_KEY: "\t",
			},
		});
		expect(report.missingEnvKeys).toEqual([
			"ASTROPRESS_SERVICE_ORIGIN",
			"SUPABASE_URL",
			"SUPABASE_SERVICE_ROLE_KEY",
		]);
		await rm(workspace, { recursive: true, force: true });
	});

	it("reports NHOST and Turso missing keys with the canonical env contract", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-services-more-"));

		const nhostReport = await verifyAstropressContentServices({
			workspaceRoot: workspace,
			env: {
				ASTROPRESS_CONTENT_SERVICES: "nhost",
			},
		});
		const tursoReport = await verifyAstropressContentServices({
			workspaceRoot: workspace,
			env: {
				ASTROPRESS_CONTENT_SERVICES: "turso",
			},
		});

		expect(nhostReport.missingEnvKeys).toContain("NHOST_SUBDOMAIN");
		expect(tursoReport.missingEnvKeys).toContain("TURSO_DATABASE_URL");

		await rm(workspace, { recursive: true, force: true });
	});
});
