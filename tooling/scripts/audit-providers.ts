import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Verifies that every provider ID in the TypeScript type system has a corresponding
// entry in tooling/verified-providers.json. This prevents hallucinated providers
// from entering the codebase — any new provider must be added to verified-providers.json
// first, with a real URL, before it can appear in the type system.

const root = process.cwd();

type VerifiedProvider = { id: string; url: string | null };
type VerifiedProviders = { appHosts: VerifiedProvider[]; dataServices: VerifiedProvider[] };

async function extractTypeUnionValues(filePath: string, typeName: string): Promise<string[]> {
  const src = await readFile(filePath, "utf8");
  // Match: export type FooType = \n  | "a"\n  | "b"\n  ;
  const typeRegex = new RegExp(
    `export type ${typeName}\\s*=[^;]+;`,
    "s",
  );
  const match = src.match(typeRegex);
  if (!match) return [];
  return [...match[0].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

async function main() {
  const verified: VerifiedProviders = JSON.parse(
    await readFile(join(root, "tooling/verified-providers.json"), "utf8"),
  );

  const verifiedHostIds = new Set(verified.appHosts.map((p) => p.id));
  const verifiedServiceIds = new Set(verified.dataServices.map((p) => p.id));

  const appHostValues = await extractTypeUnionValues(
    join(root, "packages/astropress/src/app-host-targets.ts"),
    "AstropressAppHost",
  );
  const dataServiceValues = await extractTypeUnionValues(
    join(root, "packages/astropress/src/data-service-targets.ts"),
    "AstropressDataServices",
  );

  const violations: string[] = [];

  for (const id of appHostValues) {
    if (!verifiedHostIds.has(id)) {
      violations.push(
        `AstropressAppHost: "${id}" is not in tooling/verified-providers.json — verify it exists before adding`,
      );
    }
  }

  for (const id of dataServiceValues) {
    if (!verifiedServiceIds.has(id)) {
      violations.push(
        `AstropressDataServices: "${id}" is not in tooling/verified-providers.json — verify it exists before adding`,
      );
    }
  }

  // ── AGENTS.md must contain the no-speculative-features rule ──
  const agentsMdPath = join(root, "AGENTS.md");
  const agentsSrc = await readFile(agentsMdPath, "utf8").catch(() => "");
  if (!agentsSrc.includes("No speculative features") && !agentsSrc.includes("no-speculative-features")) {
    violations.push(
      'AGENTS.md: "No speculative features" rule is missing — contributors must be instructed never to add unverified providers',
    );
  }

  if (violations.length > 0) {
    console.error("provider audit failed:\n");
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log(
    `provider audit passed — ${appHostValues.length} app hosts, ${dataServiceValues.length} data services, all verified. AGENTS.md no-speculative-features rule present.`,
  );
}

main().catch((err) => {
  console.error("provider audit failed:", err);
  process.exit(1);
});
