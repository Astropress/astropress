// Rubric 52 (Interaction Design & Motion)
//
// Verifies:
//   1. admin.css has at least one @keyframes block (loading/transition animations)
//   2. admin.css has a prefers-reduced-motion media query (WCAG 2.3.3 / 2.5.3)
//   3. admin.css has @starting-style or dialog transition (dialog animation)
//   4. At least two web component files declare aria-live= (async feedback via live regions)
//   5. The notice/banner component supports a numeric dismiss-after timeout value ≥ 4000
//      (WCAG 2.2.1 — auto-dismissing content must give users ≥ 4 seconds to read it)

import { join } from "node:path";
import {
	AuditReport,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const ADMIN_CSS = fromRoot("packages/astropress/public/admin.css");
const WC_DIR = fromRoot("packages/astropress/web-components");
const MIN_DISMISS_MS = 4000;

async function main() {
	const report = new AuditReport("interaction");
	const adminCss = await readText(ADMIN_CSS);

	if (!adminCss.includes("@keyframes")) {
		report.add(
			"admin.css: no @keyframes block found — loading/motion animations required for interaction feedback",
		);
	}
	if (!adminCss.includes("prefers-reduced-motion")) {
		report.add(
			"admin.css: missing prefers-reduced-motion media query — required by WCAG 2.3.3 for users who prefer no motion",
		);
	}
	if (
		!adminCss.includes("@starting-style") &&
		!/dialog\s*\{/.test(adminCss)
	) {
		report.add(
			"admin.css: no dialog animation found (@starting-style or dialog transition) — dialogs must animate in/out",
		);
	}

	const wcFiles = await listFiles(WC_DIR, { extensions: [".ts"], exclude: ["index.ts"] });
	let ariaLiveCount = 0;
	for (const filename of wcFiles) {
		const src = await readText(join(WC_DIR, filename));
		if (src.includes("aria-live")) ariaLiveCount++;
	}
	if (ariaLiveCount < 2) {
		report.add(
			`web-components/: only ${ariaLiveCount} component(s) use aria-live — at least 2 required for async feedback (toasts, alerts, live updates)`,
		);
	}

	const noticeSrc = await readText(join(WC_DIR, "notice.ts"));
	if (noticeSrc) {
		const hasDismissAttr = noticeSrc.includes("dismiss-after");
		const hasParseInt = noticeSrc.includes("parseInt") || noticeSrc.includes("Number(");
		const hasPositiveGuard =
			noticeSrc.includes("> 0") ||
			noticeSrc.includes(">= 1") ||
			noticeSrc.includes("!Number.isNaN");
		if (!hasDismissAttr || !hasParseInt || !hasPositiveGuard) {
			report.add(
				"web-components/notice.ts: dismiss-after attribute must be parsed as a number and validated — ensure auto-dismiss respects WCAG 2.2.1 (≥ 4 seconds)",
			);
		}

		for (const searchDir of [
			fromRoot("packages/astropress/pages"),
			fromRoot("packages/astropress/components"),
		]) {
			const files = await listFiles(searchDir, {
				recursive: true,
				extensions: [".astro", ".ts"],
			});
			for (const file of files) {
				const src = await readText(join(searchDir, file));
				for (const m of src.matchAll(/dismiss-after="?(\d+)"?/g)) {
					const ms = Number.parseInt(m[1], 10);
					if (ms > 0 && ms < MIN_DISMISS_MS) {
						report.add(
							`${file}: dismiss-after="${ms}" is below the WCAG 2.2.1 minimum of ${MIN_DISMISS_MS}ms`,
						);
					}
				}
			}
		}
	}

	report.finish(
		`interaction audit passed — @keyframes, prefers-reduced-motion, dialog animation, ${ariaLiveCount} aria-live regions, and dismiss timing all verified.`,
	);
}

runAudit("interaction", main);
