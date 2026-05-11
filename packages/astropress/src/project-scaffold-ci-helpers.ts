import type { AstropressAppHost } from "./app-host-targets";
import type { AstropressDonationsProviders } from "./project-scaffold";
import {
	ASTRO_CONFIG_HEADER_LINES,
	ASTRO_CONFIG_VITE_BLOCK_LINES,
	ASTRO_CONFIG_VITE_FOOTER_LINES,
	ASTRO_PUBLIC_CONFIG_LINES,
	CI_INSTALL_STEPS,
	CLOUDFLARE_DEPLOY_STEP,
	COOLIFY_DEPLOY_STEP,
	DEFAULT_DEPLOY_STEP,
	DIGITALOCEAN_DEPLOY_STEP,
	DONATE_PAGE_BODY_LINES,
	DONATE_PAGE_IMPORTS,
	DONATE_PAGE_TRAILER_LINES,
	FLY_IO_DEPLOY_STEP,
	GITHUB_PAGES_WORKFLOW_PREFIX,
	GITHUB_PAGES_WORKFLOW_SUFFIX,
	GITLAB_PAGES_WORKFLOW,
	NETLIFY_DEPLOY_STEP,
	QUALITY_WORKFLOW_LINES,
	RAILWAY_DEPLOY_STEP,
	RENDER_DEPLOY_STEP,
	SECURITY_WORKFLOW_LINES,
	VERCEL_DEPLOY_STEP,
} from "./project-scaffold-ci-helpers-data";

export function isStaticOnlyHost(appHost: AstropressAppHost): boolean {
	return appHost === "github-pages" || appHost === "gitlab-pages";
}

function deployStepForHost(appHost: AstropressAppHost): string {
	switch (appHost) {
		case "cloudflare-pages":
			return CLOUDFLARE_DEPLOY_STEP;
		case "vercel":
			return VERCEL_DEPLOY_STEP;
		case "netlify":
			return NETLIFY_DEPLOY_STEP;
		case "render-static":
		case "render-web":
			return RENDER_DEPLOY_STEP;
		case "railway":
			return RAILWAY_DEPLOY_STEP;
		case "fly-io":
			return FLY_IO_DEPLOY_STEP;
		case "digitalocean":
			return DIGITALOCEAN_DEPLOY_STEP;
		case "coolify":
			return COOLIFY_DEPLOY_STEP;
		default:
			return DEFAULT_DEPLOY_STEP;
	}
}

export function gitHubActionsDeployWorkflow(
	appHost: AstropressAppHost,
	requiredEnvKeys: string[],
): string {
	const envComment =
		requiredEnvKeys.length > 0
			? `# Required repository secrets or variables: ${requiredEnvKeys.join(", ")}`
			: "# No additional content-services secrets are required for this target.";

	if (appHost === "github-pages") {
		return `${GITHUB_PAGES_WORKFLOW_PREFIX}${CI_INSTALL_STEPS.join("\n")}${GITHUB_PAGES_WORKFLOW_SUFFIX}`;
	}

	const deployStep = deployStepForHost(appHost);
	return `name: Deploy Astropress\n\non:\n  push:\n    branches:\n      - main\n  workflow_dispatch:\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n${CI_INSTALL_STEPS.join("\n")}\n      - run: echo '${envComment.replace(/'/g, "'\\''")}'\n${deployStep}\n`;
}

export function gitLabPagesWorkflow(): string {
	return GITLAB_PAGES_WORKFLOW;
}

export function createAstropressConfig(appHost: AstropressAppHost): string {
	const isStatic = isStaticOnlyHost(appHost);
	const adminImport = isStatic ? "" : ", createAstropressAdminAppIntegration";
	const output = isStatic ? '"static"' : '"server"';
	const integrationLine = isStatic
		? ""
		: "\n  integrations: [createAstropressAdminAppIntegration()],";

	return [
		...ASTRO_CONFIG_HEADER_LINES,
		`import { createAstropressViteIntegration${adminImport} } from "@astropress-diy/astropress/integration";`,
		...ASTRO_CONFIG_VITE_BLOCK_LINES,
		`  output: ${output},${integrationLine}`,
		...ASTRO_CONFIG_VITE_FOOTER_LINES,
	].join("\n");
}

/** Public-site Astro config for the prod static deploy (zero admin routes). */
export function createAstropressPublicConfig(): string {
	return ASTRO_PUBLIC_CONFIG_LINES.join("\n");
}

export function createQualityWorkflow(): string {
	return QUALITY_WORKFLOW_LINES.join("\n");
}

export function createSecurityWorkflow(): string {
	return SECURITY_WORKFLOW_LINES.join("\n");
}

export function createDonatePage(
	donations: AstropressDonationsProviders,
	_siteUrl: string,
): string {
	const providers: string[] = [];
	if (donations.giveLively) providers.push("giveLively");
	if (donations.liberapay) providers.push("liberapay");
	if (donations.pledgeCrypto) providers.push("pledgeCrypto");

	const enabledProviders = providers.map((p) => `"${p}"`).join(", ");

	return [
		"---",
		...DONATE_PAGE_IMPORTS,
		...DONATE_PAGE_BODY_LINES,
		`      <!-- Enabled providers: ${enabledProviders} -->`,
		...DONATE_PAGE_TRAILER_LINES,
	].join("\n");
}
