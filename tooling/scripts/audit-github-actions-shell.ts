/**
 * GitHub Actions shell interpolation audit.
 *
 * GitHub expressions are expanded before shell execution. Do not interpolate
 * tainted contexts directly into `run:` bodies; route them through `env:` and
 * quote the shell variable instead.
 */

import { join, relative } from "node:path";
import {
	AuditReport,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const WORKFLOWS_DIR = fromRoot(".github");
const DIRECT_EXPRESSION_PATTERN = /\$\{\{\s*(github|inputs|secrets)\.[^}]+}}/;

type RunBlock = {
	startLine: number;
	lines: Array<{ lineNumber: number; text: string }>;
};

function indentation(line: string): number {
	const match = line.match(/^\s*/);
	return match?.[0].length ?? 0;
}

function collectRunBlocks(source: string): RunBlock[] {
	const lines = source.split("\n");
	const blocks: RunBlock[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const runMatch = line.match(/^(\s*)run:\s*(.*)$/);
		if (!runMatch) continue;

		const startLine = index + 1;
		const runIndent = runMatch[1].length;
		const value = runMatch[2];

		if (value && value !== "|" && value !== ">") {
			blocks.push({
				startLine,
				lines: [{ lineNumber: startLine, text: value }],
			});
			continue;
		}

		const blockLines: RunBlock["lines"] = [];
		for (let bodyIndex = index + 1; bodyIndex < lines.length; bodyIndex += 1) {
			const bodyLine = lines[bodyIndex];
			if (bodyLine.trim() !== "" && indentation(bodyLine) <= runIndent) {
				break;
			}
			blockLines.push({ lineNumber: bodyIndex + 1, text: bodyLine });
		}

		blocks.push({ startLine, lines: blockLines });
	}

	return blocks;
}

async function main() {
	const report = new AuditReport("github-actions-shell");
	const actionFiles = (
		await listFiles(WORKFLOWS_DIR, {
			recursive: true,
			extensions: [".yml", ".yaml"],
		})
	).sort();

	for (const entry of actionFiles) {
		const filePath = join(WORKFLOWS_DIR, entry);
		const source = await readText(filePath);
		const relPath = relative(process.cwd(), filePath);

		for (const block of collectRunBlocks(source)) {
			for (const line of block.lines) {
				const match = line.text.match(DIRECT_EXPRESSION_PATTERN);
				if (!match) continue;
				report.add(
					`${relPath}:${line.lineNumber}: run block starting at line ${block.startLine} ` +
						`directly interpolates \`${match[0]}\`. Move the expression to step env ` +
						`and reference the quoted shell variable inside run:.`,
				);
			}
		}
	}

	report.finish(
		`github-actions-shell audit passed — ${actionFiles.length} workflow/action file(s) checked.`,
	);
}

runAudit("github-actions-shell", main);
