import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import {
	createAstropressProjectAdapter,
	resolveAstropressProjectAdapterMode,
} from "../src/adapters/project.js";

describe("project adapter integration", () => {
	it("selects project adapters from runtime mode and project env", async () => {
		expect(resolveAstropressProjectAdapterMode({})).toBe("local");
		expect(
			resolveAstropressProjectAdapterMode({
				ASTROPRESS_RUNTIME_MODE: "hosted",
			}),
		).toBe("hosted");

		const workspace = await mkdtemp(
			join(tmpdir(), "astropress-project-adapter-"),
		);
		const localAdapter = createAstropressProjectAdapter({
			env: {
				ASTROPRESS_RUNTIME_MODE: "local",
				ASTROPRESS_LOCAL_PROVIDER: "supabase",
			},
			local: {
				workspaceRoot: workspace,
				dbPath: join(workspace, "project-adapter.sqlite"),
			},
		});

		expect(localAdapter.capabilities.name).toBe("supabase");

		await rm(workspace, { recursive: true, force: true });
	});

	it("trims surrounding whitespace before matching the 'hosted' mode (kills .trim removal)", () => {
		expect(
			resolveAstropressProjectAdapterMode({
				ASTROPRESS_RUNTIME_MODE: "  hosted  ",
			}),
		).toBe("hosted");
	});

	it("returns 'local' when ASTROPRESS_RUNTIME_MODE is the literal 'local'", () => {
		expect(
			resolveAstropressProjectAdapterMode({
				ASTROPRESS_RUNTIME_MODE: "local",
			}),
		).toBe("local");
	});

	it("returns 'local' when ASTROPRESS_RUNTIME_MODE is undefined (no env)", () => {
		expect(resolveAstropressProjectAdapterMode({})).toBe("local");
	});

	it("returns 'local' for any value other than 'hosted' (e.g. typo)", () => {
		expect(
			resolveAstropressProjectAdapterMode({
				ASTROPRESS_RUNTIME_MODE: "hosting",
			}),
		).toBe("local");
	});

	it("explicit options.mode overrides any env-derived mode (kills ?? to && mutant)", async () => {
		// env says hosted, but options.mode="local" should win.
		const workspace = await mkdtemp(
			join(tmpdir(), "astropress-mode-override-"),
		);
		const adapter = createAstropressProjectAdapter({
			mode: "local",
			env: {
				ASTROPRESS_RUNTIME_MODE: "hosted",
				ASTROPRESS_LOCAL_PROVIDER: "supabase",
			},
			local: {
				workspaceRoot: workspace,
				dbPath: join(workspace, "mode-override.sqlite"),
			},
		});
		expect(adapter.capabilities.name).toBe("supabase");
		await rm(workspace, { recursive: true, force: true });
	});

	it("creates a hosted adapter when mode='hosted' (kills BlockStatement/ConditionalExpression mutants on the if-branch)", () => {
		const adapter = createAstropressProjectAdapter({
			mode: "hosted",
			env: {
				ASTROPRESS_HOSTED_PROVIDER: "supabase",
				SUPABASE_URL: "https://x.supabase.co",
				SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
			},
		});
		// Hosted adapter advertises hostedAdmin capability.
		expect(adapter.capabilities.hostedAdmin).toBe(true);
	});

	it("explicit options.local.provider overrides projectEnv.localProvider (kills ?? to && in local branch)", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-local-prov-"));
		// env says sqlite; options.local.provider="supabase" must win and
		// route through the supabase-sqlite adapter (capabilities.name="supabase").
		const adapter = createAstropressProjectAdapter({
			mode: "local",
			env: { ASTROPRESS_LOCAL_PROVIDER: "sqlite" },
			local: {
				provider: "supabase",
				workspaceRoot: workspace,
				dbPath: join(workspace, "local-prov.sqlite"),
			},
		});
		expect(adapter.capabilities.name).toBe("supabase");
		await rm(workspace, { recursive: true, force: true });
	});
});
