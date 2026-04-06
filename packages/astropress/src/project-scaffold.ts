import type { AstropressAppHost } from "./app-host-targets";
import type { AstropressDataServices } from "./data-service-targets";
import {
  getAstropressDeploymentMatrixEntry,
  resolveAstropressDeploymentSupportLevel,
} from "./deployment-matrix";

export type AstropressScaffoldProvider = "sqlite" | "supabase" | "runway";

export interface AstropressProjectScaffoldInput {
  appHost?: AstropressAppHost;
  dataServices?: AstropressDataServices;
  legacyProvider?: AstropressScaffoldProvider;
}

export interface AstropressProjectScaffold {
  provider: AstropressScaffoldProvider;
  appHost: AstropressAppHost;
  dataServices: AstropressDataServices;
  contentServices: AstropressDataServices;
  recommendedDeployTarget: string;
  recommendationRationale: string;
  supportLevel: string;
  localEnv: Record<string, string>;
  envExample: Record<string, string>;
  packageScripts: Record<string, string>;
  ciFiles: Record<string, string>;
  deployDoc: string;
  requiredEnvKeys: string[];
}

function randomSecret(bytes = 24) {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");
}

function createLocalBootstrapSecrets() {
  return {
    ADMIN_PASSWORD: `local-admin-${randomSecret(18)}`,
    EDITOR_PASSWORD: `local-editor-${randomSecret(18)}`,
    SESSION_SECRET: randomSecret(32),
  };
}

function deriveLegacyProvider(dataServices: AstropressDataServices): AstropressScaffoldProvider {
  if (dataServices === "supabase") {
    return "supabase";
  }
  if (dataServices === "runway") {
    return "runway";
  }
  return "sqlite";
}

function defaultAdminDbPath(provider: AstropressScaffoldProvider) {
  if (provider === "supabase") {
    return ".data/supabase-admin.sqlite";
  }
  if (provider === "runway") {
    return ".data/runway-admin.sqlite";
  }
  return ".data/admin.sqlite";
}

function appHostToDeployTarget(appHost: AstropressAppHost) {
  return appHost === "cloudflare-pages" ? "cloudflare" : appHost;
}

function defaultServiceOrigin(dataServices: AstropressDataServices) {
  switch (dataServices) {
    case "supabase":
      return "https://your-project.supabase.co/functions/v1/astropress";
    case "firebase":
      return "https://your-project.firebaseapp.com/astropress-api";
    case "appwrite":
      return "https://cloud.appwrite.io/v1/functions/astropress";
    case "cloudflare":
      return "https://your-project.pages.dev/api/astropress";
    case "runway":
      return "https://runway.example/your-project/astropress-api";
    case "pocketbase":
      return "https://your-pocketbase.example.com/api/astropress";
    case "nhost":
      return "https://your-subdomain.nhost.run/v1/functions/astropress";
    case "neon":
      return "https://your-service.example.com/astropress";
    case "custom":
      return "https://your-service.example.com/astropress";
    default:
      return "";
  }
}

function resolveProfile(
  input: AstropressProjectScaffoldInput | AstropressScaffoldProvider,
): { appHost: AstropressAppHost; dataServices: AstropressDataServices; provider: AstropressScaffoldProvider } {
  if (typeof input === "string") {
    if (input === "supabase") {
      return { appHost: "vercel", dataServices: "supabase", provider: "supabase" };
    }
    if (input === "runway") {
      return { appHost: "runway", dataServices: "runway", provider: "runway" };
    }
    return { appHost: "github-pages", dataServices: "none", provider: "sqlite" };
  }

  const dataServices = input.dataServices ?? (input.legacyProvider === "supabase"
    ? "supabase"
    : input.legacyProvider === "runway"
      ? "runway"
      : "none");
  return {
    appHost:
      input.appHost ??
      (dataServices === "cloudflare"
        ? "cloudflare-pages"
        : dataServices === "supabase"
          ? "vercel"
          : dataServices === "runway"
            ? "runway"
            : dataServices === "firebase" || dataServices === "appwrite" || dataServices === "pocketbase"
              ? "render-web"
              : "github-pages"),
    dataServices,
    provider: input.legacyProvider ?? deriveLegacyProvider(dataServices),
  };
}

function baseLocalEnv(
  provider: AstropressScaffoldProvider,
  appHost: AstropressAppHost,
  dataServices: AstropressDataServices,
) {
  return {
    ASTROPRESS_APP_HOST: appHost,
    ASTROPRESS_CONTENT_SERVICES: dataServices,
    ADMIN_DB_PATH: defaultAdminDbPath(provider),
    ...createLocalBootstrapSecrets(),
  };
}

function baseEnvExample(
  provider: AstropressScaffoldProvider,
  appHost: AstropressAppHost,
  dataServices: AstropressDataServices,
) {
  return {
    ASTROPRESS_APP_HOST: appHost,
    ASTROPRESS_CONTENT_SERVICES: dataServices,
    ADMIN_DB_PATH: defaultAdminDbPath(provider),
    ADMIN_PASSWORD: "replace-with-a-generated-local-admin-password",
    EDITOR_PASSWORD: "replace-with-a-generated-local-editor-password",
    SESSION_SECRET: "replace-with-a-long-random-session-secret",
  };
}

