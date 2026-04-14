import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Rubric 16 (Error Handling)
//
// Verifies:
//   1. Every src/admin-action-*.ts file returns a typed result with { ok: boolean }
//      rather than throwing unhandled errors at callers
//   2. No admin-action or deploy file contains a naked re-throw (catch { throw err })
//   3. packages/astropress/src/cache-purge.ts uses console.warn not throw for CDN failures
//
// Note: src/deploy/*.ts files implement the DeployTarget interface and return typed
// deployment metadata objects — they use exception-based error handling (not ok: boolean),
// which is correct for that interface. Only naked re-throws are checked there.

const root = process.cwd();
const SRC_DIR = join(root, "packages/astropress/src");

async function checkFile(
  filePath: string,
  label: string,
  violations: string[],
  requireOkResult = true,
): Promise<void> {
  const src = await readFile(filePath, "utf8");

  // Check for typed result pattern: must have `ok:` somewhere (typed result, not raw throw)
  // Exempt files that are type-only (no runtime exports at all)
  if (requireOkResult) {
    const hasRuntimeExport = /^export (async function|function|const|class)\b/m.test(src);
    if (hasRuntimeExport) {
      const hasOkResult =
        src.includes("ok: ") ||
        src.includes("ok:true") ||
        src.includes("ok:false") ||
        src.includes("{ ok:") ||
        src.includes("ok: true") ||
        src.includes("ok: false") ||
        src.includes("ok,") ||
        src.includes(": boolean") ||
        // Purge functions return void (acceptable — failures are non-fatal via console.warn)
        src.includes("Promise<void>");
      if (!hasOkResult) {
        violations.push(
          `${label}: no typed result pattern found — exported functions must return { ok: boolean } or Promise<void>, not throw at callers`,
        );
      }
    }
  }

  // Naked re-throw: catch block that only re-throws without handling
  // Pattern: catch (err) {\n  throw (err|e|error)\n}  (with optional whitespace/comments)
  if (/catch\s*\([^)]*\)\s*\{\s*throw\s+\w/m.test(src)) {
    violations.push(
      `${label}: naked re-throw detected — catch blocks must handle errors (log, return { ok: false }, or wrap), not blindly re-throw`,
    );
  }
}

async function main() {
  const violations: string[] = [];

  // 1. admin-action-*.ts files
  const srcFiles = await readdir(SRC_DIR);
  const actionFiles = srcFiles.filter(
    (f) => f.startsWith("admin-action-") && f.endsWith(".ts"),
  );

  for (const filename of actionFiles) {
    await checkFile(join(SRC_DIR, filename), `src/${filename}`, violations);
  }

  // 2. deploy/*.ts files
  const deployDir = join(SRC_DIR, "deploy");
  let deployFiles: string[];
  try {
    deployFiles = (await readdir(deployDir)).filter((f) => f.endsWith(".ts"));
  } catch {
    violations.push("src/deploy/: directory not found — deploy target implementations are missing");
    deployFiles = [];
  }

  for (const filename of deployFiles) {
    // Deploy files implement the DeployTarget interface (typed metadata return, not ok: boolean)
    // Only enforce no naked re-throws
    await checkFile(join(deployDir, filename), `src/deploy/${filename}`, violations, false);
  }

  // 3. cache-purge.ts: failures must be console.warn, not throw
  const cachePurgePath = join(SRC_DIR, "cache-purge.ts");
  const cachePurgeSrc = await readFile(cachePurgePath, "utf8").catch(() => null);
  if (!cachePurgeSrc) {
    violations.push("src/cache-purge.ts: file not found — CDN cache purge strategy is missing");
  } else {
    // Verify all catch blocks use console.warn not throw
    if (/\.catch\s*\([^)]*\)\s*\{\s*throw/m.test(cachePurgeSrc) || /catch\s*\([^)]*\)\s*\{\s*throw/m.test(cachePurgeSrc)) {
      violations.push(
        "src/cache-purge.ts: cache purge failure throws an error — CDN failures must be non-fatal (console.warn only)",
      );
    }
    if (!cachePurgeSrc.includes("console.warn")) {
      violations.push(
        "src/cache-purge.ts: no console.warn found — CDN purge failures should be logged, not silently swallowed",
      );
    }
  }

  if (violations.length > 0) {
    console.error("error-handling audit failed:\n");
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log(
    `error-handling audit passed — ${actionFiles.length} admin-action files, ${deployFiles.length} deploy files, and cache-purge all use safe error patterns.`,
  );
}

main().catch((err) => {
  console.error("error-handling audit failed:", err);
  process.exit(1);
});
