/**
 * rust-arch-lint.ts
 *
 * Architectural fitness functions for the Rust CLI crate.
 * Enforces volatility-based module boundaries to prevent the crate from
 * regressing into a monolith.
 *
 * Rules:
 *   1. LOC limits — warn at 300, error at 600 (with explicit exemptions)
 *   2. Command isolation — commands/* files must not use each other directly
 *   3. JS bridge containment — ProcessCommand::new("node") only in js_bridge/
 *   4. Provider enum purity — providers.rs must not import from commands/ or js_bridge/
 *   5. Volatility boundary — import commands must not import from new/dev commands
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

type Violation = { file: string; rule: string; message: string };
type Warning = { file: string; rule: string; message: string };

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const root = process.cwd();
  const srcDir = join(root, "crates/astropress-cli/src");
  const allFiles = (await walk(srcDir)).filter((f) => f.endsWith(".rs"));

  const violations: Violation[] = [];
  const warnings: Warning[] = [];

  for (const file of allFiles) {
    const content = await readFile(file, "utf8");
    const display = relative(root, file);
    const filename = file.split("/").pop() ?? "";
    const lines = content.split("\n").length;
    const pathSegments = display.replace(/\\/g, "/");

    // -------------------------------------------------------------------------
    // Rule 1: LOC limits
    // -------------------------------------------------------------------------
    const LOC_WARN = 300;
    const LOC_ERROR = 600;

    // Coordinator files: dispatch + tests live here by design.
    const locExempt = new Set([
      "main.rs",      // CLI entry point + integration tests
      "args.rs",      // Coordinator: one small parse_* fn per command (structural, not algorithmic)
      "providers.rs", // Enums for all providers — grows as providers are added
      "env.rs",       // Env file R/W — stable, mechanical
      "loaders.rs",   // JS bridge loaders — one loader fn per contract type
    ]);

    if (!locExempt.has(filename)) {
      if (lines > LOC_ERROR) {
        violations.push({
          file: display,
          rule: "max-lines",
          message: `${lines} lines exceeds the ${LOC_ERROR}-line hard limit. Split into focused modules.`,
        });
      } else if (lines > LOC_WARN) {
        warnings.push({
          file: display,
          rule: "max-lines",
          message: `${lines} lines exceeds the ${LOC_WARN}-line warning threshold. Consider splitting.`,
        });
      }
    }

    // -------------------------------------------------------------------------
    // Rule 2: Command isolation
    // Command files must not import directly from other command files.
    // All inter-command shared logic must go through import_common.rs.
    // -------------------------------------------------------------------------
    const isCommandFile =
      pathSegments.includes("/commands/") &&
      filename !== "mod.rs" &&
      filename !== "import_common.rs";

    if (isCommandFile) {
      // Detect `use crate::commands::something_other_than_import_common`
      const commandImportPattern = /use\s+crate::commands::(?!import_common\b)(\w+)/g;
      let match: RegExpExecArray | null;
      while ((match = commandImportPattern.exec(content)) !== null) {
        violations.push({
          file: display,
          rule: "command-isolation",
          message: `Command file imports from another command module (crate::commands::${match[1]}). Move shared logic to commands/import_common.rs.`,
        });
      }

      // Also block super:: imports across commands (e.g. super::new inside commands/dev)
      const superCommandPattern = /use\s+super::(?:new|dev|deploy|import_wordpress|import_wix|backup_restore|doctor|services|config|sync)\b/g;
      while (superCommandPattern.exec(content) !== null) {
        violations.push({
          file: display,
          rule: "command-isolation",
          message: `Command file uses super:: to reach another command module. Route shared logic through commands/import_common.rs.`,
        });
      }
    }

    // -------------------------------------------------------------------------
    // Rule 3: JS bridge containment
    // ProcessCommand::new("node") and run_node_script-style patterns are only
    // allowed in js_bridge/ files.
    // -------------------------------------------------------------------------
    const isJsBridgeFile = pathSegments.includes("/js_bridge/");
    if (!isJsBridgeFile && content.includes('ProcessCommand::new("node")')) {
      violations.push({
        file: display,
        rule: "js-bridge-containment",
        message: `ProcessCommand::new("node") outside js_bridge/. Node subprocess execution must stay in js_bridge/ files.`,
      });
    }
    if (!isJsBridgeFile && /\brun_node_script\b/.test(content)) {
      violations.push({
        file: display,
        rule: "js-bridge-containment",
        message: `run_node_script() called outside js_bridge/. Node execution helpers must stay in js_bridge/ files.`,
      });
    }

    // -------------------------------------------------------------------------
    // Rule 4: Provider enum purity
    // providers.rs must not import from commands/ or js_bridge/.
    // The provider model is a stable dependency that nothing else should pollute.
    // -------------------------------------------------------------------------
    if (filename === "providers.rs") {
      if (/use\s+crate::commands\b/.test(content)) {
        violations.push({
          file: display,
          rule: "provider-purity",
          message: `providers.rs imports from commands/. Provider enums must not depend on command logic.`,
        });
      }
      if (/use\s+crate::js_bridge\b/.test(content)) {
        violations.push({
          file: display,
          rule: "provider-purity",
          message: `providers.rs imports from js_bridge/. Provider enums must not depend on JS bridge logic.`,
        });
      }
    }

    // -------------------------------------------------------------------------
    // Rule 5: Volatility boundary
    // Import commands (import_wordpress.rs, import_wix.rs) must not directly
    // import from new.rs or dev.rs — different volatility clusters.
    // Changes to the import pipeline should never ripple into the scaffolding
    // command, and vice versa.
    // -------------------------------------------------------------------------
    const isImportCommand =
      filename === "import_wordpress.rs" || filename === "import_wix.rs";

    if (isImportCommand) {
      if (/use\s+(?:super|crate)::(?:commands::)?(?:new\b|dev\b)/.test(content)) {
        violations.push({
          file: display,
          rule: "volatility-boundary",
          message: `Import command (${filename}) imports from new/dev command. These are different volatility clusters — route shared logic through import_common.rs.`,
        });
      }
    }

    const isNewOrDevCommand = filename === "new.rs" || filename === "dev.rs";
    if (isNewOrDevCommand && pathSegments.includes("/commands/")) {
      if (/use\s+(?:super|crate)::(?:commands::)?(?:import_wordpress\b|import_wix\b)/.test(content)) {
        violations.push({
          file: display,
          rule: "volatility-boundary",
          message: `${filename} imports from an import command. These are different volatility clusters — route shared logic through import_common.rs.`,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------
  const hasViolations = violations.length > 0;
  const hasWarnings = warnings.length > 0;

  if (hasWarnings) {
    console.log("\n⚠️  Rust Architecture Warnings:\n");
    for (const w of warnings) {
      console.log(`  [${w.rule}] ${w.file}`);
      console.log(`    ${w.message}\n`);
    }
  }

  if (hasViolations) {
    console.error("\n❌ Rust Architecture Violations:\n");
    for (const v of violations) {
      console.error(`  [${v.rule}] ${v.file}`);
      console.error(`    ${v.message}\n`);
    }
    console.error(`${violations.length} violation(s) found. Fix before committing.\n`);
    process.exit(1);
  }

  const label = hasWarnings
    ? `✅ Rust arch-lint passed (${warnings.length} warning(s)).`
    : "✅ Rust arch-lint passed.";
  console.log(label);
}

main().catch((err) => {
  console.error("rust-arch-lint failed:", err);
  process.exit(1);
});
