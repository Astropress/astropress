/**
 * audit-api-inventory-parity.ts
 *
 * Three-way parity for the REST API surface (#117):
 *   disk (pages/ap-api/v1/**.ts)  ⇄  inventory (src/api-routes-data.ts)  ⇄  spec (openapi.json.ts)
 *
 * Every live `/ap-api/v1` handler must either appear in the declared inventory
 * (and therefore the published OpenAPI spec) or be listed in NON_API_HANDLERS
 * with a documented reason. New handlers added without an inventory/spec
 * decision fail this audit — that is the gap #117 closed.
 *
 * Exit 0 — disk, inventory, and spec agree (modulo the documented allowlist).
 * Exit 1 — a handler is missing from inventory, an inventory entry has no file,
 *          or an inventory pattern is missing from the OpenAPI spec.
 */

import { relative } from "node:path";
import { apiRouteDefinitions } from "../../packages/astropress/src/api-routes-data.js";
import { AuditReport, fromRoot, listFiles, readText, runAudit } from "../lib/audit-utils.js";

const API_ROOT = fromRoot("packages/astropress/pages/ap-api/v1");
const OPENAPI = fromRoot("packages/astropress/pages/ap-api/v1/openapi.json.ts");

// Live handlers deliberately kept OUT of the bearer-token REST inventory + spec,
// each with a documented rule (#117 allows "include OR explicitly exclude").
const NON_API_HANDLERS = new Map<string, string>([
	[
		"ap-api/v1/og-image/[slug].svg.ts",
		"OG-image SVG asset route — not a JSON REST endpoint; serves image/svg+xml.",
	],
	[
		"ap-api/v1/testimonials/ingest.ts",
		"Inbound webhook receiver authenticated by HMAC signature, not bearer tokens — outside the bearer REST surface.",
	],
]);

/** "/ap-api/v1/content/[id]" → "/content/{id}" (the OpenAPI path key). */
function specPathFor(pattern: string): string {
	return pattern.replace("/ap-api/v1", "").replace(/\[(\w+)\]/g, "{$1}");
}

async function main(): Promise<void> {
	const report = new AuditReport("api-inventory-parity");

	const diskFiles = (await listFiles(API_ROOT, { recursive: true, extensions: [".ts"] })).map(
		(f) => `ap-api/v1/${f}`,
	);
	const inventoryEntrypoints = new Set(apiRouteDefinitions.map((r) => r.entrypoint));

	// disk ⇄ inventory
	for (const entrypoint of diskFiles) {
		if (inventoryEntrypoints.has(entrypoint)) continue;
		if (NON_API_HANDLERS.has(entrypoint)) continue;
		report.add(
			`${entrypoint}: live handler missing from src/api-routes-data.ts inventory. ` +
				`Add an apiRouteDefinitions entry (+ OpenAPI path) or register it in NON_API_HANDLERS with a reason.`,
		);
	}
	for (const entry of apiRouteDefinitions) {
		if (!diskFiles.includes(entry.entrypoint)) {
			report.add(
				`inventory entry "${entry.pattern}" → ${entry.entrypoint} has no file on disk; remove the stale entry.`,
			);
		}
	}

	// inventory ⇄ spec
	const specSrc = await readText(OPENAPI);
	for (const entry of apiRouteDefinitions) {
		const specPath = specPathFor(entry.pattern);
		if (!specSrc.includes(`"${specPath}":`)) {
			report.add(
				`${relative(fromRoot(), OPENAPI)}: OpenAPI spec is missing path "${specPath}" ` +
					`(declared in inventory as ${entry.pattern}).`,
			);
		}
	}

	report.finish("✓ audit:api-inventory-parity — disk, inventory, and OpenAPI spec agree");
}

runAudit("api-inventory-parity", main);
