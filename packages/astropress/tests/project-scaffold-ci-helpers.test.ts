import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	createAstropressConfig,
	createAstropressPublicConfig,
	createDonatePage,
	createQualityWorkflow,
	createSecurityWorkflow,
	gitHubActionsDeployWorkflow,
	gitLabPagesWorkflow,
	isStaticOnlyHost,
} from "../src/project-scaffold-ci-helpers";
import { ASTRO_STATIC_HOST_CONFIG_LINES } from "../src/project-scaffold-ci-helpers-data";

describe("isStaticOnlyHost", () => {
	it("returns true only for github-pages / gitlab-pages", () => {
		expect(isStaticOnlyHost("github-pages")).toBe(true);
		expect(isStaticOnlyHost("gitlab-pages")).toBe(true);
	});

	it("returns false for every server-capable host", () => {
		for (const host of [
			"cloudflare-pages",
			"vercel",
			"netlify",
			"render-static",
			"render-web",
			"railway",
			"fly-io",
			"digitalocean",
			"coolify",
		] as const) {
			expect(isStaticOnlyHost(host)).toBe(false);
		}
	});
});

describe("gitHubActionsDeployWorkflow", () => {
	it("emits the github-pages workflow (configure-pages + upload-pages-artifact + deploy-pages) and stops there", () => {
		const yaml = gitHubActionsDeployWorkflow("github-pages", []);
		expect(yaml).toContain("name: Deploy Astropress");
		expect(yaml).toContain("uses: actions/configure-pages@v5");
		expect(yaml).toContain("uses: actions/upload-pages-artifact@v3");
		expect(yaml).toContain("uses: actions/deploy-pages@v4");
		expect(yaml).toContain("path: dist");
		expect(yaml).toContain("permissions:");
		expect(yaml).toContain("pages: write");
		// github-pages returns its own template — none of the other host-specific deploy steps appear
		expect(yaml).not.toContain("wrangler");
		expect(yaml).not.toContain("vercel");
		expect(yaml).not.toContain("netlify");
	});

	it("includes a Cloudflare wrangler pages deploy step for cloudflare-pages", () => {
		const yaml = gitHubActionsDeployWorkflow("cloudflare-pages", ["CLOUDFLARE_API_TOKEN"]);
		expect(yaml).toContain("bunx wrangler pages deploy dist");
		expect(yaml).toContain("CLOUDFLARE_ACCOUNT_ID:");
		expect(yaml).toContain("CLOUDFLARE_API_TOKEN:");
		expect(yaml).toContain("PROJECT_NAME:");
		expect(yaml).toContain("CLOUDFLARE_PAGES_PROJECT");
	});

	it("emits Vercel CLI pull/build/deploy steps for vercel", () => {
		const yaml = gitHubActionsDeployWorkflow("vercel", []);
		expect(yaml).toContain("bunx vercel pull --yes --environment=production");
		expect(yaml).toContain("bunx vercel build --prod");
		expect(yaml).toContain("bunx vercel deploy --prebuilt --prod");
		expect(yaml).toContain("VERCEL_TOKEN:");
		expect(yaml).toContain("VERCEL_ORG_ID:");
		expect(yaml).toContain("VERCEL_PROJECT_ID:");
	});

	it("emits netlify deploy with auth-token + site-id secrets for netlify", () => {
		const yaml = gitHubActionsDeployWorkflow("netlify", []);
		expect(yaml).toContain("bunx netlify deploy --dir dist --prod");
		expect(yaml).toContain("NETLIFY_AUTH_TOKEN:");
		expect(yaml).toContain("NETLIFY_SITE_ID:");
	});

	it("emits the render deploy-hook curl block for render-static and render-web", () => {
		for (const host of ["render-static", "render-web"] as const) {
			const yaml = gitHubActionsDeployWorkflow(host, []);
			expect(yaml).toContain("RENDER_DEPLOY_HOOK_URL");
			expect(yaml).toContain("curl -fsSL -X POST");
		}
	});

	it("emits railway CLI install + up + token env for railway", () => {
		const yaml = gitHubActionsDeployWorkflow("railway", []);
		expect(yaml).toContain("npm install -g @railway/cli");
		expect(yaml).toContain("railway up");
		expect(yaml).toContain("RAILWAY_TOKEN:");
	});

	it("emits flyctl setup + deploy --remote-only for fly-io", () => {
		const yaml = gitHubActionsDeployWorkflow("fly-io", []);
		expect(yaml).toContain("superfly/flyctl-actions/setup-flyctl@master");
		expect(yaml).toContain("flyctl deploy --remote-only");
		expect(yaml).toContain("FLY_API_TOKEN:");
	});

	it("emits doctl + apps create-deployment for digitalocean", () => {
		const yaml = gitHubActionsDeployWorkflow("digitalocean", []);
		expect(yaml).toContain("digitalocean/action-doctl@v2");
		expect(yaml).toContain("doctl apps create-deployment");
		expect(yaml).toContain("DIGITALOCEAN_ACCESS_TOKEN");
		expect(yaml).toContain("DO_APP_ID");
	});

	it("emits a Coolify webhook curl block for coolify", () => {
		const yaml = gitHubActionsDeployWorkflow("coolify", []);
		expect(yaml).toContain("COOLIFY_WEBHOOK_URL");
		expect(yaml).toContain("curl -fsSL -X POST");
	});

	it("emits a default 'configure your host publish step' echo for unknown hosts", () => {
		const yaml = gitHubActionsDeployWorkflow(
			"gitlab-pages" as unknown as Parameters<typeof gitHubActionsDeployWorkflow>[0],
			[],
		);
		expect(yaml).toContain("Build completed. Configure your host publish step here.");
	});

	it("includes the required-env-keys comment when requiredEnvKeys is non-empty", () => {
		const yaml = gitHubActionsDeployWorkflow("vercel", ["VERCEL_TOKEN", "VERCEL_ORG_ID"]);
		expect(yaml).toContain("Required repository secrets or variables: VERCEL_TOKEN, VERCEL_ORG_ID");
	});

	it("includes the 'no additional secrets' comment when requiredEnvKeys is empty", () => {
		const yaml = gitHubActionsDeployWorkflow("vercel", []);
		expect(yaml).toContain("No additional content-services secrets are required for this target.");
	});

	it("install step always runs bun install, doctor:strict, and build", () => {
		const yaml = gitHubActionsDeployWorkflow("netlify", []);
		expect(yaml).toContain("uses: actions/checkout@v4");
		expect(yaml).toContain("uses: oven-sh/setup-bun@v2");
		expect(yaml).toContain("- run: bun install");
		expect(yaml).toContain("- run: bun run doctor:strict");
		expect(yaml).toContain("- run: bun run build");
	});

	it("escapes single quotes in the envComment shell echo (single-quote-in-single-quote hack)", () => {
		// Force a comment containing a literal ' to exercise the .replace(/'/g, "'\\''") hack.
		const yaml = gitHubActionsDeployWorkflow("vercel", ["O'BRIEN_SECRET"]);
		expect(yaml).toContain("Required repository secrets or variables: O'\\''BRIEN_SECRET");
	});
});

