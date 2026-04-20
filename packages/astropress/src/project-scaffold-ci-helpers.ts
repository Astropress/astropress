import type { AstropressAppHost } from "./app-host-targets";
import type { AstropressDonationsProviders } from "./project-scaffold";

export function isStaticOnlyHost(appHost: AstropressAppHost): boolean {
	return appHost === "github-pages" || appHost === "gitlab-pages";
}

export function gitHubActionsDeployWorkflow(
	appHost: AstropressAppHost,
	requiredEnvKeys: string[],
): string {
	const install = [
		"      - uses: actions/checkout@v4",
		"      - uses: oven-sh/setup-bun@v2",
		"      - run: bun install",
		"      - run: bun run doctor:strict",
		"      - run: bun run build",
	];
	const envComment =
		requiredEnvKeys.length > 0
			? `# Required repository secrets or variables: ${requiredEnvKeys.join(", ")}`
			: "# No additional content-services secrets are required for this target.";

	let deployStep =
		'      - run: echo "Build completed. Configure your host publish step here."';
	if (appHost === "github-pages") {
		return `name: Deploy Astropress\n\non:\n  push:\n    branches:\n      - main\n  workflow_dispatch:\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n      pages: write\n      id-token: write\n    steps:\n${install.join("\n")}\n      - uses: actions/configure-pages@v5\n      - uses: actions/upload-pages-artifact@v3\n        with:\n          path: dist\n      - uses: actions/deploy-pages@v4\n`;
	}
	if (appHost === "cloudflare-pages") {
		deployStep = `      - run: bunx wrangler pages deploy dist --project-name "$PROJECT_NAME"\n        env:\n          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}\n          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}\n          PROJECT_NAME: \${{ vars.CLOUDFLARE_PAGES_PROJECT || github.event.repository.name }}`;
	} else if (appHost === "vercel") {
		deployStep = `      - run: bunx vercel pull --yes --environment=production --token "\${VERCEL_TOKEN}"\n        env:\n          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}\n          VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}\n          VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}\n      - run: bunx vercel build --prod --token "\${VERCEL_TOKEN}"\n        env:\n          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}\n          VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}\n          VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}\n      - run: bunx vercel deploy --prebuilt --prod --token "\${VERCEL_TOKEN}"\n        env:\n          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}\n          VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}\n          VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}`;
	} else if (appHost === "netlify") {
		deployStep =
			"      - run: bunx netlify deploy --dir dist --prod\n        env:\n          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}\n          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}";
	} else if (appHost === "render-static" || appHost === "render-web") {
		deployStep = `      - run: |\n          if [ -n "\${RENDER_DEPLOY_HOOK_URL}" ]; then\n            curl -fsSL -X POST "\${RENDER_DEPLOY_HOOK_URL}"\n          else\n            echo "Build completed. Connect the repo in Render or set RENDER_DEPLOY_HOOK_URL for automatic deploys."\n          fi\n        env:\n          RENDER_DEPLOY_HOOK_URL: \${{ secrets.RENDER_DEPLOY_HOOK_URL }}`;
	} else if (appHost === "railway") {
		deployStep =
			"      - run: npm install -g @railway/cli\n      - run: railway up\n        env:\n          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}";
	} else if (appHost === "fly-io") {
		deployStep =
			"      - uses: superfly/flyctl-actions/setup-flyctl@master\n      - run: flyctl deploy --remote-only\n        env:\n          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}";
	} else if (appHost === "digitalocean") {
		deployStep =
			"      - uses: digitalocean/action-doctl@v2\n        with:\n          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}\n      - run: doctl apps create-deployment ${{ secrets.DO_APP_ID }}";
	} else if (appHost === "coolify") {
		deployStep = `      - run: |\n          # Coolify deploys automatically on git push via webhooks.\n          # If you've configured a manual deploy hook, set COOLIFY_WEBHOOK_URL as a secret.\n          if [ -n "\${COOLIFY_WEBHOOK_URL}" ]; then\n            curl -fsSL -X POST "\${COOLIFY_WEBHOOK_URL}"\n          else\n            echo "Build completed. Push to your Coolify-connected branch to trigger a deploy."\n          fi\n        env:\n          COOLIFY_WEBHOOK_URL: \${{ secrets.COOLIFY_WEBHOOK_URL }}`;
	}

	return `name: Deploy Astropress\n\non:\n  push:\n    branches:\n      - main\n  workflow_dispatch:\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n${install.join("\n")}\n      - run: echo '${envComment.replace(/'/g, "'\\''")}'\n${deployStep}\n`;
}

export function gitLabPagesWorkflow(): string {
	return "image: oven/bun:1\n\npages:\n  stage: deploy\n  script:\n    - bun install\n    - bun run doctor:strict\n    - bun run build\n    - mv dist public\n  artifacts:\n    paths:\n      - public\n  only:\n    - main\n";
}

export function createAstropressConfig(appHost: AstropressAppHost): string {
	const isStatic = isStaticOnlyHost(appHost);
	const adminImport = isStatic ? "" : ", createAstropressAdminAppIntegration";
	const output = isStatic ? '"static"' : '"server"';
	const integrationLine = isStatic
		? ""
		: "\n  integrations: [createAstropressAdminAppIntegration()],";

	return [
		`import { defineConfig } from "astro/config";`,
		`import { fileURLToPath } from "node:url";`,
		`import { createAstropressViteIntegration${adminImport} } from "@astropress-diy/astropress/integration";`,
		"",
		"const viteIntegration = createAstropressViteIntegration({",
		"  localRuntimeModulesPath: fileURLToPath(",
		`    new URL("./src/astropress/local-runtime-modules.ts", import.meta.url),`,
		"  ),",
		"});",
		"",
		"export default defineConfig({",
		`  output: ${output},${integrationLine}`,
		"  vite: {",
		"    plugins: viteIntegration.plugins,",
		"    resolve: { alias: viteIntegration.aliases },",
		"  },",
		"});",
	].join("\n");
}

