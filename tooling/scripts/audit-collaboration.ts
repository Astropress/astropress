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

import {
	AuditReport,
	fileExists,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

async function main() {
	const report = new AuditReport("collaboration");

	// 1. Lock implementation exists
	const locksPath = fromRoot("packages/astropress/src/sqlite-runtime/locks.ts");
	if (!(await fileExists(locksPath))) {
		report.add(
			"[missing-lock-impl] packages/astropress/src/sqlite-runtime/locks.ts does not exist — " +
				"SQLite lock implementation is required for content locking",
		);
	}

	// 2. D1 lock variant exists
	const d1LocksPath = fromRoot("packages/astropress/src/d1-locks.ts");
	if (!(await fileExists(d1LocksPath))) {
		report.add(
			"[missing-d1-locks] packages/astropress/src/d1-locks.ts does not exist — " +
				"D1 lock variant is required for Cloudflare deployments",
		);
	}

	// 3. Lock web component exists
	const lockIndicatorPath = fromRoot(
		"packages/astropress/web-components/ap-lock-indicator.ts",
	);
	if (!(await fileExists(lockIndicatorPath))) {
		report.add(
			"[missing-lock-indicator] packages/astropress/web-components/ap-lock-indicator.ts does not exist — " +
				"lock indicator web component is required for the admin UI",
		);
	}

	// 4. Lock action endpoints exist
	const actionsDir = fromRoot("packages/astropress/pages/ap-admin/actions");
	const requiredActions = [
		"content-lock-acquire",
		"content-lock-refresh",
		"content-lock-release",
	];
	const actionEntries = await listFiles(actionsDir, { recursive: true });
	if (actionEntries.length === 0 && !(await fileExists(actionsDir))) {
		for (const action of requiredActions) {
			report.add(
				`[missing-action] packages/astropress/pages/ap-admin/actions/ directory not found — cannot verify "${action}" endpoint`,
			);
		}
	} else {
		for (const action of requiredActions) {
			const found = actionEntries.some((entry) => entry.includes(action));
			if (!found) {
				report.add(
					`[missing-action] No file matching "${action}" found in packages/astropress/pages/ap-admin/actions/ — lock action endpoint is required`,
				);
			}
		}
	}

	// 5. Optimistic conflict detection
	const runtimeActionsPath = fromRoot(
		"packages/astropress/src/runtime-actions-content.ts",
	);
	if (await fileExists(runtimeActionsPath)) {
		const src = await readText(runtimeActionsPath);
		const hasConflictDetection =
			/lastKnownUpdatedAt/i.test(src) ||
			/409/.test(src) ||
			/conflict/i.test(src);
		if (!hasConflictDetection) {
			report.add(
				"[missing-conflict-detection] packages/astropress/src/runtime-actions-content.ts " +
					"does not contain lastKnownUpdatedAt, 409, or conflict — " +
					"optimistic conflict detection is required",
			);
		}
	} else {
		report.add(
			"[missing-runtime-actions] packages/astropress/src/runtime-actions-content.ts does not exist — " +
				"cannot verify optimistic conflict detection",
		);
	}

	// 6. Lock indicator has disconnectedCallback cleanup
	if (await fileExists(lockIndicatorPath)) {
		const src = await readText(lockIndicatorPath);
		if (!/disconnectedCallback/.test(src)) {
			report.add(
				"[missing-cleanup] packages/astropress/web-components/ap-lock-indicator.ts " +
					"does not implement disconnectedCallback — " +
					"web component cleanup is required to avoid resource leaks",
			);
		}
	}

	// 7. Content-locking test file exists
	const testPath = fromRoot("packages/astropress/tests/content-locking.test.ts");
	if (!(await fileExists(testPath))) {
		report.add(
			"[missing-test] packages/astropress/tests/content-locking.test.ts does not exist — " +
				"content-locking tests are required",
		);
	}

	if (report.failed) {
		console.error(
			"\nFix: ensure all content-locking infrastructure (locks, actions, web component, tests) is in place.",
		);
	}

	report.finish(
		"collaboration audit passed — all real-time collaboration infrastructure verified.",
	);
}

runAudit("collaboration", main);