describe("gitLabPagesWorkflow", () => {
	it("emits a static `pages:` job using the oven/bun:1 image", () => {
		const yaml = gitLabPagesWorkflow();
		expect(yaml).toContain("image: oven/bun:1");
		expect(yaml).toContain("pages:");
		expect(yaml).toContain("stage: deploy");
		expect(yaml).toContain("- bun install");
		expect(yaml).toContain("- bun run doctor:strict");
		expect(yaml).toContain("- bun run build");
		expect(yaml).toContain("- mv dist public");
		expect(yaml).toContain("- public");
		expect(yaml).toContain("- main");
	});
});

describe("createAstropressConfig", () => {
	it("emits a command-aware config for github-pages: dev serves the admin, build is static", () => {
		const cfg = createAstropressConfig("github-pages");
		expect(cfg).toContain(`const isDev = process.argv.includes("dev");`);
		expect(cfg).toContain(`output: isDev ? "server" : "static",`);
		// Admin present only in the dev branch; public renderer present in both.
		// In dev the public-site integration skips the support routes the admin
		// already injects (avoids a duplicate-route collision).
		expect(cfg).toContain("createAstropressAdminAppIntegration(),");
		expect(cfg).toContain(
			"createAstropressPublicSiteIntegration({ includeSupportRoutes: false }),",
		);
		expect(cfg).toContain(": [createAstropressPublicSiteIntegration()],");
	});

	it("uses output 'server' and includes the admin integration for cloudflare-pages", () => {
		const cfg = createAstropressConfig("cloudflare-pages");
		expect(cfg).toContain(`output: "server"`);
		expect(cfg).toContain("createAstropressViteIntegration, createAstropressAdminAppIntegration");
		expect(cfg).toContain("integrations: [createAstropressAdminAppIntegration()]");
	});

	it("emits the same command-aware config for gitlab-pages (static host)", () => {
		const cfg = createAstropressConfig("gitlab-pages");
		expect(cfg).toContain(`output: isDev ? "server" : "static",`);
		expect(cfg).toContain("createAstropressPublicSiteIntegration");
	});

	it("always wires the viteIntegration into vite.plugins and vite.resolve.alias", () => {
		const cfg = createAstropressConfig("netlify");
		expect(cfg).toContain("createAstropressViteIntegration");
		expect(cfg).toContain("plugins: viteIntegration.plugins");
		expect(cfg).toContain("resolve: { alias: viteIntegration.aliases }");
	});
});

