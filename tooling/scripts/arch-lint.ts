import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

type Violation = {
  file: string;
  rule: string;
  message: string;
};

type Warning = {
  file: string;
  rule: string;
  message: string;
};

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const root = process.cwd();
  const pkgDir = join(root, "packages/astropress");
  const srcDir = join(pkgDir, "src");
  const allFiles = (await walk(srcDir)).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));

  const violations: Violation[] = [];
  const warnings: Warning[] = [];

  // --- Rule: no-js-in-src ---
  // tsc emits to dist/; stray .js files in src/ or at the package root re-introduce
  // the dual-file maintenance problem (v8 coverage misattribution, resolver
  // shadowing). dist/ is the only legitimate output location.
  const strayJsFiles = (await walk(srcDir)).filter((f) => f.endsWith(".js"));
  const rootIndexJs = join(pkgDir, "index.js");
  try {
    const info = await stat(rootIndexJs);
    if (info.isFile()) strayJsFiles.push(rootIndexJs);
  } catch {
    // absent — good
  }
  for (const jsFile of strayJsFiles) {
    violations.push({
      file: relative(root, jsFile),
      rule: "no-js-in-src",
      message:
        "Committed .js file inside packages/astropress/src/ or at packages/astropress/index.js. " +
        "Run `bun run --filter @astropress-diy/astropress build` to emit into dist/ instead and delete the stray .js.",
    });
  }

  for (const file of allFiles) {
    const content = await readFile(file, "utf8");
    const display = relative(root, file);
    const filename = file.split("/").pop() ?? "";
    const lines = content.split("\n").length;

    // --- Rule: LOC limits ---
    // Exempt: known-large stable files (schema bootstrap, public barrel, import workers, sqlite runtime)
    const LOC_WARN = 400;
    const LOC_ERROR = 600;
    const locExempt = new Set([
      "sqlite-bootstrap.ts",
      "index.ts",
      "project-scaffold.ts",          // CLI scaffolding — intentionally verbose
      "project-scaffold-ci.ts",       // CI scaffolding — mirrors project-scaffold.ts pattern
      "cms-route-registry-factory.ts", // factory with injected deps — stable
      "auth-repository-factory.ts",
      "runtime-actions-content.ts",   // complex multi-step content coordinator
    ]);
    const locExemptDirs = ["sqlite-runtime/", "import/", "adapters/"];
    const isLocExempt = locExempt.has(filename) || locExemptDirs.some((d) => display.includes(d));

    if (!isLocExempt) {
      if (lines > LOC_ERROR) {
        violations.push({
          file: display,
          rule: "max-lines",
          message: `${lines} lines exceeds the ${LOC_ERROR}-line limit. Split into domain-focused modules.`,
        });
      } else if (lines > LOC_WARN) {
        warnings.push({
          file: display,
          rule: "max-lines",
          message: `${lines} lines exceeds the ${LOC_WARN}-line warning. Consider splitting.`,
        });
      }
    }

    // --- Rule: SQL containment ---
    // .prepare() is only allowed in:
    //   - d1-*.ts files (D1 adapter layer)
    //   - sqlite-*.ts files and sqlite-runtime/ (local SQLite layer)
    //   - adapters/ (provider adapters legitimately use SQL)
    //   - import/ (import workers write SQL directly)
    const isSqlAllowed =
      filename.startsWith("d1-") ||
      filename.startsWith("sqlite-") ||
      filename.startsWith("runtime-actions-") ||          // action/service layer: multi-step D1 coordination
      filename.startsWith("runtime-route-registry-") ||   // route registry service layer
      filename === "runtime-admin-auth.ts" ||              // auth session management
      display.includes("sqlite-runtime/") ||
      display.includes("/adapters/") ||
      display.includes("/import/");

    if (!isSqlAllowed && content.includes(".prepare(")) {
      violations.push({
        file: display,
        rule: "sql-containment",
        message: "Raw .prepare() SQL outside adapter/import layer. Move into a d1-*.ts or sqlite-*.ts file.",
      });
    }

    // --- Rule: Dependency direction ---
    // d1-store-*.ts files must not import from runtime-*.ts (adapters don't depend on runtime layer)
    if (filename.startsWith("d1-store-") && /from\s+["']\.\/runtime-/.test(content)) {
      violations.push({
        file: display,
        rule: "dependency-direction",
        message: "Adapter (d1-store-*) imports from runtime-* — reverse dependency violates hexagonal architecture.",
      });
    }

    // --- Rule: Dispatch containment ---
    // Once admin-store-dispatch.ts exists, loadLocalAdminStore() must only be called from there.
    // Exempt: the dispatch module itself, the type-stub (local-runtime-modules.ts),
    //         infrastructure stubs (cloudflare-local-runtime-stubs.ts, host-runtime-modules.ts)
    const dispatchExempt = new Set([
      "admin-store-dispatch.ts",
      "local-runtime-modules.ts",           // type stub — declares the module shape
      "cloudflare-local-runtime-stubs.ts",  // cloudflare stub — legitimate re-export
      "host-runtime-modules.ts",            // host bundle factory — legitimate consumer
    ]);
    if (!dispatchExempt.has(filename) && content.includes("loadLocalAdminStore()")) {
      violations.push({
        file: display,
        rule: "dispatch-containment",
        message:
          "loadLocalAdminStore() called outside admin-store-dispatch.ts. Use withAdminStore() instead.",
      });
    }

    // --- Rule: Utility uniqueness ---
    // normalizePath and normalizeEmail must only be *defined* (not imported) in admin-normalizers.ts
    // or in sqlite-runtime/utils.ts (separate layer with its own copy).
    // Factory files that accept normalizePath as a *parameter* are exempt.
    const utilDefExempt = new Set([
      "admin-normalizers.ts",
    ]);
    const utilDefExemptPatterns = [
      "sqlite-runtime/",
      "cms-route-registry-factory.ts",      // receives normalizePath as injected param
      "content-repository-factory.ts",      // receives normalizePath as injected param
      "redirect-repository-factory.ts",     // receives normalizePath as injected param
      "import/",
    ];
    const isUtilDefExempt =
      utilDefExempt.has(filename) ||
      utilDefExemptPatterns.some((p) => display.includes(p));

    if (
      !isUtilDefExempt &&
      /^(?:export\s+)?function\s+(?:normalizeEmail|normalizePath)\s*\(/m.test(content)
    ) {
      violations.push({
        file: display,
        rule: "utility-uniqueness",
        message:
          "normalizeEmail or normalizePath defined outside admin-normalizers.ts. Import from './admin-normalizers' instead.",
      });
    }
  }

  // --- Rule: cyclomatic-complexity ---
  // Functions with high cyclomatic complexity are hard to test and reason about.
  // Complexity = 1 + count of (if, else if, case, &&, ||, ternary ?, catch, ??)
  // Threshold: warn at 20, error at 40.
  // Files in sqlite-runtime/, adapters/, import/ are exempt (data-access modules
  // with inherently branchy SQL dispatch — tracked for future refactoring).
  const COMPLEXITY_WARN = 20;
  const COMPLEXITY_ERROR = 40;
  const complexityExemptPaths = ["sqlite-runtime/", "adapters/", "import/"];
  const complexityExemptFiles = new Set([
    "runtime-actions-content.ts",           // multi-step content coordinator — inherently branchy
    "runtime-actions-content-shared.ts",    // shared content revision logic
    "runtime-route-registry-pages-mutations.ts", // page route CRUD
    "cms-route-registry-factory.ts",        // factory with injected deps
    "sqlite-bootstrap-seeders.ts",          // data seeding
  ]);

  for (const file of allFiles) {
    const display = relative(root, file);
    const fname = file.split("/").pop() ?? "";
    if (complexityExemptPaths.some((p) => display.includes(p))) continue;
    if (complexityExemptFiles.has(fname)) continue;

    const content = await readFile(file, "utf8");

    const measureComplexity = (name: string, body: string) => {
      let complexity = 1;
      // Count branching keywords/operators
      const patterns = [
        /\bif\s*\(/g,
        /\belse\s+if\s*\(/g,
        /\bcase\s+/g,
        /\bcatch\s*\(/g,
        /\?\?/g,
      ];
      for (const p of patterns) {
        const matches = body.match(p);
        if (matches) complexity += matches.length;
      }
      // Count ternary ? but exclude false positives:
      //   - ?. optional chaining (already excluded by [^?.] lookahead)
      //   - ?? nullish coalescing (already excluded by [^?] lookbehind)
      //   - ?: TypeScript optional property / parameter notation
      //   - SQL ? placeholders in template strings
      //   - Regex quantifiers like (?:, [x]?, )? inside regex literals
      const stripped = body
        .replace(/`[^`]*`/g, "``")                           // strip template string contents
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')                  // strip double-quoted string contents
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")                  // strip single-quoted string contents
        .replace(/\/(?:[^\n/\\]|\\.)+\/[gimsuy]*/g, "/r/"); // strip regex literal contents
      const ternaryCount = (stripped.match(/[^?]\?[^?.:]/g) || []).length;
      complexity += ternaryCount;

      if (complexity >= COMPLEXITY_ERROR) {
        violations.push({ file: display, rule: "cyclomatic-complexity", message: `${name}() has complexity ${complexity} (max ${COMPLEXITY_ERROR})` });
      } else if (complexity >= COMPLEXITY_WARN) {
        warnings.push({ file: display, rule: "cyclomatic-complexity", message: `${name}() has complexity ${complexity} (warn at ${COMPLEXITY_WARN})` });
      }
    };

    const lines = content.split("\n");
    const funcStarts: Array<{ name: string; line: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const funcMatch = l.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/) ||
                         l.match(/^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
      if (funcMatch) funcStarts.push({ name: funcMatch[1], line: i });
    }

    for (let i = 0; i < funcStarts.length; i++) {
      const start = funcStarts[i].line;
      const end = i + 1 < funcStarts.length ? funcStarts[i + 1].line : lines.length;
      const body = lines.slice(start, end).join("\n");
      measureComplexity(funcStarts[i].name, body);
    }
  }

  const hasViolations = violations.length > 0;
  const hasWarnings = warnings.length > 0;

  if (hasWarnings) {
    console.log("\n⚠️  Architecture Warnings:\n");
    for (const w of warnings) {
      console.log(`  [${w.rule}] ${w.file}`);
      console.log(`    ${w.message}\n`);
    }
  }

  if (hasViolations) {
    console.error("❌ Architecture Violations:\n");
    for (const v of violations) {
      console.error(`  [${v.rule}] ${v.file}`);
      console.error(`    ${v.message}\n`);
    }
    console.error(`${violations.length} violation(s) found. Fix before committing.\n`);
    process.exit(1);
  }

  const label = hasWarnings ? `✅ Architecture lint passed (${warnings.length} warning(s)).` : "✅ Architecture lint passed.";
  console.log(label);
}

main().catch((err) => {
  console.error("arch-lint failed:", err);
  process.exit(1);
});