function buildDataServiceExample(dataServices: AstropressDataServices): Record<string, string> {
  const serviceOrigin = defaultServiceOrigin(dataServices);
  switch (dataServices) {
    case "supabase":
      return {
        ASTROPRESS_SERVICE_ORIGIN: serviceOrigin,
        SUPABASE_URL: "https://your-project.supabase.co",
        SUPABASE_ANON_KEY: "replace-me",
        SUPABASE_SERVICE_ROLE_KEY: "replace-me",
      };
    case "firebase":
      return {
        ASTROPRESS_SERVICE_ORIGIN: serviceOrigin,
        FIREBASE_PROJECT_ID: "replace-me",
        FIREBASE_CLIENT_EMAIL: "replace-me",
        FIREBASE_PRIVATE_KEY: "replace-me",
      };
    case "appwrite":
      return {
        ASTROPRESS_SERVICE_ORIGIN: serviceOrigin,
        APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
        APPWRITE_PROJECT_ID: "replace-me",
        APPWRITE_API_KEY: "replace-me",
      };
    case "cloudflare":
      return {
        ASTROPRESS_SERVICE_ORIGIN: serviceOrigin,
        CLOUDFLARE_ACCOUNT_ID: "replace-me",
        CLOUDFLARE_API_TOKEN: "replace-me",
      };
    case "runway":
      return {
        ASTROPRESS_SERVICE_ORIGIN: serviceOrigin,
        RUNWAY_API_TOKEN: "replace-me",
        RUNWAY_PROJECT_ID: "replace-me",
      };
    case "pocketbase":
      return {
        ASTROPRESS_SERVICE_ORIGIN: serviceOrigin,
        POCKETBASE_URL: "https://your-pocketbase.example.com",
        POCKETBASE_EMAIL: "replace-me",
        POCKETBASE_PASSWORD: "replace-me",
      };
    case "nhost":
      return {
        ASTROPRESS_SERVICE_ORIGIN: serviceOrigin,
        NHOST_SUBDOMAIN: "replace-me",
        NHOST_REGION: "replace-me",
        NHOST_ADMIN_SECRET: "replace-me",
      };
    case "neon":
      return {
        ASTROPRESS_SERVICE_ORIGIN: serviceOrigin,
        NEON_DATABASE_URL: "postgres://replace-me",
      };
    case "custom":
      return {
        ASTROPRESS_SERVICE_ORIGIN: serviceOrigin,
      };
    default:
      return {};
  }
}

function createPackageScripts(appHost: AstropressAppHost) {
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
    case "firebase-hosting":
      scripts["deploy:firebase-hosting"] = "firebase deploy --only hosting";
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

function gitHubActionsDeployWorkflow(
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
  } else if (appHost === "firebase-hosting") {
    deployStep = `      - run: bunx firebase-tools deploy --only hosting\n        env:\n          FIREBASE_TOKEN: \${{ secrets.FIREBASE_TOKEN }}`;
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

function createCiFiles(appHost: AstropressAppHost, requiredEnvKeys: string[]) {
  if (appHost === "gitlab-pages") {
    return {
      ".gitlab-ci.yml": gitLabPagesWorkflow(),
    };
  }

  return {
    ".github/workflows/deploy-astropress.yml": gitHubActionsDeployWorkflow(appHost, requiredEnvKeys),
  };
}

function createDeployDoc(
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

${envList}${serviceOriginNote}
## CI

- A deploy workflow was generated for the selected app host.
- The workflow always installs dependencies, runs \`astropress doctor --strict\`, and builds before publishing.
- For Render, deployment is automatic only if \`RENDER_DEPLOY_HOOK_URL\` is configured.

## Scope

- The App Host only publishes the Astro web app and admin shell.
- Content Services hold content, media, sessions, and the Astropress service API.
- If Content Services are not \`none\`, deployment is incomplete until those service credentials and \`ASTROPRESS_SERVICE_ORIGIN\` are configured.
`;
}

export function createAstropressProjectScaffold(
  input: AstropressProjectScaffoldInput | AstropressScaffoldProvider = "sqlite",
): AstropressProjectScaffold {
  const profile = resolveProfile(input);
  const supportLevel = resolveAstropressDeploymentSupportLevel({
    appHost: profile.appHost,
    dataServices: profile.dataServices,
  });
  const matrixEntry = getAstropressDeploymentMatrixEntry({
    appHost: profile.appHost,
    dataServices: profile.dataServices,
  });
  const recommendationRationale =
    matrixEntry?.notes ??
    `Astropress does not yet mark ${profile.appHost} + ${profile.dataServices} as a first-class pair. Keep this combination in preview until you validate the missing runtime and operational pieces yourself.`;
  const requiredEnvKeys = matrixEntry?.requiredEnvKeys ?? [];

  return {
    provider: profile.provider,
    appHost: profile.appHost,
    dataServices: profile.dataServices,
    contentServices: profile.dataServices,
    recommendedDeployTarget: appHostToDeployTarget(profile.appHost),
    recommendationRationale,
    supportLevel,
    localEnv: baseLocalEnv(profile.provider, profile.appHost, profile.dataServices),
    envExample: {
      ...baseEnvExample(profile.provider, profile.appHost, profile.dataServices),
      ...buildDataServiceExample(profile.dataServices),
    },
    packageScripts: createPackageScripts(profile.appHost),
    ciFiles: createCiFiles(profile.appHost, requiredEnvKeys),
    deployDoc: createDeployDoc(profile.appHost, profile.dataServices, supportLevel, requiredEnvKeys),
    requiredEnvKeys,
  };
}
