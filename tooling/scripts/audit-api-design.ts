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

import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import {
	AuditReport,
	fileExists,
	fromRoot,
	readText,
	ROOT,
	runAudit,
} from "../lib/audit-utils.js";

const API_ROUTES_FILE = fromRoot("packages/astropress/src/api-routes.ts");
const API_MIDDLEWARE_FILE = fromRoot("packages/astropress/src/api-middleware.ts");
const API_HANDLERS_DIR = fromRoot("packages/astropress/pages/ap-api");
const OPENAPI_ENDPOINT = fromRoot(
	"packages/astropress/pages/ap-api/v1/openapi.json.ts",
);

const HANDLER_EXTENSIONS = new Set([".ts", ".js"]);

async function walkHandlerFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	try {
		const entries = await readdir(dir, {
			withFileTypes: true,
			recursive: true,
		});
		for (const entry of entries) {
			if (!entry.isFile()) continue;
			const ext = entry.name.slice(entry.name.lastIndexOf("."));
			if (HANDLER_EXTENSIONS.has(ext)) {
				const filePath = join(entry.parentPath, entry.name);
				files.push(filePath);
			}
		}
	} catch {
		/* dir may not exist */
	}
	return files.sort();
}

async function main() {
	const report = new AuditReport("api-design");

	// 1. Check api-routes.ts exists and exports apiRouteDefinitions or injectApiRoutes
	if (!(await fileExists(API_ROUTES_FILE))) {
		report.add(
			`[missing-api-routes] ${relative(ROOT, API_ROUTES_FILE)} does not exist`,
		);
	} else {
		const src = await readText(API_ROUTES_FILE);
		const hasApiRouteDefinitions =
			/export\s+(const|let|var|function)\s+apiRouteDefinitions\b/.test(src);
		const hasInjectApiRoutes =
			/export\s+(const|let|var|function|async\s+function)\s+injectApiRoutes\b/.test(
				src,
			);
		if (!hasApiRouteDefinitions && !hasInjectApiRoutes) {
			report.add(
				`[missing-export] ${relative(ROOT, API_ROUTES_FILE)} must export apiRouteDefinitions or injectApiRoutes`,
			);
		}
	}

	// 2. Check api-middleware.ts exists and exports response helpers
	if (!(await fileExists(API_MIDDLEWARE_FILE))) {
		report.add(
			`[missing-api-middleware] ${relative(ROOT, API_MIDDLEWARE_FILE)} does not exist`,
		);
	} else {
		const src = await readText(API_MIDDLEWARE_FILE);
		const requiredExports = ["jsonOk", "jsonOkPaginated", "apiErrors"];
		for (const name of requiredExports) {
			const pattern = new RegExp(
				`export\\s+(const|let|var|function|async\\s+function)\\s+${name}\\b`,
			);
			if (!pattern.test(src)) {
				report.add(
					`[missing-helper-export] ${relative(ROOT, API_MIDDLEWARE_FILE)} does not export ${name}`,
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
	const EXCLUDED_FROM_RESPONSE_CHECK = new Set([
		"openapi.json.ts",
		"ingest.ts",
	]);
	const EXCLUDED_FROM_WRAPPER_CHECK = new Set(["openapi.json.ts", "ingest.ts"]);

	for (const filePath of handlerFiles) {
		const relPath = relative(ROOT, filePath);
		const fileName = filePath.split("/").pop() ?? "";

		// OG image endpoints return binary PNG, not JSON
		if (relPath.includes("og-image")) continue;

		const src = await readText(filePath);
		const lines = src.split("\n");

		// 3. Check for bare new Response(JSON.stringify( patterns
		if (!EXCLUDED_FROM_RESPONSE_CHECK.has(fileName)) {
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (/new\s+Response\s*\(\s*JSON\.stringify\s*\(/.test(line)) {
					report.add(
						`[bare-json-response] ${relPath}:${i + 1}: bare new Response(JSON.stringify( — use jsonOk, jsonOkPaginated, jsonOkWithEtag, or apiErrors instead\n    → ${line.trim()}`,
					);
				}
			}
		}

		// 5. Check for withApiRequest wrapper usage
		if (
			!EXCLUDED_FROM_WRAPPER_CHECK.has(fileName) &&
			!src.includes("withApiRequest")
		) {
			report.add(
				`[missing-withApiRequest] ${relPath}: does not use withApiRequest wrapper`,
			);
		}
	}

	// 4. Check OpenAPI endpoint exists
	if (!(await fileExists(OPENAPI_ENDPOINT))) {
		report.add(
			`[missing-openapi-endpoint] ${relative(ROOT, OPENAPI_ENDPOINT)} does not exist`,
		);
	}

	if (report.failed) {
		console.error(
			"\nFix: ensure api-routes.ts and api-middleware.ts export the required symbols, " +
				"all ap-api handlers use withApiRequest and shared response helpers, " +
				"and the OpenAPI endpoint exists.",
		);
	}

	report.finish(
		`api-design audit passed — ${handlerFiles.length} handler files scanned, all conventions met.`,
	);
}

runAudit("api-design", main);
