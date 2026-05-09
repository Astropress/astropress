#!/usr/bin/env bun
/**
 * audit-suppressions.ts
 *
 * Enforces a suppression rubric across all source files. Every suppression
 * comment (// lgtm[...], // audit-ok:, biome-ignore) must meet the rubric
 * or be registered in the approved-suppressions allowlist below.
 *
 * RUBRIC — a suppression is only valid if ALL of the following are true:
 *
 *   1. CODE FIX EVALUATED: the justification must explain why a code fix
 *      does not resolve the issue (not just why the pattern is safe).
 *
 *   2. ALTERNATIVES NAMED: the justification must name what alternatives
 *      were considered.
 *
 *   3. MITIGATIONS PRESENT: for security suppressions, the justification
 *      must state what mitigations exist even if the suppression remains.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { AuditReport, runAudit } from "../lib/audit-utils.js";

type ApprovedSuppression = {
	file: string;
	linePattern: RegExp;
	contentPattern: RegExp;
	rubric: string;
};

const APPROVED: ApprovedSuppression[] = [
	{
		file: "packages/astropress/src/import/download-media.ts",
		linePattern: /lgtm\[js\/http-to-file-access\]/,
		contentPattern: /writeFile/,
		rubric:
			"Code fixes applied: (1) raster images (JPEG/PNG/GIF/WebP/AVIF/BMP/TIFF) are " +
			"piped through sharp decode+encode — bytes on disk are sharp pixel output, not " +
			"raw HTTP bytes; (2) SVG is sanitized via sanitize-html with an explicit " +
			"element/attribute allowlist that excludes script, foreignObject, and all on* " +
			"event handlers, with allowedSchemes blocking javascript:/data: in hrefs. " +
			"Remaining raw-byte types: PDF, video/mp4, video/webm, audio/* — these are " +
			"binary formats with no server-side execution surface; risk is in the client " +
			"reader/player, not in disk storage. No code fix is possible for these: " +
			"transcoding requires format-specific encoders not available as deps, and " +
			"rejecting them would break legitimate import functionality. Alternatives " +
			"considered: barrierModel YAML (tried; CodeQL models-as-data package resolution " +
			"does not apply to same-repo local workspace imports — removed as non-functional); " +
			"custom QL Sanitizer extension (not feasible without CodeQL QL dev toolchain in CI). Mitigations present: " +
			"validateMediaSourceUrl enforces http/https-only and blocks private/loopback " +
			"IPs; content-type allowlist; 50 MB size cap; path.basename() prevents " +
			"traversal; source URLs from operator-controlled export files only.",
	},
	{
		file: "packages/astropress-nexus/src/app.ts",
		linePattern: /audit-ok:.*detailHref built from encodeURIComponent/,
		contentPattern: /detailHref/,
		rubric:
			"detailHref = '/dashboard/sites/' + encodeURIComponent(site.id). " +
			"This is a relative URL — no protocol, so javascript: is impossible. " +
			"encodeURIComponent encodes ':' as '%3A', blocking any protocol injection. " +
			"Code fix: already applied (encodeURIComponent). audit-ok explains why " +
			"the local html-in-template check doesn't apply here.",
	},
	{
		file: "packages/astropress/src/runtime-health.ts",
		linePattern: /biome-ignore lint\/suspicious\/noExplicitAny/,
		contentPattern: /require/,
		rubric:
			"Dynamic require() fallback for sanitize-html in environments where ESM " +
			"import() is unavailable. The any type is scoped to the fallback assignment " +
			"and immediately narrowed by usage. No security suppression — lint only. " +
			"Code fix: not possible without removing the CJS fallback path.",
	},
	{
		file: "tooling/scripts/rust-arch-lint.ts",
		linePattern: /biome-ignore lint\/suspicious\/noAssignInExpressions/,
		contentPattern: /exec/,
		rubric:
			"Standard regex exec() loop pattern: while (m = re.exec(str)). " +
			"Assignment-in-condition is idiomatic for this pattern and there is no " +
			"non-assignment equivalent that preserves the same semantics without " +
			"code duplication. Lint only — no security impact.",
	},
	{
		file: "packages/astropress-nexus/tests/app.test.ts",
		linePattern: /audit-ok:.*test mock routing.*new URL/,
		contentPattern: /new URL\(url\)\.hostname/,
		rubric:
			"new URL(url).hostname IS the recommended fix for js/incomplete-url-substring-sanitization. " +
			"This is a test mock using exact equality (===), not substring matching. " +
			"No code fix needed — the code already uses the correct pattern. " +
			"audit-ok documents that the flagged pattern is the solution, not the problem.",
	},
	{
		file: "packages/astropress/tests/admin-action-utils.test.ts",
		linePattern: /biome-ignore lint\/performance\/noDelete/,
		contentPattern: /delete process\.env/,
		rubric:
			"Bun runtime treats process.env.VAR = undefined as the string 'undefined', " +
			"not actual unset. delete process.env.VAR is the only way to truly remove a " +
			"key in Bun for correct test isolation. Code fix not possible without breaking " +
			"test teardown on Bun. Lint only — no security impact.",
	},
	{
		file: "packages/astropress/tests/cloudflare-adapter-security.test.ts",
		linePattern: /biome-ignore lint\/performance\/noDelete/,
		contentPattern: /delete process\.env/,
		rubric:
			"Bun runtime treats process.env.VAR = undefined as the string 'undefined', " +
			"not actual unset. delete process.env.VAR is the only way to truly remove a " +
			"key in Bun for correct test isolation. Code fix not possible without breaking " +
			"test teardown on Bun. Lint only — no security impact.",
	},
	{
		file: "packages/astropress/tests/sqlite-admin-runtime-cms-routes.test.ts",
		linePattern: /biome-ignore lint\/performance\/noDelete/,
		contentPattern: /delete process\.env/,
		rubric:
			"Bun runtime treats process.env.VAR = undefined as the string 'undefined', " +
			"not actual unset. delete process.env.VAR is the only way to truly remove a " +
			"key in Bun for correct test isolation. Code fix not possible without breaking " +
			"test teardown on Bun. Lint only — no security impact.",
	},
	{
		file: "packages/astropress/pages/ap-api/v1/content.ts",
		linePattern: /biome-ignore lint\/style\/noNonNullAssertion/,
		contentPattern: /apiTokens/,
		rubric: "store.apiTokens always set by API token auth middleware. See block comment above.",
	},
	{
		file: "packages/astropress/pages/ap-api/v1/content/[id].ts",
		linePattern: /biome-ignore lint\/style\/noNonNullAssertion/,
		contentPattern: /apiTokens/,
		rubric: "store.apiTokens always set by API token auth middleware. See block comment above.",
	},
	{
		file: "packages/astropress/pages/ap-api/v1/media.ts",
		linePattern: /biome-ignore lint\/style\/noNonNullAssertion/,
		contentPattern: /apiTokens/,
		rubric: "store.apiTokens always set by API token auth middleware. See block comment above.",
	},
	{
		file: "packages/astropress/pages/ap-api/v1/media/[id].ts",
		linePattern: /biome-ignore lint\/style\/noNonNullAssertion/,
		contentPattern: /apiTokens/,
		rubric: "store.apiTokens always set by API token auth middleware. See block comment above.",
	},
	{
		file: "packages/astropress/pages/ap-api/v1/metrics.ts",
		linePattern: /biome-ignore lint\/style\/noNonNullAssertion/,
		contentPattern: /apiTokens/,
		rubric: "store.apiTokens always set by API token auth middleware. See block comment above.",
	},
	{
		file: "packages/astropress/pages/ap-api/v1/revisions/[recordId].ts",
		linePattern: /biome-ignore lint\/style\/noNonNullAssertion/,
		contentPattern: /apiTokens/,
		rubric: "store.apiTokens always set by API token auth middleware. See block comment above.",
	},
	{
		file: "packages/astropress/pages/ap-api/v1/search.ts",
		linePattern: /biome-ignore lint\/style\/noNonNullAssertion/,
		contentPattern: /apiTokens/,
		rubric: "store.apiTokens always set by API token auth middleware. See block comment above.",
	},
	{
		file: "packages/astropress/pages/ap-api/v1/settings.ts",
		linePattern: /biome-ignore lint\/style\/noNonNullAssertion/,
		contentPattern: /apiTokens/,
		rubric: "store.apiTokens always set by API token auth middleware. See block comment above.",
	},
	{
		file: "packages/astropress/pages/ap-api/v1/webhooks.ts",
		linePattern: /biome-ignore lint\/style\/noNonNullAssertion/,
		contentPattern: /apiTokens/,
		rubric: "store.apiTokens always set by API token auth middleware. See block comment above.",
	},
];

// ── Scanner ──────────────────────────────────────────────────────────────────

const SUPPRESSION_RE = /\/\/\s*(lgtm\[|audit-ok:|codeql\[)|biome-ignore\s+lint/;

function getTrackedFiles(): string[] {
	return execSync("git ls-files", { encoding: "utf8" })
		.trim()
		.split("\n")
		.filter(
			(f) =>
				(f.endsWith(".ts") || f.endsWith(".tsx")) &&
				!f.includes("node_modules") &&
				!f.includes("/dist/") &&
				!f.includes("stryker-setup") &&
				f !== "tooling/scripts/audit-suppressions.ts" &&
				f !== "tooling/scripts/audit-codeql-patterns.ts" &&
				f !== "tooling/scripts/check-pr-ghas.ts",
		);
}

async function main() {
	const report = new AuditReport("suppression");
	const files = getTrackedFiles();

	for (const rel of files) {
		let src: string;
		try {
			src = readFileSync(rel, "utf8");
		} catch {
			continue;
		}
		const lines = src.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] as string;
			if (!SUPPRESSION_RE.test(line)) continue;

			const approved = APPROVED.find(
				(a) =>
					rel === a.file &&
					a.linePattern.test(line) &&
					lines
						.slice(Math.max(0, i - 8), Math.min(lines.length, i + 9))
						.some((l) => a.contentPattern.test(l)),
			);

			if (!approved) {
				const content = line.trim().slice(0, 100);
				if (/\/\/\s*codeql\[/.test(line)) {
					report.add(
						`${rel}:${i + 1}\n  Content: ${content}\n  Reason:  codeql[] suppression format is not recognized by CodeQL's JS analysis. Use lgtm[] instead, or make a code fix. If suppression is genuinely needed, add it to the APPROVED registry in audit-suppressions.ts with rubric.`,
					);
				} else {
					report.add(
						`${rel}:${i + 1}\n  Content: ${content}\n  Reason:  Suppression not in approved registry. To add it, evaluate against the rubric: (1) explain why a CODE FIX doesn't work — not just why it's safe; (2) name alternatives considered; (3) state what mitigations exist. Then add an entry to APPROVED in tooling/scripts/audit-suppressions.ts.`,
					);
				}
			}
		}
	}

	if (report.failed) {
		console.error(
			"\nEvery suppression must be evaluated against the rubric and registered\n" +
				"in APPROVED in tooling/scripts/audit-suppressions.ts.\n" +
				"The rubric requires: why a code fix doesn't work (not just why it's safe),\n" +
				"what alternatives were considered, and what mitigations exist.",
		);
	}

	report.finish(`suppression audit passed — ${files.length} files scanned.`);
}

runAudit("suppression", main);
