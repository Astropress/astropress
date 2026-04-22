import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Rubrics 8 (Browser/Web API Usage), 9 (Web Components), 10 (Spec Coherence — WC First-Class)
//
// Verifies that every custom element in packages/astropress/web-components/:
//   1. Calls customElements.define('ap-...') — enforces the ap- prefix naming convention
//   2. Has connectedCallback — required lifecycle hook
//   3. Has disconnectedCallback — prevents event listener leaks
//   4. Has a cleanup mechanism: AbortController, clearTimeout, or removeEventListener
//   5. Does not use XMLHttpRequest — all async I/O must use fetch()
//   6. Is re-exported from web-components/index.ts — no orphaned component files

const root = process.cwd();
const WC_DIR = join(root, "packages/astropress/web-components");
const INDEX_TS = join(WC_DIR, "index.ts");

async function main() {
	const allFiles = await readdir(WC_DIR);
	const componentFiles = allFiles.filter(
		(f) => f.endsWith(".ts") && f !== "index.ts",
	);

	const indexSrc = await readFile(INDEX_TS, "utf8");
	const violations: string[] = [];

	for (const filename of componentFiles) {
		const filePath = join(WC_DIR, filename);
		const src = await readFile(filePath, "utf8");
		const label = `web-components/${filename}`;

		// 1. customElements.define with ap- prefix
		if (
			!src.includes('customElements.define("ap-') &&
			!src.includes("customElements.define('ap-")
		) {
			violations.push(
				`${label}: missing customElements.define('ap-...')  — custom element name must use the ap- prefix`,
			);
		}

		// 2. connectedCallback
		if (
			!src.includes("connectedCallback()") &&
			!src.includes("connectedCallback (){")
		) {
			violations.push(
				`${label}: missing connectedCallback — required lifecycle hook`,
			);
		}

		// 3. disconnectedCallback
		if (
			!src.includes("disconnectedCallback()") &&
			!src.includes("disconnectedCallback (){")
		) {
			violations.push(
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
			violations.push(
				`${label}: no cleanup mechanism found — use AbortController, clearTimeout, clearInterval, or removeEventListener in disconnectedCallback`,
			);
		}

		// 5. No XMLHttpRequest
		if (src.includes("XMLHttpRequest")) {
			violations.push(`${label}: XMLHttpRequest found — use fetch() instead`);
		}

		// 6. Exported from index.ts
		// Strip the .ts extension for the import path check
		const moduleName = filename.replace(/\.ts$/, "");
		if (
			!indexSrc.includes(`"./${moduleName}"`) &&
			!indexSrc.includes(`'./${moduleName}'`)
		) {
			violations.push(
				`${label}: not exported from web-components/index.ts — every component file must be re-exported`,
			);
		}
	}

	if (violations.length > 0) {
		console.error("web-components audit failed:\n");
		for (const v of violations) {
			console.error(`  - ${v}`);
		}
		process.exit(1);
	}

	console.log(
		`web-components audit passed — ${componentFiles.length} components: naming, lifecycle, cleanup, fetch-only, and index exports all verified.`,
	);
}

main().catch((err) => {
	console.error("web-components audit failed:", err);
	process.exit(1);
});
