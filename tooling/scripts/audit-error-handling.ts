import { join } from "node:path";
import {
	AuditReport,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

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

const SRC_DIR = fromRoot("packages/astropress/src");

async function checkFile(
	report: AuditReport,
	filePath: string,
	label: string,
	requireOkResult = true,
): Promise<void> {
	const src = await readText(filePath);

	if (requireOkResult) {
		const hasRuntimeExport =
			/^export (async function|function|const|class)\b/m.test(src);
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
				src.includes("Promise<void>");
			if (!hasOkResult) {
				report.add(
					`${label}: no typed result pattern found — exported functions must return { ok: boolean } or Promise<void>, not throw at callers`,
				);
			}
		}
	}

	if (/catch\s*\([^)]*\)\s*\{\s*throw\s+\w/m.test(src)) {
		report.add(
			`${label}: naked re-throw detected — catch blocks must handle errors (log, return { ok: false }, or wrap), not blindly re-throw`,
		);
	}
}

async function main() {
	const report = new AuditReport("error-handling");

	// 1. admin-action-*.ts files
	const srcFiles = await listFiles(SRC_DIR);
	const actionFiles = srcFiles.filter(
		(f) => f.startsWith("admin-action-") && f.endsWith(".ts"),
	);

	for (const filename of actionFiles) {
		await checkFile(report, join(SRC_DIR, filename), `src/${filename}`);
	}

	// 2. deploy/*.ts files
	const deployDir = join(SRC_DIR, "deploy");
	const deployEntries = await listFiles(deployDir);
	let deployFiles: string[];
	if (deployEntries.length === 0) {
		// Distinguish empty dir from missing: use listFiles with recursive to probe
		const probeAll = await listFiles(deployDir, { recursive: true });
		if (probeAll.length === 0) {
			report.add(
				"src/deploy/: directory not found — deploy target implementations are missing",
			);
			deployFiles = [];
		} else {
			deployFiles = deployEntries.filter((f) => f.endsWith(".ts"));
		}
	} else {
		deployFiles = deployEntries.filter((f) => f.endsWith(".ts"));
	}

	for (const filename of deployFiles) {
		await checkFile(
			report,
			join(deployDir, filename),
			`src/deploy/${filename}`,
			false,
		);
	}

	// 3. cache-purge.ts: failures must be console.warn, not throw
	const cachePurgePath = join(SRC_DIR, "cache-purge.ts");
	const cachePurgeSrc = await readText(cachePurgePath);
	if (!cachePurgeSrc) {
		report.add(
			"src/cache-purge.ts: file not found — CDN cache purge strategy is missing",
		);
	} else {
		if (
			/\.catch\s*\([^)]*\)\s*\{\s*throw/m.test(cachePurgeSrc) ||
			/catch\s*\([^)]*\)\s*\{\s*throw/m.test(cachePurgeSrc)
		) {
			report.add(
				"src/cache-purge.ts: cache purge failure throws an error — CDN failures must be non-fatal (console.warn only)",
			);
		}
		if (!cachePurgeSrc.includes("console.warn")) {
			report.add(
				"src/cache-purge.ts: no console.warn found — CDN purge failures should be logged, not silently swallowed",
			);
		}
	}

	report.finish(
		`error-handling audit passed — ${actionFiles.length} admin-action files, ${deployFiles.length} deploy files, and cache-purge all use safe error patterns.`,
	);
}

runAudit("error-handling", main);