describe("createAstropressPublicConfig", () => {
	it("emits the public-site config with createAstropressPublicSiteIntegration and static output", () => {
		const cfg = createAstropressPublicConfig();
		expect(cfg).toContain(`output: "static"`);
		expect(cfg).toContain("createAstropressPublicSiteIntegration");
		expect(cfg).toContain("integrations: [createAstropressPublicSiteIntegration()]");
		expect(cfg).toContain("plugins: viteIntegration.plugins");
		expect(cfg).toContain("// Production static build");
	});
});

describe("createQualityWorkflow", () => {
	it("runs lint, check, test, and doctor:strict on push + pull_request to main", () => {
		const yaml = createQualityWorkflow();
		expect(yaml).toContain("name: Quality");
		expect(yaml).toContain("push:");
		expect(yaml).toContain("branches: [main]");
		expect(yaml).toContain("pull_request:");
		expect(yaml).toContain("- run: bun run lint");
		expect(yaml).toContain("- run: bun run check");
		expect(yaml).toContain("- run: bun run test");
		expect(yaml).toContain("- run: bun run doctor:strict");
	});
});

describe("createSecurityWorkflow", () => {
	it("schedules a weekly cron and runs trivy + semgrep with the OWASP/secrets configs", () => {
		const yaml = createSecurityWorkflow();
		expect(yaml).toContain("name: Security");
		expect(yaml).toContain(`cron: "0 6 * * 1"`);
		expect(yaml).toContain("aquasecurity/trivy-action@0.28.0");
		expect(yaml).toContain("scan-type: fs");
		expect(yaml).toContain("scanners: vuln,secret,misconfig");
		expect(yaml).toContain("severity: CRITICAL,HIGH");
		expect(yaml).toContain("returntocorp/semgrep-action@v1");
		expect(yaml).toContain("p/owasp-top-ten");
		expect(yaml).toContain("p/secrets");
		expect(yaml).toContain("p/typescript");
	});
});

describe("gitHubActionsDeployWorkflow — exact output structure", () => {
	it("github-pages output begins with `name: Deploy Astropress` and ends with deploy-pages@v4 plus a trailing newline", () => {
		const yaml = gitHubActionsDeployWorkflow("github-pages", []);
		expect(yaml.startsWith("name: Deploy Astropress\n")).toBe(true);
		expect(yaml.endsWith("- uses: actions/deploy-pages@v4\n")).toBe(true);
	});

	it("non-github-pages output ends with the host-specific deploy step plus a trailing newline", () => {
		const yaml = gitHubActionsDeployWorkflow("railway", []);
		expect(yaml.endsWith("RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}\n")).toBe(true);
	});

	it("non-github-pages output contains a literal echo wrapping the env comment in single quotes", () => {
		const yaml = gitHubActionsDeployWorkflow("vercel", []);
		expect(yaml).toContain(
			"      - run: echo '# No additional content-services secrets are required for this target.'\n",
		);
		const yaml2 = gitHubActionsDeployWorkflow("vercel", ["A_KEY"]);
		expect(yaml2).toContain(
			"      - run: echo '# Required repository secrets or variables: A_KEY'\n",
		);
	});

	it("github-pages output never includes the echo env-comment line", () => {
		const yaml = gitHubActionsDeployWorkflow("github-pages", ["A_KEY"]);
		expect(yaml).not.toContain("Required repository secrets or variables");
		expect(yaml).not.toContain("No additional content-services secrets");
	});

	it("non-github-pages workflows include `runs-on: ubuntu-latest` and a steps block, without GH-pages permissions", () => {
		const yaml = gitHubActionsDeployWorkflow("netlify", []);
		expect(yaml).toContain("runs-on: ubuntu-latest");
		expect(yaml).toContain("steps:");
		expect(yaml).not.toContain("pages: write");
		expect(yaml).not.toContain("id-token: write");
	});
});

