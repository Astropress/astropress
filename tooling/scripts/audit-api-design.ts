// Rubric 15 (API Design)
//
// Static analysis audit that verifies the AstroPress API layer follows
// consistent design conventions:
//
//   1. api-routes.ts exports apiRouteDefinitions or injectApiRoutes
//   2. api-middleware.ts exports response helpers (jsonOk, jsonOkPaginated, apiErrors)
//   3. API route handlers use shared response helpers — no bare new Response(JSON.stringify(
//   4. An OpenAPI endpoint exists at ap-api/v1/openapi.json.ts
//   5. API route handlers use the withApiRequest wrapper

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();

const API_ROUTES_FILE = join(root, "packages/astropress/src/api-routes.ts");
const API_MIDDLEWARE_FILE = join(root, "packages/astropress/src/api-middleware.ts");
const API_HANDLERS_DIR = join(root, "packages/astropress/pages/ap-api");
const OPENAPI_ENDPOINT = join(root, "packages/astropress/pages/ap-api/v1/openapi.json.ts");

const HANDLER_EXTENSIONS = new Set([".ts", ".js"]);

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function walkHandlerFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = entry.name.slice(entry.name.lastIndexOf("."));
      if (HANDLER_EXTENSIONS.has(ext)) {
        const filePath = join(entry.parentPath ?? entry.path, entry.name);
        files.push(filePath);
      }
    }
  } catch { /* dir may not exist */ }
  return files.sort();
}

async function main() {
  const violations: string[] = [];

  // 1. Check api-routes.ts exists and exports apiRouteDefinitions or injectApiRoutes
  if (!(await fileExists(API_ROUTES_FILE))) {
    violations.push(
      `[missing-api-routes] ${relative(root, API_ROUTES_FILE)} does not exist`,
    );
  } else {
    const src = await readFile(API_ROUTES_FILE, "utf8");
    const hasApiRouteDefinitions = /export\s+(const|let|var|function)\s+apiRouteDefinitions\b/.test(src);
    const hasInjectApiRoutes = /export\s+(const|let|var|function|async\s+function)\s+injectApiRoutes\b/.test(src);
    if (!hasApiRouteDefinitions && !hasInjectApiRoutes) {
      violations.push(
        `[missing-export] ${relative(root, API_ROUTES_FILE)} must export apiRouteDefinitions or injectApiRoutes`,
      );
    }
  }

  // 2. Check api-middleware.ts exists and exports response helpers
  if (!(await fileExists(API_MIDDLEWARE_FILE))) {
    violations.push(
      `[missing-api-middleware] ${relative(root, API_MIDDLEWARE_FILE)} does not exist`,
    );
  } else {
    const src = await readFile(API_MIDDLEWARE_FILE, "utf8");
    const requiredExports = ["jsonOk", "jsonOkPaginated", "apiErrors"];
    for (const name of requiredExports) {
      const pattern = new RegExp(`export\\s+(const|let|var|function|async\\s+function)\\s+${name}\\b`);
      if (!pattern.test(src)) {
        violations.push(
          `[missing-helper-export] ${relative(root, API_MIDDLEWARE_FILE)} does not export ${name}`,
        );
      }
    }
  }

  // 3 & 5. Scan all API route handler files
  const handlerFiles = await walkHandlerFiles(API_HANDLERS_DIR);

  // Endpoints that intentionally use different patterns:
  // - openapi.json: public discovery, no auth, returns raw JSON spec
  // - og-image: public image generation, returns PNG, no JSON
  // - testimonials/ingest: webhook receiver with HMAC signature auth, not bearer token
  const EXCLUDED_FROM_RESPONSE_CHECK = new Set(["openapi.json.ts", "ingest.ts"]);
  const EXCLUDED_FROM_WRAPPER_CHECK = new Set(["openapi.json.ts", "ingest.ts"]);

  for (const filePath of handlerFiles) {
    const relPath = relative(root, filePath);
    const fileName = filePath.split("/").pop() ?? "";

    // OG image endpoints return binary PNG, not JSON
    if (relPath.includes("og-image")) continue;

    const src = await readFile(filePath, "utf8");
    const lines = src.split("\n");

    // 3. Check for bare new Response(JSON.stringify( patterns
    if (!EXCLUDED_FROM_RESPONSE_CHECK.has(fileName)) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/new\s+Response\s*\(\s*JSON\.stringify\s*\(/.test(line)) {
          violations.push(
            `[bare-json-response] ${relPath}:${i + 1}: bare new Response(JSON.stringify( — use jsonOk, jsonOkPaginated, jsonOkWithEtag, or apiErrors instead\n    → ${line.trim()}`,
          );
        }
      }
    }

    // 5. Check for withApiRequest wrapper usage
    if (!EXCLUDED_FROM_WRAPPER_CHECK.has(fileName) && !src.includes("withApiRequest")) {
      violations.push(
        `[missing-withApiRequest] ${relPath}: does not use withApiRequest wrapper`,
      );
    }
  }

  // 4. Check OpenAPI endpoint exists
  if (!(await fileExists(OPENAPI_ENDPOINT))) {
    violations.push(
      `[missing-openapi-endpoint] ${relative(root, OPENAPI_ENDPOINT)} does not exist`,
    );
  }

  if (violations.length > 0) {
    console.error(`api-design audit failed — ${violations.length} issue(s) in ${handlerFiles.length} handler files:\n`);
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
      "\nFix: ensure api-routes.ts and api-middleware.ts export the required symbols, " +
      "all ap-api handlers use withApiRequest and shared response helpers, " +
      "and the OpenAPI endpoint exists.",
    );
    process.exit(1);
  }

  console.log(
    `api-design audit passed — ${handlerFiles.length} handler files scanned, all conventions met.`,
  );
}

main().catch((err) => {
  console.error("api-design audit failed:", err);
  process.exit(1);
});
