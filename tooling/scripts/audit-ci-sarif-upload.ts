// Audit that every `upload-sarif` step in `.github/workflows/*.yml` has a
// corresponding "ensure SARIF exists" step in the same job, placed BEFORE
// the upload. Closes the 2026-04-24 failure mode where a producing tool
// (Nuclei) skipped its SARIF on zero findings, breaking upload-sarif.

import { readdirSync } from "node:fs";
import {
	AuditReport,
	fromRoot,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const WORKFLOWS_DIR = fromRoot(".github/workflows");

interface Step {
	lineIndex: number;
	name: string;
	uses?: string;
	runBody?: string;
	sarifFile?: string;
}

function parseSteps(lines: string[]): Step[] {
	const steps: Step[] = [];
	let current: Step | null = null;
	let inRun = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const stepStart = line.match(/^\s*-\s+name:\s*(.*)$/);
		const stepStartUses = line.match(/^\s*-\s+uses:\s*(\S+)/);
		if (stepStart) {
			if (current) steps.push(current);
			current = { lineIndex: i, name: stepStart[1].trim().replace(/["']/g, "") };
			inRun = false;
			continue;
		}
		if (stepStartUses && !current) {
			// anonymous step (uses without name)
			current = {
				lineIndex: i,
				name: `(anonymous uses ${stepStartUses[1]})`,
				uses: stepStartUses[1],
			};
			inRun = false;
			continue;
		}
		if (!current) continue;
		const usesMatch = line.match(/^\s{8,}uses:\s*(\S+)/);
		if (usesMatch && !current.uses) current.uses = usesMatch[1];
		const sarifMatch = line.match(/^\s{10,}sarif_file:\s*(\S+)/);
		if (sarifMatch) current.sarifFile = sarifMatch[1];
		const runStartLiteral = line.match(/^\s{8,}run:\s*\|/);
		const runStartInline = line.match(/^\s{8,}run:\s*(.+)$/);
		if (runStartLiteral) {
			inRun = true;
			current.runBody = "";
			continue;
		}
		if (runStartInline && !runStartLiteral) {
			current.runBody = runStartInline[1];
			inRun = false;
		}
		if (inRun) {
			current.runBody = (current.runBody ?? "") + line + "\n";
		}
	}
	if (current) steps.push(current);
	return steps;
}

function hasPrecedingFallback(steps: Step[], upload: Step): boolean {
	const sarif = upload.sarifFile;
	if (!sarif) return false;
	for (const step of steps) {
		if (step.lineIndex >= upload.lineIndex) break;
		const nameLower = step.name.toLowerCase();
		if (/ensure.*sarif|sarif.*exists|fallback/.test(nameLower)) return true;
		if (step.runBody && step.runBody.includes(sarif)) {
			if (/touch\b|cat\s*>\s*|echo\b|>\s*\S+\.sarif|cp\s/.test(step.runBody)) {
				return true;
			}
		}
	}
	return false;
}

async function main() {
	const report = new AuditReport("ci-sarif-upload");
	let files: string[] = [];
	try {
		files = readdirSync(WORKFLOWS_DIR).filter(
			(f) => f.endsWith(".yml") || f.endsWith(".yaml"),
		);
	} catch {
		report.finish("ci-sarif-upload audit skipped — no .github/workflows directory");
	}

	let uploadSarifCount = 0;
	for (const file of files) {
		const body = await readText(`${WORKFLOWS_DIR}/${file}`);
		const lines = body.split("\n");
		const steps = parseSteps(lines);

		for (const step of steps) {
			if (!step.uses?.includes("upload-sarif")) continue;
			uploadSarifCount++;
			if (!step.sarifFile) {
				report.add(
					`${file}:${step.lineIndex + 1}: upload-sarif "${step.name}" has no sarif_file: input`,
				);
				continue;
			}
			if (!hasPrecedingFallback(steps, step)) {
				report.add(
					`${file}:${step.lineIndex + 1}: upload-sarif "${step.name}" references ${step.sarifFile} ` +
						`but no preceding step creates/touches it. A producing tool that skips its SARIF on zero ` +
						`findings will fail the upload. Add an "Ensure SARIF exists" step that synthesizes an ` +
						`empty-results SARIF when ${step.sarifFile} is missing.`,
				);
			}
		}
	}

	report.finish(
		`ci-sarif-upload audit passed — ${uploadSarifCount} upload-sarif step(s) checked across ` +
			`${files.length} workflow file(s).`,
	);
}

runAudit("ci-sarif-upload", main);
