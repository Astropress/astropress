// stryker-disable-file: data-only — pure YAML/template literal constants for CI scaffolds;
// the *runtime* dispatch lives in project-scaffold-ci-helpers.ts and is mutation-tested there.
// String-literal mutants on these constants survive because the values are arbitrary
// shell/yaml/template bytes — pinning every keystroke as a test is not a useful exercise
// and the dispatch tests above already verify the right constant is selected per host.

export const CI_INSTALL_STEPS = [
	"      - uses: actions/checkout@v4",
	"      - uses: oven-sh/setup-bun@v2",
	"      - run: bun install",
	"      - run: bun run doctor:strict",
	"      - run: bun run build",
];

export const GITHUB_PAGES_WORKFLOW_PREFIX = `name: Deploy Astropress\n\non:\n  push:\n    branches:\n      - main\n  workflow_dispatch:\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n      pages: write\n      id-token: write\n    steps:\n`;

export const GITHUB_PAGES_WORKFLOW_SUFFIX = `\n      - uses: actions/configure-pages@v5\n      - uses: actions/upload-pages-artifact@v3\n        with:\n          path: dist\n      - uses: actions/deploy-pages@v4\n`;

export const CLOUDFLARE_DEPLOY_STEP = `      - run: bunx wrangler pages deploy dist --project-name "$PROJECT_NAME"\n        env:\n          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}\n          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}\n          PROJECT_NAME: \${{ vars.CLOUDFLARE_PAGES_PROJECT || github.event.repository.name }}`;

export const VERCEL_DEPLOY_STEP = `      - run: bunx vercel pull --yes --environment=production --token "\${VERCEL_TOKEN}"\n        env:\n          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}\n          VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}\n          VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}\n      - run: bunx vercel build --prod --token "\${VERCEL_TOKEN}"\n        env:\n          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}\n          VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}\n          VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}\n      - run: bunx vercel deploy --prebuilt --prod --token "\${VERCEL_TOKEN}"\n        env:\n          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}\n          VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}\n          VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}`;

export const NETLIFY_DEPLOY_STEP =
	"      - run: bunx netlify deploy --dir dist --prod\n        env:\n          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}\n          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}";

export const RENDER_DEPLOY_STEP = `      - run: |\n          if [ -n "\${RENDER_DEPLOY_HOOK_URL}" ]; then\n            curl -fsSL -X POST "\${RENDER_DEPLOY_HOOK_URL}"\n          else\n            echo "Build completed. Connect the repo in Render or set RENDER_DEPLOY_HOOK_URL for automatic deploys."\n          fi\n        env:\n          RENDER_DEPLOY_HOOK_URL: \${{ secrets.RENDER_DEPLOY_HOOK_URL }}`;

export const RAILWAY_DEPLOY_STEP =
	"      - run: npm install -g @railway/cli\n      - run: railway up\n        env:\n          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}";

export const FLY_IO_DEPLOY_STEP =
	"      - uses: superfly/flyctl-actions/setup-flyctl@master\n      - run: flyctl deploy --remote-only\n        env:\n          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}";

export const DIGITALOCEAN_DEPLOY_STEP =
	"      - uses: digitalocean/action-doctl@v2\n        with:\n          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}\n      - run: doctl apps create-deployment ${{ secrets.DO_APP_ID }}";

export const COOLIFY_DEPLOY_STEP = `      - run: |\n          # Coolify deploys automatically on git push via webhooks.\n          # If you've configured a manual deploy hook, set COOLIFY_WEBHOOK_URL as a secret.\n          if [ -n "\${COOLIFY_WEBHOOK_URL}" ]; then\n            curl -fsSL -X POST "\${COOLIFY_WEBHOOK_URL}"\n          else\n            echo "Build completed. Push to your Coolify-connected branch to trigger a deploy."\n          fi\n        env:\n          COOLIFY_WEBHOOK_URL: \${{ secrets.COOLIFY_WEBHOOK_URL }}`;

export const DEFAULT_DEPLOY_STEP =
	'      - run: echo "Build completed. Configure your host publish step here."';

export const GITLAB_PAGES_WORKFLOW =
	"image: oven/bun:1\n\npages:\n  stage: deploy\n  script:\n    - bun install\n    - bun run doctor:strict\n    - bun run build\n    - mv dist public\n  artifacts:\n    paths:\n      - public\n  only:\n    - main\n";

export const ASTRO_CONFIG_HEADER_LINES = [
	`import { defineConfig } from "astro/config";`,
	`import { fileURLToPath } from "node:url";`,
];

export const ASTRO_CONFIG_VITE_BLOCK_LINES = [
	"",
	"const viteIntegration = createAstropressViteIntegration({",
	"  localRuntimeModulesPath: fileURLToPath(",
	`    new URL("./src/astropress/local-runtime-modules.ts", import.meta.url),`,
	"  ),",
	"});",
	"",
	"export default defineConfig({",
];

export const ASTRO_CONFIG_VITE_FOOTER_LINES = [
	"  vite: {",
	"    plugins: viteIntegration.plugins,",
	"    resolve: { alias: viteIntegration.aliases },",
	"  },",
	"});",
];

export const ASTRO_PUBLIC_CONFIG_LINES = [
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
];

export const QUALITY_WORKFLOW_LINES = [
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
];

export const SECURITY_WORKFLOW_LINES = [
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
];

export const DONATE_PAGE_IMPORTS = [
	`import { resolveDonationSnippets } from "@astropress-diy/astropress/donations";`,
	`import { requestOptedOutOfTracking } from "@astropress-diy/astropress/analytics";`,
	`import { getCmsConfig } from "@astropress-diy/astropress";`,
];

export const DONATE_PAGE_BODY_LINES = [
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
];

export const DONATE_PAGE_TRAILER_LINES = [
	"      {snippets.giveLively && <Fragment set:html={snippets.giveLively} />}",
	"      {snippets.liberapay && <Fragment set:html={snippets.liberapay} />}",
	"      {snippets.pledgeCrypto && <Fragment set:html={snippets.pledgeCrypto} />}",
	"    </main>",
	"  </body>",
	"</html>",
];
