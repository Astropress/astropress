import { join } from "node:path";
import {
	AuditReport,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

// Rubrics 8 (Browser/Web API Usage), 9 (Web Components), 10 (Spec Coherence — WC First-Class)
//
// Verifies that every custom element in packages/astropress/web-components/:
//   1. Calls customElements.define('ap-...') — enforces the ap- prefix naming convention
//   2. Has connectedCallback — required lifecycle hook
//   3. Has disconnectedCallback — prevents event listener leaks
//   4. Has a cleanup mechanism: AbortController, clearTimeout, or removeEventListener
//   5. Does not use XMLHttpRequest — all async I/O must use fetch()
//   6. Is re-exported from web-components/index.ts — no orphaned component files

const WC_DIR = fromRoot("packages/astropress/web-components");
const INDEX_TS = join(WC_DIR, "index.ts");

async function main() {
	const report = new AuditReport("web-components");
	const allFiles = await listFiles(WC_DIR);
	const componentFiles = allFiles.filter(
		(f) => f.endsWith(".ts") && f !== "index.ts",
	);

	const indexSrc = await readText(INDEX_TS);

	for (const filename of componentFiles) {
		const filePath = join(WC_DIR, filename);
		const src = await readText(filePath);
		const label = `web-components/${filename}`;

		// 1. customElements.define with ap- prefix
		if (
			!src.includes('customElements.define("ap-') &&
			!src.includes("customElements.define('ap-")
		) {
			report.add(
				`${label}: missing customElements.define('ap-...')  — custom element name must use the ap- prefix`,
			);
		}

		// 2. connectedCallback
		if (
			!src.includes("connectedCallback()") &&
			!src.includes("connectedCallback (){")
		) {
			report.add(
				`${label}: missing connectedCallback — required lifecycle hook`,
			);
		}

		// 3. disconnectedCallback
		if (
			!src.includes("disconnectedCallback()") &&
			!src.includes("disconnectedCallback (){")
		) {
			report.add(
				`${label}: missing disconnectedCallback — required to prevent memory/listener leaks`,
			);
		}

		// 4. Cleanup mechanism (any of these patterns is acceptable)
		const hasAbortController = src.includes("AbortController");
		const hasClearTimeout = src.includes("clearTimeout");
		const hasClearInterval = src.includes("clearInterval");
		const hasRemoveEventListener = src.includes("removeEventListener");
		if (
			!hasAbortController &&
			!hasClearTimeout &&
			!hasClearInterval &&
			!hasRemoveEventListener
		) {
			report.add(
				`${label}: no cleanup mechanism found — use AbortController, clearTimeout, clearInterval, or removeEventListener in disconnectedCallback`,
			);
		}

		// 5. No XMLHttpRequest
		if (src.includes("XMLHttpRequest")) {
			report.add(`${label}: XMLHttpRequest found — use fetch() instead`);
		}

		// 6. Exported from index.ts
		const moduleName = filename.replace(/\.ts$/, "");
		if (
			!indexSrc.includes(`"./${moduleName}"`) &&
			!indexSrc.includes(`'./${moduleName}'`)
		) {
			report.add(
				`${label}: not exported from web-components/index.ts — every component file must be re-exported`,
			);
		}
	}

	report.finish(
		`web-components audit passed — ${componentFiles.length} components: naming, lifecycle, cleanup, fetch-only, and index exports all verified.`,
	);
}

runAudit("web-components", main);
