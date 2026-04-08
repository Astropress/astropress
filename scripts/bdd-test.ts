import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

type ScenarioDefinition = {
  featurePath: string;
  title: string;
};

type VerificationGroup = {
  label: string;
  scenarios: string[];
  steps: Array<{
    command: string;
    args: string[];
    cwd?: string;
  }>;
};

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const featuresRoot = path.join(repoRoot, "features");
const astropressPackageRoot = path.join(repoRoot, "packages", "astropress");

function walkFeatureFiles(root: string, files: string[] = []) {
  for (const entry of readdirSync(root)) {
    const fullPath = path.join(root, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      walkFeatureFiles(fullPath, files);
      continue;
    }

    if (fullPath.endsWith(".feature")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function readFeatureScenarios() {
  const scenarios: ScenarioDefinition[] = [];

  for (const featureFile of walkFeatureFiles(featuresRoot)) {
    const relativePath = path.relative(repoRoot, featureFile).replaceAll(path.sep, "/");
    const lines = readFileSync(featureFile, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("Scenario:")) {
        scenarios.push({
          featurePath: relativePath,
          title: trimmed.slice("Scenario:".length).trim(),
        });
      }
    }
  }

  return scenarios;
}

async function runStep(step: VerificationGroup["steps"][number]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(step.command, step.args, {
      cwd: step.cwd ?? repoRoot,
      stdio: "inherit",
      env: process.env,
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if ((code ?? 1) === 0) {
        resolve();
        return;
      }
      reject(new Error(`${step.command} ${step.args.join(" ")} exited with code ${code ?? 1}`));
    });
  });
}

