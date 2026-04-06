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
      "New projects get provider-aligned env defaults",
      "Local development reads the scaffolded env contract",
      "New-project scaffolding includes a package-owned provider recommendation",
      "Project launch planning stays package-owned",
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
      "Importing a WordPress export stages editorial inventory into Astropress import artifacts",
      "WordPress import produces inspect plan and report artifacts",
      "WordPress import can resume staged media downloads",
    ],
    steps: [
      {
        command: "bunx",
        args: ["vitest", "run", "tests/wordpress-import.contract.test.ts"],
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
      "Astropress owns the admin route inventory",
      "Astropress keeps admin actions and pages under one mount",
      "Fleet uses a local Astropress package artifact",
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
      "Hosted providers can be selected without host-app branching",
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
      "The same project can publish through first-party adapters",
      "Startup selects the correct runtime mode from one project contract",
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
