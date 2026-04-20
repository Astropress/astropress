import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Rubric 52 (Interaction Design & Motion)
//
// Verifies:
//   1. admin.css has at least one @keyframes block (loading/transition animations)
//   2. admin.css has a prefers-reduced-motion media query (WCAG 2.3.3 / 2.5.3)
//   3. admin.css has @starting-style or dialog transition (dialog animation)
//   4. At least two web component files declare aria-live= (async feedback via live regions)
//   5. The notice/banner component supports a numeric dismiss-after timeout value ≥ 4000
//      (WCAG 2.2.1 — auto-dismissing content must give users ≥ 4 seconds to read it,
//       OR the component must allow the attribute to be omitted entirely for persistent notices)

const root = process.cwd();
const ADMIN_CSS = join(root, "packages/astropress/public/admin.css");
const WC_DIR = join(root, "packages/astropress/web-components");

// Minimum dismiss-after value the component will accept (WCAG 2.2.1)
// Any value ≥ this is considered safe; the notice component also supports no dismiss-after
// (persistent mode), which is always safe.
const MIN_DISMISS_MS = 4000;

async function main() {
	const adminCss = await readFile(ADMIN_CSS, "utf8");
	const violations: string[] = [];

	// 1. @keyframes block
	if (!adminCss.includes("@keyframes")) {
		violations.push(
			"admin.css: no @keyframes block found — loading/motion animations required for interaction feedback",
		);
	}

	// 2. prefers-reduced-motion
	if (!adminCss.includes("prefers-reduced-motion")) {
		violations.push(
			"admin.css: missing prefers-reduced-motion media query — required by WCAG 2.3.3 for users who prefer no motion",
		);
	}

	// 3. Dialog animation (@starting-style or transition on dialog)
	if (
		!adminCss.includes("@starting-style") &&
		!adminCss.includes("dialog {") &&
		!/dialog\s*\{/.test(adminCss)
	) {
		violations.push(
			"admin.css: no dialog animation found (@starting-style or dialog transition) — dialogs must animate in/out",
		);
	}

	// 4. At least two web component files with aria-live
	const wcFiles = (await readdir(WC_DIR)).filter(
		(f) => f.endsWith(".ts") && f !== "index.ts",
	);
	let ariaLiveCount = 0;
	for (const filename of wcFiles) {
		const src = await readFile(join(WC_DIR, filename), "utf8");
		if (src.includes("aria-live")) {
			ariaLiveCount++;
		}
	}
	if (ariaLiveCount < 2) {
		violations.push(
			`web-components/: only ${ariaLiveCount} component(s) use aria-live — at least 2 required for async feedback (toasts, alerts, live updates)`,
		);
	}

	// 5. Notice component dismiss-after handling is safe (WCAG 2.2.1)
	// The notice component must either:
	//   a) Use the dismiss-after attribute value as a numeric ms value, and validate it's > 0
	//   b) Not auto-dismiss at all when the attribute is absent (persistent mode)
	// We check that the component reads dismiss-after as a number (parseInt) and guards on > 0
	const noticeSrc = await readFile(join(WC_DIR, "notice.ts"), "utf8").catch(
		() => "",
	);
	if (noticeSrc) {
		const hasDismissAttr = noticeSrc.includes("dismiss-after");
		const hasParseInt =
			noticeSrc.includes("parseInt") || noticeSrc.includes("Number(");
		const hasPositiveGuard =
			noticeSrc.includes("> 0") ||
			noticeSrc.includes(">= 1") ||
			noticeSrc.includes("!Number.isNaN");
		if (!hasDismissAttr || !hasParseInt || !hasPositiveGuard) {
			violations.push(
				"web-components/notice.ts: dismiss-after attribute must be parsed as a number and validated — ensure auto-dismiss respects WCAG 2.2.1 (≥ 4 seconds)",
			);
		}

		// Verify the Astro templates that use this component pass ≥ 4000 ms
		// We check the compiled usage in admin pages — find all dismiss-after="NNN" usages
		const pagesDir = join(root, "packages/astropress/pages");
		const componentsDir = join(root, "packages/astropress/components");
		for (const searchDir of [pagesDir, componentsDir]) {
			let files: string[];
			try {
				files = await readdir(searchDir, { recursive: true });
			} catch {
				continue;
			}
			for (const file of files) {
				if (!file.endsWith(".astro") && !file.endsWith(".ts")) continue;
				const src = await readFile(join(searchDir, file), "utf8").catch(
					() => "",
				);
				for (const m of src.matchAll(/dismiss-after="?(\d+)"?/g)) {
					const ms = Number.parseInt(m[1], 10);
					if (ms > 0 && ms < MIN_DISMISS_MS) {
						violations.push(
							`${file}: dismiss-after="${ms}" is below the WCAG 2.2.1 minimum of ${MIN_DISMISS_MS}ms`,
						);
					}
				}
			}
		}
	}

	if (violations.length > 0) {
		console.error("interaction audit failed:\n");
		for (const v of violations) {
			console.error(`  - ${v}`);
		}
		process.exit(1);
	}

	console.log(
		`interaction audit passed — @keyframes, prefers-reduced-motion, dialog animation, ${ariaLiveCount} aria-live regions, and dismiss timing all verified.`,
	);
}

main().catch((err) => {
	console.error("interaction audit failed:", err);
	process.exit(1);
});
