#!/usr/bin/env bun
/**
 * Two-phase rotation step 2: re-seal every integration_secrets row
 * still tagged kid="previous" under the current rootSecret.
 *
 * Operator workflow:
 *
 *   1. Set ASTROPRESS_ROOT_SECRET_PREV=<old>, ASTROPRESS_ROOT_SECRET=<new>.
 *      Deploy. New writes seal under current; reads transparently fall
 *      back to previous and reseal opportunistically.
 *
 *   2. Run this script:
 *        bun run tooling/scripts/rotate-integration-secrets.ts \
 *          --db /path/to/admin.db
 *      Idempotent — running again is a no-op once every row carries
 *      kid="current". Per-row update is guarded so a concurrent admin
 *      write cannot be clobbered.
 *
 *   3. Confirm "0 rows remaining on previous". Unset _PREV. Deploy.
 *
 * Disaster case: if `ASTROPRESS_ROOT_SECRET_PREV` is missing or wrong,
 * decryption fails and the script reports the affected rows so the
 * operator can choose between (a) re-supplying the old secret or
 * (b) reconnecting those integrations from the UI. The script never
 * writes a row it can't decrypt.
 */

import { DatabaseSync } from "node:sqlite";
import { createIntegrationsRepository } from "../../packages/astropress/src/sqlite-runtime/integrations.js";

interface CliArgs {
	db: string;
	dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
	let db = "";
	let dryRun = false;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--db") {
			db = argv[++i] ?? "";
		} else if (arg === "--dry-run") {
			dryRun = true;
		} else if (arg === "--help" || arg === "-h") {
			printHelpAndExit(0);
		} else {
			console.error(`Unknown arg: ${arg}`);
			printHelpAndExit(2);
		}
	}
	if (!db) {
		console.error("--db <path> is required");
		printHelpAndExit(2);
	}
	return { db, dryRun };
}

function printHelpAndExit(code: number): never {
	console.error(
		"usage: rotate-integration-secrets --db <path> [--dry-run]\n" +
			"\n" +
			"Re-seal every integration_secrets row still on the previous key.\n" +
			"Idempotent. Requires both ASTROPRESS_ROOT_SECRET (new, current) and\n" +
			"ASTROPRESS_ROOT_SECRET_PREV (old) in the environment.",
	);
	process.exit(code);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const current = process.env.ASTROPRESS_ROOT_SECRET ?? "";
	const previous = process.env.ASTROPRESS_ROOT_SECRET_PREV ?? "";
	if (!current || !previous) {
		console.error("Both ASTROPRESS_ROOT_SECRET and ASTROPRESS_ROOT_SECRET_PREV must be set.");
		process.exit(2);
	}

	const db = new DatabaseSync(args.db);
	db.exec("PRAGMA foreign_keys = ON");

	const repo = createIntegrationsRepository({
		getDb: () => db as never,
		now: () => new Date().toISOString(),
	});

	const pending = repo.listPreviousKidContexts();
	if (pending.length === 0) {
		console.log("0 rows remaining on previous — nothing to rotate.");
		db.close();
		return;
	}

	console.log(`Rotating ${pending.length} secret(s) onto the current key...`);
	let rotated = 0;
	const failed: { domain: string; provider: string; reason: string }[] = [];
	for (const ctx of pending) {
		if (args.dryRun) {
			console.log(`  would rotate ${ctx.domain}/${ctx.provider}`);
			continue;
		}
		try {
			// findSecret triggers the guarded reseal-on-read for previous-kid
			// rows. Discarding the result keeps plaintext off this script's
			// stack frames longer than necessary.
			await repo.findSecret(ctx.domain, ctx.provider, { current, previous });
			rotated += 1;
			console.log(`  rotated ${ctx.domain}/${ctx.provider}`);
		} catch (err) {
			const reason = err instanceof Error ? err.name : "unknown";
			failed.push({ ...ctx, reason });
			console.error(`  FAILED ${ctx.domain}/${ctx.provider}: ${reason}`);
		}
	}

	const remaining = repo.listPreviousKidContexts();
	console.log(
		`\nRotated: ${rotated}, Failed: ${failed.length}, Remaining on previous: ${remaining.length}`,
	);
	db.close();

	if (failed.length > 0) {
		console.error(
			"\nSome rows could not be re-sealed. Confirm ASTROPRESS_ROOT_SECRET_PREV " +
				"matches the key these rows were originally sealed under, or reconnect " +
				"them from the admin UI.",
		);
		process.exit(1);
	}
	if (remaining.length > 0) {
		// Should be impossible without failures, but guard against logic drift.
		console.error("Rotation incomplete (unexpected). See logs.");
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("rotation crashed:", err);
	process.exit(1);
});
