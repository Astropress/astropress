#!/usr/bin/env bun
/**
 * audit-admin-route-drift — surface entrypoints on disk that are not
 * registered in admin-routes.ts, and registry entries whose entrypoint
 * file is missing.
 *
 * Discovery audit only. Writes JSON to tooling/audit-output/route-drift.json
 * and exits 0. No gating yet.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";

const ADMIN_DIR = "packages/astropress/pages/ap-admin";
const ROUTES_FILE = "packages/astropress/src/admin-routes-definitions.ts";
const OUT = "tooling/audit-output/route-drift.json";

function listFiles(): string[] {
	const out = execFileSync(
		"find",
		[
			ADMIN_DIR,
			"-type",
			"f",
			"(",
			"-name",
			"*.astro",
			"-o",
			"-name",
			"*.ts",
			")",
		],
		{ encoding: "utf8" },
	);
	return out
		.trim()
		.split("\n")
		.filter(Boolean)
		.map((p) => relative(ADMIN_DIR, p))
		.sort();
}

function readRegisteredEntrypoints(): string[] {
	const src = readFileSync(ROUTES_FILE, "utf8");
	const re = /entrypoint:\s*"([^"]+)"/g;
	const out: string[] = [];
	let m: RegExpExecArray | null;
	while (true) {
		m = re.exec(src);
		if (m === null) break;
		out.push(m[1]);
	}
	return out.sort();
}

function main(): void {
	const onDisk = listFiles();
	const registered = readRegisteredEntrypoints();
	const onDiskSet = new Set(onDisk);
	const regSet = new Set(registered);

	const unregisteredEntrypoints = onDisk.filter((f) => !regSet.has(f));
	const unbackedRegistryEntries = registered.filter((f) => !onDiskSet.has(f));

	const report = {
		generatedAt: new Date().toISOString(),
		onDiskCount: onDisk.length,
		registeredCount: registered.length,
		unregistered: unregisteredEntrypoints.length,
		unbacked: unbackedRegistryEntries.length,
		unregisteredEntrypoints,
		unbackedRegistryEntries,
	};

	if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
	writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
	console.log(
		`route-drift: onDisk=${report.onDiskCount} registered=${report.registeredCount} unregistered=${report.unregistered} unbacked=${report.unbacked}`,
	);

	// Gate via baseline file: lock the current set of unregistered entrypoints
	// (mostly action handlers that legitimately live outside the registry, plus
	// genuine orphans pending triage) so future commits cannot ADD a new
	// unregistered .astro/.ts file. Existing entries are grandfathered until the
	// W1 cleanup pairs each one with a registry decision.
	const BASELINE = "tooling/audit-output/route-drift-baseline.json";
	if (process.argv.includes("--rewrite-baseline")) {
		writeFileSync(
			BASELINE,
			`${JSON.stringify(
				{
					updatedAt: new Date().toISOString(),
					unregisteredEntrypoints,
					unbackedRegistryEntries,
				},
				null,
				2,
			)}\n`,
		);
		console.log(
			`route-drift baseline rewritten: ${unregisteredEntrypoints.length} grandfathered.`,
		);
		return;
	}
	let baseline: {
		unregisteredEntrypoints: string[];
		unbackedRegistryEntries: string[];
	} = {
		unregisteredEntrypoints: [],
		unbackedRegistryEntries: [],
	};
	if (existsSync(BASELINE)) {
		baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
	}
	const baselineUnreg = new Set(baseline.unregisteredEntrypoints);
	const baselineUnbacked = new Set(baseline.unbackedRegistryEntries);
	const newUnregistered = unregisteredEntrypoints.filter(
		(p) => !baselineUnreg.has(p),
	);
	const newUnbacked = unbackedRegistryEntries.filter(
		(p) => !baselineUnbacked.has(p),
	);
	if (newUnregistered.length > 0 || newUnbacked.length > 0) {
		console.error("route-drift FAIL:");
		for (const p of newUnregistered)
			console.error(`  unregistered (new): ${p}`);
		for (const p of newUnbacked) console.error(`  unbacked (new): ${p}`);
		console.error(
			"\nEither register the file in packages/astropress/src/admin-routes-definitions.ts, delete it, OR (intentional) run:\n  bun run tooling/scripts/audit-admin-route-drift.ts --rewrite-baseline",
		);
		process.exit(1);
	}
}

main();