describe("createAstropressConfig — exact integration-line behavior", () => {
	it("server output emits `integrations: [createAstropressAdminAppIntegration()],` on its own line", () => {
		const cfg = createAstropressConfig("vercel");
		expect(cfg).toContain("  integrations: [createAstropressAdminAppIntegration()],");
	});

	it("static hosts emit the command-aware `output: isDev ? ...` line", () => {
		const cfg = createAstropressConfig("github-pages");
		expect(cfg).toContain(`  output: isDev ? "server" : "static",`);
	});

	it('server hosts emit `output: "server",` followed by the integrations line', () => {
		const cfg = createAstropressConfig("vercel");
		expect(cfg).toMatch(
			/output: "server",\n {2}integrations: \[createAstropressAdminAppIntegration\(\)\],/,
		);
	});
});

describe("output is newline-joined (kill `.join` separator mutants)", () => {
	it("createAstropressPublicConfig output contains newlines", () => {
		expect(createAstropressPublicConfig()).toMatch(/\n/);
	});
	it("createQualityWorkflow output contains newlines", () => {
		expect(createQualityWorkflow()).toMatch(/\n/);
	});
	it("createSecurityWorkflow output contains newlines", () => {
		expect(createSecurityWorkflow()).toMatch(/\n/);
	});
	it("createAstropressConfig output contains newlines", () => {
		expect(createAstropressConfig("vercel")).toMatch(/\n/);
	});
	it("createAstropressConfig joins with newlines, not just the embedded one", () => {
		// The server-host config array's `output: "server",\n  integrations:` element
		// carries its own embedded newline, so a bare toMatch(/\n/) survives
		// `.join("\n")` → `.join("")`. Assert a line that only stands alone when the
		// join separator is present — the import statement between the header lines
		// and the vite block.
		expect(createAstropressConfig("vercel").split("\n")).toContain(
			`import { createAstropressViteIntegration, createAstropressAdminAppIntegration } from "@astropress-diy/astropress/integration";`,
		);
	});
	it("gitHubActionsDeployWorkflow github-pages output contains newlines around install steps", () => {
		const yaml = gitHubActionsDeployWorkflow("github-pages", []);
		// The install steps are joined with \n so two adjacent steps must have a newline between them
		expect(yaml).toContain("- uses: actions/checkout@v4\n      - uses: oven-sh/setup-bun@v2");
	});
	it("gitHubActionsDeployWorkflow non-github-pages output contains newlines around install steps", () => {
		const yaml = gitHubActionsDeployWorkflow("vercel", []);
		expect(yaml).toContain("- uses: actions/checkout@v4\n      - uses: oven-sh/setup-bun@v2");
	});
});

describe("createAstropressConfig — static-mode command-aware config", () => {
	it("imports the admin, public-site, and vite integrations for the dev/build split", () => {
		const cfg = createAstropressConfig("github-pages");
		expect(cfg).toContain("createAstropressViteIntegration,");
		expect(cfg).toContain("createAstropressAdminAppIntegration,");
		expect(cfg).toContain("createAstropressPublicSiteIntegration,");
	});
	it("emits the command-aware output line for static hosts", () => {
		const cfg = createAstropressConfig("github-pages");
		const lines = cfg.split("\n");
		const outputLine = lines.find((l) => l.startsWith("  output:"));
		expect(outputLine).toBe(`  output: isDev ? "server" : "static",`);
	});
});

