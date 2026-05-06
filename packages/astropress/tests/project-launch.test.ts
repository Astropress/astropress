import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAstropressProjectLaunchPlan } from "../src/project-launch.js";

describe("project launch", () => {
	it("builds a local launch plan with static hosting and no hosted data-services by default", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-project-launch-local-"));
		const plan = createAstropressProjectLaunchPlan({
			env: {
				ASTROPRESS_RUNTIME_MODE: "local",
				ASTROPRESS_APP_HOST: "github-pages",
				ASTROPRESS_DATA_SERVICES: "none",
			},
			local: {
				workspaceRoot: workspace,
				dbPath: join(workspace, "admin.sqlite"),
			},
		});

		expect(plan.runtime.mode).toBe("local");
		expect(plan.provider).toBe("sqlite");
		expect(plan.appHost).toBe("github-pages");
		expect(plan.dataServices).toBe("none");
		expect(plan.requiresLocalSeed).toBe(true);
		expect(plan.recommendation.appHost).toBe("github-pages");
		expect(plan.recommendation.dataServices).toBe("none");

		await rm(workspace, { recursive: true, force: true });
	});

	it("builds a hosted launch plan that separates the app host from the service layer", () => {
		const plan = createAstropressProjectLaunchPlan({
			env: {
				ASTROPRESS_RUNTIME_MODE: "hosted",
				ASTROPRESS_APP_HOST: "vercel",
				ASTROPRESS_DATA_SERVICES: "supabase",
				ASTROPRESS_HOSTED_PROVIDER: "supabase",
				SUPABASE_URL: "https://runtime.supabase.co",
				SUPABASE_SERVICE_ROLE_KEY: "service",
			},
			hosted: {
				content: {
					async list() {
						return [];
					},
					async get() {
						return null;
					},
					async save(record) {
						return record;
					},
					async delete() {},
				},
				media: {
					async put(asset) {
						return asset;
					},
					async get() {
						return null;
					},
					async delete() {},
				},
				revisions: {
					async list() {
						return [];
					},
					async append(revision) {
						return revision;
					},
				},
				auth: {
					async signIn(email) {
						return { id: "runtime-session", email, role: "admin" as const };
					},
					async signOut() {},
					async getSession(sessionId) {
						return {
							id: sessionId,
							email: "admin@example.com",
							role: "admin" as const,
						};
					},
				},
			},
		});

		expect(plan.runtime.mode).toBe("hosted");
		expect(plan.provider).toBe("supabase");
		expect(plan.appHost).toBe("vercel");
		expect(plan.dataServices).toBe("supabase");
		expect(plan.requiresLocalSeed).toBe(false);
		expect(plan.recommendation.appHost).toBe("vercel");
		expect(plan.recommendation.dataServices).toBe("supabase");
		expect(plan.deployTarget).toBe("vercel");
	});

	it("dataServices=cloudflare flows Cloudflare to recommendation.existingPlatform (kills L30 branch mutants)", async () => {
		// Local mode keeps adapter setup minimal; the recommendation engine
		// reads runtime.env.dataServices independently of the runtime mode.
		const workspace = await mkdtemp(join(tmpdir(), "astropress-project-launch-cf-"));
		const plan = createAstropressProjectLaunchPlan({
			env: {
				ASTROPRESS_RUNTIME_MODE: "local",
				ASTROPRESS_APP_HOST: "cloudflare-pages",
				ASTROPRESS_DATA_SERVICES: "cloudflare",
			},
			local: {
				workspaceRoot: workspace,
				dbPath: join(workspace, "admin.sqlite"),
			},
		});
		expect(plan.recommendation.dataServices).toBe("cloudflare");
		await rm(workspace, { recursive: true, force: true });
	});

	it("dataServices=appwrite flows Appwrite to recommendation.existingPlatform (kills L32 branch mutants)", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-project-launch-aw-"));
		const plan = createAstropressProjectLaunchPlan({
			env: {
				ASTROPRESS_RUNTIME_MODE: "local",
				ASTROPRESS_APP_HOST: "render-web",
				ASTROPRESS_DATA_SERVICES: "appwrite",
			},
			local: {
				workspaceRoot: workspace,
				dbPath: join(workspace, "admin.sqlite"),
			},
		});
		expect(plan.recommendation.dataServices).toBe("appwrite");
		await rm(workspace, { recursive: true, force: true });
	});

	it("an unknown dataServices string maps to existingPlatform='none' (kills L36 default-string mutant)", () => {
		const plan = createAstropressProjectLaunchPlan({
			env: {
				ASTROPRESS_RUNTIME_MODE: "local",
				ASTROPRESS_APP_HOST: "github-pages",
				ASTROPRESS_DATA_SERVICES: "none",
			},
		});
		// dataServices=none → existingPlatform=none + wantsHostedAdmin=false
		// + wantsStaticMirror=true (github-pages) → rec.dataServices="none".
		expect(plan.recommendation.dataServices).toBe("none");
	});

	it("local mode + gitlab-pages app host triggers wantsStaticMirror=true (kills L58 LogicalOperator mutant)", () => {
		const plan = createAstropressProjectLaunchPlan({
			env: {
				ASTROPRESS_RUNTIME_MODE: "local",
				ASTROPRESS_APP_HOST: "gitlab-pages",
				ASTROPRESS_DATA_SERVICES: "none",
			},
		});
		// Static mirror path: rec.appHost is "github-pages" (per
		// recommendAstropressProvider's wantsStaticMirror=true branch when
		// existingPlatform=none and wantsHostedAdmin=false).
		expect(plan.recommendation.appHost).toBe("github-pages");
	});

	it("provider mirrors runtime.env.localProvider in local mode (kills L44 mode-branch mutant)", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "astropress-project-launch-prov-"));
		const plan = createAstropressProjectLaunchPlan({
			env: {
				ASTROPRESS_RUNTIME_MODE: "local",
				ASTROPRESS_LOCAL_PROVIDER: "supabase",
				ASTROPRESS_APP_HOST: "github-pages",
				ASTROPRESS_DATA_SERVICES: "none",
			},
			local: {
				workspaceRoot: workspace,
				dbPath: join(workspace, "admin.sqlite"),
			},
		});
		// Local mode → provider must come from env.localProvider, not hostedProvider.
		expect(plan.provider).toBe("supabase");
		expect(plan.requiresLocalSeed).toBe(true);
		await rm(workspace, { recursive: true, force: true });
	});

	it("dataServices !== 'none' sets wantsHostedAdmin=true on the recommendation input (kills L60 mutant)", () => {
		const plan = createAstropressProjectLaunchPlan({
			env: {
				ASTROPRESS_RUNTIME_MODE: "hosted",
				ASTROPRESS_APP_HOST: "vercel",
				ASTROPRESS_DATA_SERVICES: "supabase",
				ASTROPRESS_HOSTED_PROVIDER: "supabase",
				SUPABASE_URL: "https://x.supabase.co",
				SUPABASE_SERVICE_ROLE_KEY: "test",
			},
		});
		// dataServices="supabase" (!== "none") → wantsHostedAdmin=true.
		// Combined with existingPlatform="supabase" → rec routes to supabase.
		expect(plan.recommendation.dataServices).toBe("supabase");
	});
});
