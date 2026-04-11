import type { AstropressAppHost } from "./app-host-targets";
import type { AstropressDataServices } from "./data-service-targets";
import { appHostToDeployTarget } from "./project-scaffold-env";

export function createPackageScripts(appHost: AstropressAppHost) {
  const scripts: Record<string, string> = {
    dev: "astro dev",
    build: "astro build",
    check: "astro check",
    "doctor:strict": "astropress doctor --strict",
  };

  switch (appHost) {
    case "cloudflare-pages":
      scripts["deploy:cloudflare"] = "wrangler pages deploy dist --commit-dirty=true";
      scripts["build:cloudflare-production"] = "astro build";
      break;
    case "vercel":
      scripts["deploy:vercel"] = "vercel build && vercel deploy --prebuilt --prod --yes";
      break;
    case "netlify":
      scripts["deploy:netlify"] = "netlify deploy --dir dist --prod";
      break;
    case "render-static":
      scripts["deploy:render-static"] = "astro build";
      break;
    case "render-web":
      scripts["deploy:render-web"] = "astro build";
      break;
    case "gitlab-pages":
      scripts["deploy:gitlab-pages"] = "astro build";
      break;
    case "runway":
      scripts["deploy:runway"] = "astro build";
      break;
    case "custom":
      scripts["deploy:custom"] = "astro build";
      break;
    default:
      break;
  }

  return scripts;
}

function gitHubActionsDeployWorkflow(appHost: AstropressAppHost, requiredEnvKeys: string[]): string {
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

  let deployStep = "      - run: echo \"Build completed. Configure your host publish step here.\"";
  if (appHost === "github-pages") {
    return `name: Deploy Astropress\n\non:\n  push:\n    branches:\n      - main\n  workflow_dispatch:\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n      pages: write\n      id-token: write\n    steps:\n${install.join("\n")}\n      - uses: actions/configure-pages@v5\n      - uses: actions/upload-pages-artifact@v3\n        with:\n          path: dist\n      - uses: actions/deploy-pages@v4\n`;
  }
  if (appHost === "cloudflare-pages") {
    deployStep = `      - run: bunx wrangler pages deploy dist --project-name "$PROJECT_NAME"\n        env:\n          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}\n          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}\n          PROJECT_NAME: \${{ vars.CLOUDFLARE_PAGES_PROJECT || github.event.repository.name }}`;
  } else if (appHost === "vercel") {
    deployStep = `      - run: bunx vercel pull --yes --environment=production --token "\${VERCEL_TOKEN}"\n        env:\n          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}\n          VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}\n          VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}\n      - run: bunx vercel build --prod --token "\${VERCEL_TOKEN}"\n        env:\n          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}\n          VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}\n          VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}\n      - run: bunx vercel deploy --prebuilt --prod --token "\${VERCEL_TOKEN}"\n        env:\n          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}\n          VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}\n          VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}`;
  } else if (appHost === "netlify") {
    deployStep = `      - run: bunx netlify deploy --dir dist --prod\n        env:\n          NETLIFY_AUTH_TOKEN: \${{ secrets.NETLIFY_AUTH_TOKEN }}\n          NETLIFY_SITE_ID: \${{ secrets.NETLIFY_SITE_ID }}`;
  } else if (appHost === "render-static" || appHost === "render-web") {
    deployStep = `      - run: |\n          if [ -n "\${RENDER_DEPLOY_HOOK_URL}" ]; then\n            curl -fsSL -X POST "\${RENDER_DEPLOY_HOOK_URL}"\n          else\n            echo "Build completed. Connect the repo in Render or set RENDER_DEPLOY_HOOK_URL for automatic deploys."\n          fi\n        env:\n          RENDER_DEPLOY_HOOK_URL: \${{ secrets.RENDER_DEPLOY_HOOK_URL }}`;
  } else if (appHost === "runway") {
    deployStep = `      - run: echo "Build completed. Finish the Runway publish step with your normal platform workflow."`;
  }

  return `name: Deploy Astropress\n\non:\n  push:\n    branches:\n      - main\n  workflow_dispatch:\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n${install.join("\n")}\n      - run: echo '${envComment.replace(/'/g, "'\\''")}'\n${deployStep}\n`;
}

function gitLabPagesWorkflow(): string {
  return `image: oven/bun:1\n\npages:\n  stage: deploy\n  script:\n    - bun install\n    - bun run doctor:strict\n    - bun run build\n    - mv dist public\n  artifacts:\n    paths:\n      - public\n  only:\n    - main\n`;
}

export function createCiFiles(appHost: AstropressAppHost, requiredEnvKeys: string[]) {
  if (appHost === "gitlab-pages") {
    return { ".gitlab-ci.yml": gitLabPagesWorkflow() };
  }
  return { ".github/workflows/deploy-astropress.yml": gitHubActionsDeployWorkflow(appHost, requiredEnvKeys) };
}

export function createDeployDoc(
  appHost: AstropressAppHost,
  dataServices: AstropressDataServices,
  supportLevel: string,
  requiredEnvKeys: string[],
) {
  const deployTarget = appHostToDeployTarget(appHost);
  const envList = requiredEnvKeys.length === 0
    ? "- No extra Content Services secrets are required.\n"
    : requiredEnvKeys.map((key) => `- \`${key}\``).join("\n") + "\n";
  const serviceOriginNote = dataServices === "none"
    ? ""
    : `- Set \`ASTROPRESS_SERVICE_ORIGIN\` to the Astropress service endpoint for your ${dataServices} setup.\n`;

  return `# Deploy Astropress

This project is scaffolded for:

- App Host: \`${appHost}\`
- Content Services: \`${dataServices}\`
- Support level: \`${supportLevel}\`
- Deploy target: \`${deployTarget}\`

## Local checks

Run these before pushing:

\`\`\`bash
bun install
bun run doctor:strict
bun run build
\`\`\`

## Required secrets and variables

${envList}${serviceOriginNote}## CI

- A deploy workflow was generated for the selected app host.
- The workflow always installs dependencies, runs \`astropress doctor --strict\`, and builds before publishing.
- For Render, deployment is automatic only if \`RENDER_DEPLOY_HOOK_URL\` is configured.

## Scope

- The App Host only publishes the Astro web app and admin shell.
- Content Services hold content, media, sessions, and the Astropress service API.
- If Content Services are not \`none\`, deployment is incomplete until those service credentials and \`ASTROPRESS_SERVICE_ORIGIN\` are configured.
`;
}
