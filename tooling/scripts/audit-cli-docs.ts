import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Verifies that every command documented in crates/astropress-cli/README.md
// has a corresponding Command::* match arm in main.rs. Prevents documented
// commands from drifting ahead of (or behind) the implementation.

const root = process.cwd();

const CLI_README = join(root, "crates/astropress-cli/README.md");
const MAIN_RS = join(root, "crates/astropress-cli/src/main.rs");

// Known aliases: a documented name that is handled by the same variant as the
// canonical name. The audit passes if the canonical variant is present.
const ALIAS_CANONICAL: Record<string, string> = {
  init: "new",
};

// Commands whose documented name maps to more than one variant. The audit
// passes if ANY of the listed variants is present in main.rs.
const MULTI_VARIANT: Record<string, string[]> = {
  list: ["ListTools", "ListProviders"],
};

// Words that require custom PascalCase conversion (not just capitalize-first).
const WORD_MAP: Record<string, string> = {
  wordpress: "WordPress",
  wix: "Wix",
};

function toVariantName(cmd: string): string {
  return cmd
    .split(" ")
    .map((w) => WORD_MAP[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function extractDocumentedCommands(readme: string): string[] {
  const commands: string[] = [];
  for (const line of readme.split("\n")) {
    if (!line.startsWith("### ")) continue;
    // Extract all backtick-quoted strings from the heading line.
    // Handles "### `new` / `init`" → ["new", "init"]
    // and "### `import wordpress`" → ["import wordpress"]
    const matches = [...line.matchAll(/`([^`]+)`/g)];
    for (const m of matches) {
      const name = m[1].trim();
      if (name) commands.push(name);
    }
  }
  return commands;
}

function extractCommandVariants(mainRs: string): Set<string> {
  // Match "Command::VariantName" patterns in the source.
  const variants = new Set<string>();
  for (const m of mainRs.matchAll(/Command::(\w+)/g)) {
    variants.add(m[1]);
  }
  return variants;
}

async function main() {
  const [readme, mainRs] = await Promise.all([
    readFile(CLI_README, "utf8"),
    readFile(MAIN_RS, "utf8"),
  ]);

  const documented = extractDocumentedCommands(readme);
  const variants = extractCommandVariants(mainRs);

  const violations: string[] = [];

  for (const cmd of documented) {
    // Resolve aliases to their canonical name.
    const canonical = ALIAS_CANONICAL[cmd] ?? cmd;

    // Commands that map to multiple variants (e.g. "list" → ListTools | ListProviders).
    if (MULTI_VARIANT[canonical]) {
      const expected = MULTI_VARIANT[canonical];
      const found = expected.some((v) => variants.has(v));
      if (!found) {
        violations.push(
          `"${cmd}" (documented) — expected at least one of Command::${expected.join(" | Command::")} in main.rs, found none`,
        );
      }
      continue;
    }

    // Standard single-variant check.
    const variant = toVariantName(canonical);
    if (!variants.has(variant)) {
      violations.push(
        `"${cmd}" (documented) — expected Command::${variant} in main.rs, not found`,
      );
    }
  }

  if (violations.length > 0) {
    console.error("cli-docs audit failed:\n");
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log(
    `cli-docs audit passed — ${documented.length} documented commands, all have Command::* handlers.`,
  );
}

main().catch((err) => {
  console.error("cli-docs audit failed:", err);
  process.exit(1);
});