/** Public-site Astro config for the prod static deploy (zero admin routes). */
export function createAstropressPublicConfig(): string {
	return [
		`import { defineConfig } from "astro/config";`,
		`import { fileURLToPath } from "node:url";`,
		`import { createAstropressViteIntegration, createAstropressPublicSiteIntegration } from "@astropress-diy/astropress/integration";`,
		"",
		"const viteIntegration = createAstropressViteIntegration({",
		"  localRuntimeModulesPath: fileURLToPath(",
		`    new URL("./src/astropress/local-runtime-modules.ts", import.meta.url),`,
		"  ),",
		"});",
		"",
		"// Production static build. No /ap-admin routes, no security middleware.",
		"// See docs/guides/TWO_SITE_DEPLOY.md for the two-site topology rationale.",
		"export default defineConfig({",
		`  output: "static",`,
		"  integrations: [createAstropressPublicSiteIntegration()],",
		"  vite: {",
		"    plugins: viteIntegration.plugins,",
		"    resolve: { alias: viteIntegration.aliases },",
		"  },",
		"});",
	].join("\n");
}

export function createQualityWorkflow(): string {
	return [
		"name: Quality",
		"",
		"on:",
		"  push:",
		"    branches: [main]",
		"  pull_request:",
		"    branches: [main]",
		"",
		"jobs:",
		"  quality:",
		"    runs-on: ubuntu-latest",
		"    steps:",
		"      - uses: actions/checkout@v4",
		"      - uses: oven-sh/setup-bun@v2",
		"      - run: bun install",
		"      - run: bun run lint",
		"      - run: bun run check",
		"      - run: bun run test",
		"      - run: bun run doctor:strict",
	].join("\n");
}

export function createSecurityWorkflow(): string {
	return [
		"name: Security",
		"",
		"on:",
		"  push:",
		"    branches: [main]",
		"  pull_request:",
		"    branches: [main]",
		"  schedule:",
		`    - cron: "0 6 * * 1"`,
		"",
		"jobs:",
		"  trivy:",
		"    runs-on: ubuntu-latest",
		"    permissions:",
		"      contents: read",
		"    steps:",
		"      - uses: actions/checkout@v4",
		"      - uses: aquasecurity/trivy-action@0.28.0",
		"        with:",
		"          scan-type: fs",
		"          scan-ref: .",
		"          scanners: vuln,secret,misconfig",
		`          exit-code: '1'`,
		"          severity: CRITICAL,HIGH",
		"          ignore-unfixed: true",
		"          skip-dirs: node_modules,dist,.astro",
		"",
		"  semgrep:",
		"    runs-on: ubuntu-latest",
		"    permissions:",
		"      contents: read",
		"    steps:",
		"      - uses: actions/checkout@v4",
		"      - uses: returntocorp/semgrep-action@v1",
		"        with:",
		"          config: >-",
		"            p/owasp-top-ten",
		"            p/secrets",
		"            p/typescript",
		"            p/javascript",
		"            p/nodejs",
	].join("\n");
}

export function createDonatePage(
	donations: AstropressDonationsProviders,
	siteUrl: string,
): string {
	const providers: string[] = [];
	if (donations.giveLively) providers.push("giveLively");
	if (donations.liberapay) providers.push("liberapay");
	if (donations.pledgeCrypto) providers.push("pledgeCrypto");

	const imports = [
		`import { resolveDonationSnippets } from "@astropress-diy/astropress/donations";`,
		`import { requestOptedOutOfTracking } from "@astropress-diy/astropress/analytics";`,
		`import { getCmsConfig } from "@astropress-diy/astropress";`,
	];

	const enabledProviders = providers.map((p) => `"${p}"`).join(", ");

	return [
		"---",
		...imports,
		"const config = getCmsConfig();",
		"const optedOut = requestOptedOutOfTracking(Astro.request);",
		"const snippets = resolveDonationSnippets(config.donations, config.siteUrl, optedOut);",
		`const title = "Donate";`,
		"---",
		"",
		"<!doctype html>",
		`<html lang="en">`,
		"  <head>",
		`    <meta charset="utf-8" />`,
		`    <meta name="viewport" content="width=device-width, initial-scale=1" />`,
		"    <title>{title}</title>",
		"    {snippets.pledgeCryptoHeadScript && <Fragment set:html={snippets.pledgeCryptoHeadScript} />}",
		"    {snippets.jsonLd && (",
		`      <script type="application/ld+json" set:html={snippets.jsonLd} />`,
		"    )}",
		"  </head>",
		"  <body>",
		"    <main>",
		"      <h1>{title}</h1>",
		`      <!-- Enabled providers: ${enabledProviders} -->`,
		"      {snippets.giveLively && <Fragment set:html={snippets.giveLively} />}",
		"      {snippets.liberapay && <Fragment set:html={snippets.liberapay} />}",
		"      {snippets.pledgeCrypto && <Fragment set:html={snippets.pledgeCrypto} />}",
		"    </main>",
		"  </body>",
		"</html>",
	].join("\n");
}
