/**
 * audit-security-header-envelope.ts
 *
 * Keeps admin + API JSON endpoints inside the shared Astropress security
 * envelope (Referrer-Policy, X-Content-Type-Options, Permissions-Policy,
 * Cross-Origin-Resource-Policy, CSP, …). This is the class behind #103 (admin
 * media picker constructed ad-hoc Response headers) and #119 (REST helpers only
 * set JSON/ETag/CORS, never the security headers).
 *
 * Rules:
 *  1. `src/api-middleware.ts` must apply the envelope — it must reference
 *     `createAstropressSecurityHeaders`. (The helpers `jsonOk*` and the CORS
 *     egress bake it in; deleting that wiring trips this.)
 *  2. Any handler under `pages/ap-admin/api/**` or `pages/ap-api/v1/**` that
 *     builds a JSON `new Response(...)` directly must also reference one of the
 *     shared envelope helpers in the same file (`applyAstropressSecurityHeaders`,
 *     `createAstropressSecurityHeaders`) or go through the enveloped middleware
 *     helpers (`jsonOk`, `jsonOkPaginated`, `jsonOkWithEtag`, `withApiRequest`).
 *
 * Exit 0 — every checked endpoint stays inside the envelope.
 * Exit 1 — an endpoint constructs a JSON response outside it.
 */

import { relative } from "node:path";
import { AuditReport, fromRoot, listFiles, readText, runAudit } from "../lib/audit-utils.js";

const API_MIDDLEWARE = fromRoot("packages/astropress/src/api-middleware.ts");
const ENDPOINT_ROOTS = [
	fromRoot("packages/astropress/pages/ap-admin/api"),
	fromRoot("packages/astropress/pages/ap-api/v1"),
];

const ENVELOPE_REFERENCES = [
	"applyAstropressSecurityHeaders",
	"createAstropressSecurityHeaders",
	"jsonOk",
	"jsonOkPaginated",
	"jsonOkWithEtag",
	"withApiRequest",
];

/** True when the source builds a `new Response(...)` whose body/headers are JSON. */
function buildsJsonResponse(src: string): boolean {
	if (!src.includes("new Response(")) return false;
	return /application\/json/i.test(src);
}

async function main(): Promise<void> {
	const report = new AuditReport("security-header-envelope");

	const middlewareSrc = await readText(API_MIDDLEWARE);
	if (!middlewareSrc.includes("createAstropressSecurityHeaders")) {
		report.add(
			"src/api-middleware.ts: the REST egress helpers no longer apply the shared security " +
				"envelope (createAstropressSecurityHeaders). REST responses would ship without " +
				"Referrer-Policy / X-Content-Type-Options / CORP (#119).",
		);
	}

	for (const root of ENDPOINT_ROOTS) {
		const files = await listFiles(root, { recursive: true, extensions: [".ts"] });
		for (const file of files) {
			const abs = `${root}/${file}`;
			const rel = relative(fromRoot(), abs);
			const src = await readText(abs);
			if (!buildsJsonResponse(src)) continue;
			if (ENVELOPE_REFERENCES.some((ref) => src.includes(ref))) continue;
			report.add(
				`${rel}: constructs a JSON Response without the shared security envelope. ` +
					`Return via jsonOk()/jsonOkPaginated()/jsonOkWithEtag() (#119) or apply ` +
					`applyAstropressSecurityHeaders(headers, { area }) (#103).`,
			);
		}
	}

	report.finish("✓ audit:security-header-envelope — admin/API JSON responses stay enveloped");
}

runAudit("security-header-envelope", main);
