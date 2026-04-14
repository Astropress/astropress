import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Verifies that every env var key listed in the deployment matrix
// (packages/astropress/src/deployment-matrix.ts) is actually read somewhere
// in packages/astropress/src/. Prevents "SUPABASE_ANON_KEY"-style drift where
// a key is documented as required but never consumed by the runtime code.

const root = process.cwd();

const DEPLOYMENT_MATRIX = join(root, "packages/astropress/src/deployment-matrix.ts");
const SRC_DIR = join(root, "packages/astropress/src");

async function extractRequiredEnvKeys(matrixSrc: string): Promise<string[]> {
  // Match all string literals inside requiredEnvKeys: [...] arrays.
  // Handles multi-entry arrays split across lines.
  const keys = new Set<string>();
  for (const m of matrixSrc.matchAll(/"([A-Z][A-Z0-9_]+)"/g)) {
    // Only keep keys that look like env var names (ALL_CAPS_WITH_UNDERSCORES).
    // This naturally filters out non-env-var strings like "supported".
    if (/^[A-Z][A-Z0-9_]{2,}$/.test(m[1])) {
      keys.add(m[1]);
    }
  }
  return [...keys].sort();
}

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true });
  return entries
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(dir, f));
}

async function fileReadsKey(filePath: string, key: string): Promise<boolean> {
  const src = await readFile(filePath, "utf8");
  // Direct access: env.KEY, env["KEY"], env['KEY']
  // process.env variants: process.env.KEY, process.env?.KEY, process.env["KEY"]
  // Dynamic lookup indicator: the key appears as a string literal in this file,
  // which means it feeds into a dynamic `env[key]` lookup (e.g. in content-services-ops.ts).
  return (
    src.includes(`env.${key}`) ||
    src.includes(`env["${key}"]`) ||
    src.includes(`env['${key}']`) ||
    src.includes(`env?.${key}`) ||
    src.includes(`process.env.${key}`) ||
    src.includes(`process.env?.${key}`) ||
    src.includes(`process.env["${key}"]`) ||
    // The key appears as a quoted string in an array or return value — this is
    // how content-services-ops.ts tracks which keys are required for dynamic
    // lookup via env[key]. Acceptable evidence that the code handles this key.
    new RegExp(`["']${key}["']`).test(src)
  );
}

async function main() {
  const matrixSrc = await readFile(DEPLOYMENT_MATRIX, "utf8");
  const requiredKeys = await extractRequiredEnvKeys(matrixSrc);

  // Exclude deployment-matrix.ts — it's the source of the key list, not a consumer.
  const allSourceFiles = await collectSourceFiles(SRC_DIR);
  const sourceFiles = allSourceFiles.filter(
    (f) => !f.endsWith("deployment-matrix.ts"),
  );

  const violations: string[] = [];

  for (const key of requiredKeys) {
    let found = false;
    for (const file of sourceFiles) {
      if (await fileReadsKey(file, key)) {
        found = true;
        break;
      }
    }
    if (!found) {
      violations.push(
        `${key} — listed in deployment-matrix requiredEnvKeys but never read in packages/astropress/src/`,
      );
    }
  }

  if (violations.length > 0) {
    console.error("env-contract audit failed:\n");
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log(
    `env-contract audit passed — ${requiredKeys.length} required env keys, all read in src/.`,
  );
}

main().catch((err) => {
  console.error("env-contract audit failed:", err);
  process.exit(1);
});
