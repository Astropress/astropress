import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type TruthSource = {
  crypto: {
    passwordHash: string;
    tokenDigest: string;
    webhookSignature: string;
  };
  docs: {
    readmeSecurityNote: string;
    hostedE2EGap: string;
  };
  bannedPhrases: string[];
};

const root = process.cwd();
const truthPath = join(root, "tooling/readiness-truth.json");
const requiredFiles = [
  "README.md",
  "docs/EVALUATION.md",
  "packages/docs/src/content/docs/contributing/evaluation.mdx",
];
const auditableExtensions = new Set([".md", ".mdx", ".ts", ".tsx", ".astro", ".feature", ".rs", ".yml", ".yaml"]);

function isAuditableFile(file: string) {
  return [...auditableExtensions].some((ext) => file.endsWith(ext));
}

async function main() {
  const truth = JSON.parse(await readFile(truthPath, "utf8")) as TruthSource;
  const trackedFiles = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .map((file) => file.trim())
    .filter((file) => file.length > 0)
    .filter((file) => !file.startsWith("node_modules/") && isAuditableFile(file));

  const violations: string[] = [];

  for (const file of trackedFiles) {
    const body = await readFile(join(root, file), "utf8");

    for (const phrase of truth.bannedPhrases) {
      if (!body.includes(phrase)) {
        continue;
      }
      violations.push(`${file}: banned phrase "${phrase}"`);
    }
  }

  for (const file of requiredFiles) {
    const body = await readFile(join(root, file), "utf8");
    for (const required of [
      truth.crypto.passwordHash,
      truth.crypto.tokenDigest,
      truth.crypto.webhookSignature,
    ]) {
      if (!body.includes(required)) {
        violations.push(`${file}: missing required truth marker "${required}"`);
      }
    }
  }

  const readme = await readFile(join(root, "README.md"), "utf8");
  if (!readme.includes(truth.docs.readmeSecurityNote)) {
    violations.push("README.md: security note drifted from tooling/readiness-truth.json");
  }

  const evaluation = await readFile(join(root, "docs/EVALUATION.md"), "utf8");
  if (!evaluation.includes(truth.docs.hostedE2EGap)) {
    violations.push("docs/EVALUATION.md: hosted-provider gap wording drifted from tooling/readiness-truth.json");
  }

  if (violations.length > 0) {
    console.error("honesty audit failed:\n");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log("honesty audit passed.");
}

main().catch((error) => {
  console.error("honesty audit failed:", error);
  process.exit(1);
});