describe("createDonatePage — provider-list pins", () => {
	it("empty providers list yields exactly `<!-- Enabled providers:  -->` with two spaces", () => {
		const page = createDonatePage(
			{ giveLively: false, liberapay: false, pledgeCrypto: false },
			"https://x",
		);
		expect(page).toContain("<!-- Enabled providers:  -->");
	});
	it("only-liberapay yields a single quoted entry", () => {
		const page = createDonatePage(
			{ giveLively: false, liberapay: "user", pledgeCrypto: false },
			"https://x",
		);
		expect(page).toContain(`<!-- Enabled providers: "liberapay" -->`);
	});
	it("only-pledgeCrypto yields a single quoted entry (kill conditional mutant on pledgeCrypto)", () => {
		const page = createDonatePage(
			{ giveLively: false, liberapay: false, pledgeCrypto: { btc: "addr" } },
			"https://x",
		);
		expect(page).toContain(`<!-- Enabled providers: "pledgeCrypto" -->`);
	});
	it("page output starts with the `---` frontmatter delimiter", () => {
		const page = createDonatePage({}, "https://x");
		expect(page.startsWith("---\n")).toBe(true);
	});
});

describe("createDonatePage", () => {
	it("lists only the enabled donation providers in the rendered Fragments", () => {
		const page = createDonatePage(
			{ giveLively: true, liberapay: false, pledgeCrypto: true },
			"https://example.com",
		);
		expect(page).toContain("snippets.giveLively");
		expect(page).toContain("snippets.pledgeCrypto");
		expect(page).toContain("snippets.liberapay");
		// The 'Enabled providers' comment lists ONLY the enabled keys
		expect(page).toContain(`"giveLively", "pledgeCrypto"`);
		expect(page).not.toContain(`"giveLively", "liberapay", "pledgeCrypto"`);
	});

	it("emits an empty Enabled-providers list when all flags are false", () => {
		const page = createDonatePage(
			{ giveLively: false, liberapay: false, pledgeCrypto: false },
			"https://example.com",
		);
		expect(page).toContain("Enabled providers: ");
		expect(page).not.toMatch(/Enabled providers:\s*"giveLively"/);
	});

	it("includes the resolveDonationSnippets import and getCmsConfig wiring", () => {
		const page = createDonatePage(
			{ giveLively: true, liberapay: true, pledgeCrypto: false },
			"https://example.com",
		);
		expect(page).toContain(
			`import { resolveDonationSnippets } from "@astropress-diy/astropress/donations"`,
		);
		expect(page).toContain(
			`import { requestOptedOutOfTracking } from "@astropress-diy/astropress/analytics"`,
		);
		expect(page).toContain(`import { getCmsConfig } from "@astropress-diy/astropress"`);
		expect(page).toContain("const optedOut = requestOptedOutOfTracking(Astro.request);");
		expect(page).toContain(
			"const snippets = resolveDonationSnippets(config.donations, config.siteUrl, optedOut);",
		);
	});

	it("wires the JSON-LD script and the pledgeCrypto head script when present", () => {
		const page = createDonatePage(
			{ giveLively: false, liberapay: false, pledgeCrypto: true },
			"https://example.com",
		);
		expect(page).toContain("snippets.pledgeCryptoHeadScript");
		expect(page).toContain(`<script type="application/ld+json" set:html={snippets.jsonLd}`);
	});
});

describe("static-host scaffold config parity", () => {
	// The static-host astro.config exists in two places that must stay in
	// lockstep: ASTRO_STATIC_HOST_CONFIG_LINES (emitted by createAstropressConfig
	// into a scaffolded project) and crates/astropress-cli/templates/astro.config.mjs
	// (the embedded CLI template). They differ cosmetically (tabs vs spaces), so we
	// compare a normalized form. Guards against the template-vs-generated drift
	// that caused #185.
	function normalize(source: string): string[] {
		return source
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !line.startsWith("//"))
			.map((line) => line.replace(/\s+/g, " ").replace(/,\s*$/, ""));
	}

	const templatePath = fileURLToPath(
		new URL("../../../crates/astropress-cli/templates/astro.config.mjs", import.meta.url),
	);

	it("CLI template and generated config are structurally identical (normalized)", () => {
		// Skip gracefully if the CLI crate isn't checked out alongside the package.
		if (!existsSync(templatePath)) return;
		const templateLines = normalize(readFileSync(templatePath, "utf8"));
		const generatedLines = normalize(ASTRO_STATIC_HOST_CONFIG_LINES.join("\n"));
		expect(templateLines).toEqual(generatedLines);
	});
});
