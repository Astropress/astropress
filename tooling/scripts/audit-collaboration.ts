// Rubric 28 (Real-Time Collaboration)
/**
 * Collaboration Audit
 *
 * Verifies that the real-time collaboration / content-locking infrastructure
 * is in place:
 *
 *   1. Lock implementation exists (sqlite-runtime/locks.ts)
 *   2. D1 lock variant exists (d1-locks.ts)
 *   3. Lock web component exists (ap-lock-indicator.ts)
 *   4. Lock action endpoints exist (acquire / refresh / release)
 *   5. Optimistic conflict detection in runtime-actions-content.ts
 *   6. Lock indicator has disconnectedCallback cleanup
 *   7. Content-locking test file exists
 */

import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function main() {
	const violations: string[] = [];

	// 1. Lock implementation exists
	const locksPath = join(
		root,
		"packages/astropress/src/sqlite-runtime/locks.ts",
	);
	if (!(await fileExists(locksPath))) {
		violations.push(
			"[missing-lock-impl] packages/astropress/src/sqlite-runtime/locks.ts does not exist — " +
				"SQLite lock implementation is required for content locking",
		);
	}

	// 2. D1 lock variant exists
	const d1LocksPath = join(root, "packages/astropress/src/d1-locks.ts");
	if (!(await fileExists(d1LocksPath))) {
		violations.push(
			"[missing-d1-locks] packages/astropress/src/d1-locks.ts does not exist — " +
				"D1 lock variant is required for Cloudflare deployments",
		);
	}

	// 3. Lock web component exists
	const lockIndicatorPath = join(
		root,
		"packages/astropress/web-components/ap-lock-indicator.ts",
	);
	if (!(await fileExists(lockIndicatorPath))) {
		violations.push(
			"[missing-lock-indicator] packages/astropress/web-components/ap-lock-indicator.ts does not exist — " +
				"lock indicator web component is required for the admin UI",
		);
	}

	// 4. Lock action endpoints exist
	const actionsDir = join(root, "packages/astropress/pages/ap-admin/actions");
	const requiredActions = [
		"content-lock-acquire",
		"content-lock-refresh",
		"content-lock-release",
	];
	try {
		const actionEntries = await readdir(actionsDir, { recursive: true });
		for (const action of requiredActions) {
			const found = actionEntries.some(
				(entry) => typeof entry === "string" && entry.includes(action),
			);
			if (!found) {
				violations.push(
					`[missing-action] No file matching "${action}" found in packages/astropress/pages/ap-admin/actions/ — lock action endpoint is required`,
				);
			}
		}
	} catch {
		for (const action of requiredActions) {
			violations.push(
				`[missing-action] packages/astropress/pages/ap-admin/actions/ directory not found — cannot verify "${action}" endpoint`,
			);
		}
	}

	// 5. Optimistic conflict detection
	const runtimeActionsPath = join(
		root,
		"packages/astropress/src/runtime-actions-content.ts",
	);
	if (await fileExists(runtimeActionsPath)) {
		const src = await readFile(runtimeActionsPath, "utf8");
		const hasConflictDetection =
			/lastKnownUpdatedAt/i.test(src) ||
			/409/.test(src) ||
			/conflict/i.test(src);
		if (!hasConflictDetection) {
			violations.push(
				"[missing-conflict-detection] packages/astropress/src/runtime-actions-content.ts " +
					"does not contain lastKnownUpdatedAt, 409, or conflict — " +
					"optimistic conflict detection is required",
			);
		}
	} else {
		violations.push(
			"[missing-runtime-actions] packages/astropress/src/runtime-actions-content.ts does not exist — " +
				"cannot verify optimistic conflict detection",
		);
	}

	// 6. Lock indicator has disconnectedCallback cleanup
	if (await fileExists(lockIndicatorPath)) {
		const src = await readFile(lockIndicatorPath, "utf8");
		if (!/disconnectedCallback/.test(src)) {
			violations.push(
				"[missing-cleanup] packages/astropress/web-components/ap-lock-indicator.ts " +
					"does not implement disconnectedCallback — " +
					"web component cleanup is required to avoid resource leaks",
			);
		}
	}

	// 7. Content-locking test file exists
	const testPath = join(
		root,
		"packages/astropress/tests/content-locking.test.ts",
	);
	if (!(await fileExists(testPath))) {
		violations.push(
			"[missing-test] packages/astropress/tests/content-locking.test.ts does not exist — " +
				"content-locking tests are required",
		);
	}

	if (violations.length > 0) {
		console.error(
			`collaboration audit failed — ${violations.length} issue(s):\n`,
		);
		for (const v of violations) console.error(`  - ${v}`);
		console.error(
			"\nFix: ensure all content-locking infrastructure (locks, actions, web component, tests) is in place.",
		);
		process.exit(1);
	}

	console.log(
		"collaboration audit passed — all real-time collaboration infrastructure verified.",
	);
}

main().catch((err) => {
	console.error("collaboration audit failed:", err);
	process.exit(1);
});
