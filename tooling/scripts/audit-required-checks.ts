#!/usr/bin/env bun
/**
 * audit-required-checks — catch drift between the GitHub branch ruleset's
 * required status checks and what the workflows in .github/workflows/ actually
 * emit.
 *
 * Why this exists
 * ---------------
 * On 2026-04-25 PR #61 sat in mergeStateStatus=BLOCKED for ~30 minutes because
 * the ruleset required `test-unit (latest)` while the workflow matrix had
 * already moved to explicit version pins (`test-unit (1.3.10)`,
 * `test-unit (1.3.11)`). The required context was unsatisfiable — no job
 * would ever emit a check by that name — so the PR could never merge. There
 * was no audit catching that drift.
 *
 * What it checks
 * --------------
 * 1. Every context listed in `.github/required-status-checks.json` exists
 *    as a job (or matrix-expanded job) in some `.github/workflows/*.yml`.
 * 2. If the GitHub CLI (`gh`) is available and authenticated, the live
 *    ruleset's required contexts MUST equal the committed list. This catches
 *    out-of-band changes to the ruleset that bypassed code review.
 *
 * Failure mode
 * ------------
 * Exits non-zero with a list of (a) committed contexts that no workflow can
 * produce, and (b) ruleset/file disagreements. Both are merge-blocking
 * conditions in practice; surface them in CI rather than at PR time.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CHECKS_FILE = ".github/required-status-checks.json";
const WORKFLOWS_DIR = ".github/workflows";

interface RequiredCheck {
	context: string;
	produced_by: string;
}

interface ChecksFile {
	ruleset_id: number;
	branch: string;
	required: RequiredCheck[];
}

function loadChecksFile(): ChecksFile {
	if (!existsSync(CHECKS_FILE)) {
		console.error(`audit-required-checks: missing ${CHECKS_FILE}`);
		process.exit(1);
	}
	return JSON.parse(readFileSync(CHECKS_FILE, "utf8")) as ChecksFile;
}

function loadWorkflowText(): string {
	if (!existsSync(WORKFLOWS_DIR)) {
		console.error(`audit-required-checks: missing ${WORKFLOWS_DIR}`);
		process.exit(1);
	}
	const ymls = readdirSync(WORKFLOWS_DIR).filter(
		(f) => f.endsWith(".yml") || f.endsWith(".yaml"),
	);
	return ymls
		.map(
			(f) => `# === ${f} ===\n${readFileSync(join(WORKFLOWS_DIR, f), "utf8")}`,
		)
		.join("\n");
}

/**
 * Parse a context name into its base + matrix-value parts.
 * Examples:
 *   "lint"                        → { base: "lint", matrixValue: null }
 *   "test-unit (1.3.10)"          → { base: "test-unit", matrixValue: "1.3.10" }
 *   "platform-smoke (ubuntu-latest)" → { base: "platform-smoke", matrixValue: "ubuntu-latest" }
 */
function parseContext(context: string): {
	base: string;
	matrixValue: string | null;
} {
	const m = context.match(/^(.+?)\s+\(([^)]+)\)$/);
	if (m) return { base: m[1], matrixValue: m[2] };
	return { base: context, matrixValue: null };
}

function workflowEmitsContext(workflowText: string, context: string): boolean {
	const { base, matrixValue } = parseContext(context);
	// Job declaration lines look like `  <base>:` (two-space indent under jobs:).
	// We accept the shorter form too because some workflows use 4-space indent.
	const jobDecl = new RegExp(`^[ \\t]+${escapeRegExp(base)}:`, "m");
	if (!jobDecl.test(workflowText)) return false;
	if (matrixValue === null) return true;
	// For matrix variants, ensure the literal value appears somewhere in the
	// workflow file. False positives are possible but the human-readable
	// `produced_by` field in checks.json keeps reviewers honest.
	return workflowText.includes(matrixValue);
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tryFetchLiveRulesetContexts(rulesetId: number): string[] | null {
	try {
		const out = execFileSync(
			"gh",
			["api", `repos/Astropress/astropress/rulesets/${rulesetId}`],
			{ encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
		);
		const ruleset = JSON.parse(out) as {
			rules: Array<{
				type: string;
				parameters?: { required_status_checks?: Array<{ context: string }> };
			}>;
		};
		const rule = ruleset.rules.find((r) => r.type === "required_status_checks");
		const checks = rule?.parameters?.required_status_checks ?? [];
		return checks.map((c) => c.context).sort();
	} catch {
		return null; // gh missing, unauthenticated, or network failure — skip
	}
}

function main(): number {
	const checks = loadChecksFile();
	const workflowText = loadWorkflowText();

	const errors: string[] = [];

	// 1. Every committed required context must be producible by some workflow.
	for (const c of checks.required) {
		if (!workflowEmitsContext(workflowText, c.context)) {
			errors.push(
				`  Required context "${c.context}" (claimed produced_by: ${c.produced_by}) was not found in any workflow. Did you rename a job or change a matrix?`,
			);
		}
	}

	// 2. Optional: live ruleset must match the committed list exactly (when gh
	//    is available). Out-of-band ruleset edits are caught here.
	const liveContexts = tryFetchLiveRulesetContexts(checks.ruleset_id);
	if (liveContexts !== null) {
		const committed = checks.required.map((c) => c.context).sort();
		const liveSorted = [...liveContexts].sort();
		const onlyInLive = liveSorted.filter((c) => !committed.includes(c));
		const onlyInCommitted = committed.filter((c) => !liveSorted.includes(c));
		if (onlyInLive.length > 0) {
			errors.push(
				`  Live ruleset has contexts not in ${CHECKS_FILE}: ${onlyInLive.join(", ")}`,
			);
		}
		if (onlyInCommitted.length > 0) {
			errors.push(
				`  ${CHECKS_FILE} has contexts not in the live ruleset: ${onlyInCommitted.join(", ")}`,
			);
		}
		console.log(
			`audit-required-checks: live ruleset (id ${checks.ruleset_id}) compared against committed list — ${
				errors.length === 0 ? "in sync" : "DRIFT detected"
			}`,
		);
	} else {
		console.log(
			"audit-required-checks: gh CLI not available or unauthenticated — skipping live-ruleset comparison",
		);
	}

	if (errors.length === 0) {
		console.log(
			`audit-required-checks passed — ${checks.required.length} required contexts, all produced by a workflow${
				liveContexts ? " and in sync with the live ruleset" : ""
			}.`,
		);
		return 0;
	}

	console.error("\n✖ audit-required-checks FAILED:\n");
	for (const e of errors) console.error(e);
	console.error(
		`\n  Fix the workflow, or update ${CHECKS_FILE} + the ruleset (gh api -X PUT repos/<owner>/<repo>/rulesets/${checks.ruleset_id}).\n`,
	);
	return 1;
}

process.exit(main());
