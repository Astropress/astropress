import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const featuresRoot = path.join(repoRoot, "features");

type Scenario = {
  title: string;
  hasGiven: boolean;
  hasWhen: boolean;
  hasThen: boolean;
};

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

function validateFeatureFile(featureFile: string) {
  const content = readFileSync(featureFile, "utf8");
  const lines = content.split(/\r?\n/);
  const errors: string[] = [];
  const relativePath = path.relative(repoRoot, featureFile).replaceAll(path.sep, "/");

  let featureTitle = "";
  let currentScenario: Scenario | null = null;
  const scenarios: Scenario[] = [];

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith("Feature:")) {
      featureTitle = trimmed.slice("Feature:".length).trim();
      if (!featureTitle) {
        errors.push(`${relativePath}:${index + 1} has an empty Feature title.`);
      }
      continue;
    }

    if (trimmed.startsWith("Scenario:")) {
      currentScenario = {
        title: trimmed.slice("Scenario:".length).trim(),
        hasGiven: false,
        hasWhen: false,
        hasThen: false,
      };
      if (!currentScenario.title) {
        errors.push(`${relativePath}:${index + 1} has an empty Scenario title.`);
      }
      scenarios.push(currentScenario);
      continue;
    }

    if (!currentScenario) {
      errors.push(`${relativePath}:${index + 1} contains steps outside a Scenario.`);
      continue;
    }

    if (trimmed.startsWith("Given ")) {
      currentScenario.hasGiven = true;
    } else if (trimmed.startsWith("When ")) {
      currentScenario.hasWhen = true;
    } else if (trimmed.startsWith("Then ")) {
      currentScenario.hasThen = true;
    } else if (
      trimmed.startsWith("And ") ||
      trimmed.startsWith("But ")
    ) {
      continue;
    } else {
      errors.push(`${relativePath}:${index + 1} contains an unsupported line: ${trimmed}`);
    }
  }

  if (!featureTitle) {
    errors.push(`${relativePath} is missing a Feature title.`);
  }

  if (scenarios.length === 0) {
    errors.push(`${relativePath} does not define any scenarios.`);
  }

  for (const scenario of scenarios) {
    if (!scenario.hasGiven || !scenario.hasWhen || !scenario.hasThen) {
      errors.push(
        `${relativePath} scenario "${scenario.title}" must include at least one Given, When, and Then step.`,
      );
    }
  }

  return { featureTitle, scenarios, errors, relativePath };
}

const featureFiles = walkFeatureFiles(featuresRoot);
const validationResults = featureFiles.map(validateFeatureFile);
const allErrors = validationResults.flatMap((result) => result.errors);
const seenTitles = new Set<string>();

for (const result of validationResults) {
  if (seenTitles.has(result.featureTitle)) {
    allErrors.push(`Duplicate Feature title found: "${result.featureTitle}"`);
    continue;
  }

  if (result.featureTitle) {
    seenTitles.add(result.featureTitle);
  }
}

if (allErrors.length > 0) {
  console.error("BDD lint failed:");
  for (const error of allErrors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `BDD lint passed for ${featureFiles.length} feature files and ${validationResults.reduce((count, result) => count + result.scenarios.length, 0)} scenarios.`,
);
