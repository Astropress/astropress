#!/usr/bin/env bun
/**
 * audit-astro-build-gap — confirm that the framework's own .astro files
 * are NOT type-checked anywhere in the build/pre-push pipeline.
 *
 * Counts framework .astro files vs files that any astro-check'd project
 * actually covers, and emits the gap. Discovery only.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const OUT = "tooling/audit-output/astro-build-gap.json";

function count(glob: string): number {
	try {
		const out = execFileSync("bash", ["-c", `find ${glob} -name "*.astro" 2>/dev/null | wc -l`], {
			encoding: "utf8",
		});
		return Number.parseInt(out.trim(), 10);
	} catch {
		return 0;
	}
}

function grepAstroCheckScripts(): string[] {
	try {
		const out = execFileSync(
			"bash",
			[
				"-c",
				'grep -lE "astro check|astro build" packages/*/package.json examples/*/package.json 2>/dev/null',
			],
			{ encoding: "utf8" },
		);
		return out.trim().split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

const frameworkPages = count("packages/astropress/pages");
const frameworkComponents = count("packages/astropress/components");
const harnessPages = count("examples/admin-harness");
const docsPages = count("packages/docs");
const checkedScripts = grepAstroCheckScripts();

const checked = harnessPages + docsPages;
const total = frameworkPages + frameworkComponents + harnessPages + docsPages;

const report = {
	generatedAt: new Date().toISOString(),
	frameworkPagesAstroCount: frameworkPages,
	frameworkComponentsAstroCount: frameworkComponents,
	harnessAstroCount: harnessPages,
	docsAstroCount: docsPages,
	totalAstro: total,
	astroCheckedAstro: checked,
	uncheckedAstro: total - checked,
	packageJsonsRunningAstroCheck: checkedScripts,
	finding:
		frameworkPages > 0 && !checkedScripts.some((p) => p.includes("astropress/package.json"))
			? "FRAMEWORK_PAGES_HAVE_NO_ASTRO_CHECK"
			: "ok",
};

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(
	`astro-build-gap: framework=${frameworkPages + frameworkComponents} checked=${checked} unchecked=${report.uncheckedAstro} finding=${report.finding}`,
);