const verificationGroups: VerificationGroup[] = [
  {
    label: "admin customization scenarios",
    scenarios: [
      "Hosts can rename package-owned admin copy without forking the app",
      "Hosts can replace simple admin brand assets without copying templates",
      "Hosts can restyle package-owned admin pages without copying them",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/admin-ui.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "non-technical admin scenarios",
    scenarios: [
      "Admin edits a page through the package-owned editor without using git",
      "Admin manages redirects and opens the media library from the same admin panel",
    ],
    steps: [
      {
        command: "bun",
        args: ["run", "test:accessibility:admin-harness"],
      },
    ],
  },
  {
    label: "project bootstrap scenarios",
    scenarios: [
      "A developer running astropress new gets pre-filled environment variables for their chosen provider",
      "A developer can start local development immediately after running astropress new",
      "A developer creating a new project sees recommended hosting pairings matched to their chosen database",
      "A developer gets a generated DEPLOY.md with deploy steps specific to their chosen hosting provider",
    ],
    steps: [
      {
        command: "bunx",
        args: [
          "vitest",
          "run",
          "tests/project-scaffold.test.ts",
          "tests/project-env.test.ts",
          "tests/project-runtime.test.ts",
          "tests/project-launch.test.ts",
          "tests/provider-choice.test.ts",
          "tests/project-adapter.integration.test.ts",
        ],
        cwd: astropressPackageRoot,
      },
      {
        command: "cargo",
        args: ["test"],
      },
    ],
  },
  {
    label: "wordpress import scenarios",
    scenarios: [
      "An operator can review all imported posts and pages before they go live",
      "An operator receives a human-readable report after running astropress import wordpress",
      "An operator can resume an interrupted import without re-downloading already-saved media",
      "Content from WordPress with unusual status values is imported in a valid editorial state",
      "Special characters in WordPress content survive the import unchanged",
      "An operator receives a JSON report file summarising the import for automation and logging",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/wordpress-import.contract.test.ts", "tests/wordpress-import-branches.test.ts"],
        cwd: astropressPackageRoot,
      },
      {
        command: "cargo",
        args: ["test", "stages_wordpress_imports"],
      },
    ],
  },
  {
    label: "operator backup and health scenarios",
    scenarios: [
      "Operators can export and restore a packaged project snapshot",
      "Operators can diagnose missing local secrets and paths",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "exports_and_imports_project_snapshots"],
      },
      {
        command: "cargo",
        args: ["test", "doctor_reports_missing_local_runtime_warnings"],
      },
    ],
  },
  {
    label: "admin mounting and consumer scenarios",
    scenarios: [
      "An admin can reach any section of the panel through the /ap-admin base path",
      "All admin form submissions stay within /ap-admin so operators expose one path in production",
      "A developer consuming AstroPress from a local package gets the same admin panel as a published install",
      "A developer consuming AstroPress from a local package gets the same routes as a published install",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/admin-routes.test.ts", "tests/tooling-integration.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "hosted provider selection scenarios",
    scenarios: [
      "A developer can switch to a hosted database provider without modifying any application code",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/hosted-provider.contract.test.ts", "tests/project-adapter.integration.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "provider portability scenarios",
    scenarios: [
      "A developer can move their site from one hosting provider to another by changing environment variables",
      "A deployed site connects to the right database based on environment variables alone",
    ],
    steps: [
      {
        command: "bunx",
        args: [
          "vitest",
          "run",
          "tests/local-provider.integration.test.ts",
          "tests/cloudflare-provider.integration.test.ts",
          "tests/deploy-and-sync.contract.test.ts",
          "tests/hosted-provider.contract.test.ts",
          "tests/project-adapter.integration.test.ts",
        ],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "sync command scenarios",
    scenarios: [
      "sync export produces a versioned content snapshot",
      "sync import applies a content snapshot to the local database",
      "sync export produces git-committable output",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/deploy-and-sync.contract.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "content persistence scenarios",
    scenarios: [
      "An editor's post status change is saved and immediately visible to all admin users",
      "An admin can see the file size of each uploaded image in the media library",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/cloudflare-adapter-full.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "wix live-site fetch scenarios",
    scenarios: [
      "Operator provides URL and is prompted for Wix credentials",
      "Successful blog post export via headless browser",
      "Crawl Wix pages not available in the blog export",
      "Wix login rejects invalid credentials",
      "Wix requires phone verification (2FA)",
      "CAPTCHA blocks automated Wix login",
      "Published site URL does not match any Wix account blog",
      "Page crawler reports failed pages without aborting the import",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/import/fetch-wix.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "wordpress live-site fetch scenarios",
    scenarios: [
      "Operator provides URL and is prompted for credentials",
      "Operator provides a credentials file to skip the prompt",
      "Successful export download via headless browser",
      "Also crawl site pages not included in the XML export",
      "Unreachable site reports DNS or connection failure verbosely",
      "URL is reachable but not a WordPress site",
      "Wrong credentials produce a clear login failure message",
      "Two-factor authentication blocks automated login",
      "CAPTCHA on login page prevents automated login",
      "Authenticated user lacks export permissions",
      "Interrupted media download resumes without re-fetching completed files",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/import/fetch-wordpress.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "playwright crawl mode scenarios",
    scenarios: [
      "Default --crawl-pages uses fast fetch mode",
      "--crawl-pages=playwright uses full browser crawl",
      "Playwright crawl handles navigation errors gracefully",
      "crawlSitePagesWithBrowser is exported from page-crawler module",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/import/page-crawler.test.ts"],
        cwd: astropressPackageRoot,
      },
      {
        command: "cargo",
        args: ["test", "parses_crawl_modes"],
      },
    ],
  },
  {
    label: "email newsletter integration scenarios",
    scenarios: [
      "Listmonk admin is accessible from the Services tab",
      "Subscriber endpoint forwards to Listmonk API",
      "Import pipeline can extract WordPress subscribers",
      "Listmonk service appears in scaffold prompts",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/newsletter-adapter.test.ts", "tests/services-config.test.ts"],
        cwd: astropressPackageRoot,
      },
      {
        command: "bunx",
        args: ["vitest", "run", "tests/wordpress-import.contract.test.ts"],
        cwd: astropressPackageRoot,
      },
      {
        command: "cargo",
        args: ["test", "listmonk_generates_api_env_entries"],
      },
    ],
  },
  {
    label: "service tabs admin scenarios",
    scenarios: [
      "Services hub page shows all registered services",
      "Service provider page embeds the external admin UI in an iframe",
      "Navigating directly to an unconfigured provider returns a graceful error",
      "Services nav item appears in the sidebar for admin users",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/services-config.test.ts", "tests/admin-routes.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "service scaffold scenarios",
    scenarios: [
      "Interactive mode presents CMS choices",
      "Choosing Payload generates a payload.config.ts stub",
      "Choosing Keystatic generates a keystatic.config.ts stub",
      "Choosing Medusa generates a medusa-config.js stub",
      "Choosing Listmonk generates env entries",
      "Plain mode uses defaults without prompting",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "commands::new::tests"],
      },
      {
        command: "cargo",
        args: ["test", "strips_plain_flag_from_args"],
      },
    ],
  },
  {
    label: "post-import verification and telemetry scenarios",
    scenarios: [
      "Happy path skips feedback entirely",
      "Choosing \"c\" triggers browser crawl",
      "Choosing \"n\" offers a multi-select feedback form",
      "User declines to share feedback",
      "User consents to share feedback",
      "Consent is remembered so the prompt only appears once",
      "Plain mode skips all interactive prompts",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "strips_plain_flag_from_args"],
      },
      {
        command: "cargo",
        args: ["test", "stages_wordpress_imports"],
      },
      {
        command: "cargo",
        args: ["test", "parses_crawl_modes"],
      },
    ],
  },
  {
    label: "publishing and deployment scenarios",
    scenarios: [
      "A developer deploying to GitHub Pages gets a generated Actions workflow",
      "A developer deploying to Vercel or Cloudflare Pages uses provider-specific deploy scripts",
      "A developer can see which hosting and database combinations are fully supported",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/deploy-targets.test.ts", "tests/deployment-matrix.test.ts", "tests/deploy-and-sync.contract.test.ts"],
        cwd: astropressPackageRoot,
      },
      {
        command: "cargo",
        args: ["test", "deploy_script_selection_prefers_targeted_scripts"],
      },
    ],
  },
  {
    label: "comment moderation scenarios",
    scenarios: [
      "A moderator approves a pending reader comment so it appears on the post",
      "A moderator rejects a spam comment so it is removed",
      "A moderator can manage comments through the package-owned comment repository",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/comment-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "redirect management scenarios",
    scenarios: [
      "An admin creates a redirect from an old URL to a new one",
      "An admin deletes a redirect that is no longer needed",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/redirect-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "contact form submission scenarios",
    scenarios: [
      "A visitor submits the contact form and their message is saved for the admin to read",
      "An admin can browse all contact submissions in the admin panel",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/submission-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "safe content rendering scenarios",
    scenarios: [
      "A reader viewing an imported post is not exposed to injected scripts",
      "An editor pasting external HTML cannot introduce cross-site scripting",
      "Off-screen images on a long post load lazily so the page appears quickly",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/html-sanitization.test.ts", "tests/html-optimization.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "site settings scenarios",
    scenarios: [
      "An admin updates the site title and the change is persisted",
      "Site settings are preserved across restarts",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/settings-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "multilingual content scenarios",
    scenarios: [
      "A reader can switch to the translated version of a page",
      "Search engines can discover all language versions through hreflang tags",
      "An editor can see which translated pages are current and which are out of date",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/locale-links.test.ts", "tests/translation-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "taxonomy scenarios",
    scenarios: [
      "An editor assigns a category to a post and the post appears in that category's listing",
      "An editor can add new taxonomy terms and remove obsolete ones",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/taxonomy-repository-factory.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "user authentication scenarios",
    scenarios: [
      "An admin logs in with their password and gets access to the panel",
      "A session expires so that unattended logins do not remain active",
      "An admin can reset a forgotten password via an emailed link",
      "An admin can invite a new editor who sets their own password on first login",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/auth-repository-factory.test.ts", "tests/user-repository-factory.test.ts", "tests/admin-safety.test.ts"],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "site security and bot protection scenarios",
    scenarios: [
      "Admin pages cannot be embedded in an external site's iframe",
      "An API client that sends too many requests in a short window is throttled",
      "A bot submitting the contact form without solving CAPTCHA is rejected",
      "Admin pages use a stricter Content-Security-Policy than public pages",
    ],
    steps: [
      {
        command: "bunx",
        args: [
          "vitest",
          "run",
          "tests/security-headers.test.ts",
          "tests/security-middleware.test.ts",
          "tests/rate-limit-repository-factory.test.ts",
          "tests/cloudflare-adapter-security.test.ts",
        ],
        cwd: astropressPackageRoot,
      },
    ],
  },
  {
    label: "local development server scenarios",
    scenarios: [
      "A developer starts the local preview server with a single command",
      "A developer sees the admin credentials in the terminal on first run",
      "The CLI accepts a deploy target override from the environment",
    ],
    steps: [
      {
        command: "cargo",
        args: ["test", "parses_top_level_commands"],
      },
      {
        command: "cargo",
        args: ["test", "scaffolds_new_project_from_example"],
      },
      {
        command: "cargo",
        args: ["test", "deploy_target_prefers_explicit_env_target"],
      },
    ],
  },
  {
    label: "service health and diagnostics scenarios",
    scenarios: [
      "An operator verifies that content services are reachable before going live",
      "An operator is told exactly which environment variables are missing",
      "An operator is warned when admin passwords are still set to weak placeholder values",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/content-services-ops.test.ts"],
        cwd: astropressPackageRoot,
      },
      {
        command: "cargo",
        args: ["test", "bootstraps_and_verifies_content_services"],
      },
      {
        command: "cargo",
        args: ["test", "doctor_flags_weak_or_scaffolded_secrets"],
      },
    ],
  },
];

const scenarios = readFeatureScenarios();
const featureScenarioTitles = new Set(scenarios.map((scenario) => scenario.title));
const coveredScenarioTitles = new Set(verificationGroups.flatMap((group) => group.scenarios));
const unassignedScenarios = scenarios.filter((scenario) => !coveredScenarioTitles.has(scenario.title));
const unknownScenarioTitles = [...coveredScenarioTitles].filter((title) => !featureScenarioTitles.has(title));

if (unassignedScenarios.length > 0 || unknownScenarioTitles.length > 0) {
  const issues = [
    ...unassignedScenarios.map((scenario) => `Unassigned scenario: ${scenario.featurePath} -> ${scenario.title}`),
    ...unknownScenarioTitles.map((title) => `Verification references unknown scenario: ${title}`),
  ];
  console.error("BDD execution map is incomplete:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

for (const group of verificationGroups) {
  console.log(`Running ${group.label}...`);
  for (const step of group.steps) {
    await runStep(step);
  }

  for (const scenarioTitle of group.scenarios) {
    const scenario = scenarios.find((candidate) => candidate.title === scenarioTitle);
    console.log(`  PASS ${scenario?.featurePath ?? "features"} :: ${scenarioTitle}`);
  }
}

console.log(`BDD execution passed for ${scenarios.length} scenarios across ${verificationGroups.length} verification groups.`);
