/**
 * Single source of truth for audit-script registration.
 *
 * Adding a new `audit-*.ts` script today requires touching at minimum:
 *
 *   - `package.json` — add an `audit:<name>` entry under scripts;
 *   - `lefthook.yml` pre-commit — register a job with the right glob;
 *   - `.github/workflows/ci.yml` lint job — invoke `bun run audit:<name>`;
 *   - sometimes `tooling/scripts/prepush-gates.ts` — declare the audit
 *     in step inputs (slow audits) or test-fanout caps.
 *
 * Drift between those four files is silently tolerated by every
 * other tool, which is how we accumulate stale entries. This
 * manifest centralises the metadata; `audit:registry-sync` (in
 * `tooling/scripts/audit-registry-sync.ts`) verifies all four call
 * sites stay in lockstep with the manifest.
 *
 * Migration is incremental: the manifest covers the audits that
 * have shipped this PR (integration-honesty, integration-secrets,
 * registry-sync itself). Older audits will be folded in as their
 * call sites change. The audit only flags drift for entries the
 * manifest knows about, so partial coverage is safe.
 */

export type AuditTier = 1 | 2 | 3;

export interface AuditEntry {
	/** Slug used as `audit:<name>` in package.json. */
	readonly name: string;
	/** Path to the script relative to repo root. */
	readonly script: string;
	/**
	 * Whether the audit runs at pre-commit. Pre-commit audits must
	 * complete in <1s on a typical staged change-set; long audits
	 * belong in pre-push tier 2/3.
	 */
	readonly preCommit: boolean;
	/** Whether the audit runs in CI (lint job). */
	readonly ci: boolean;
	/**
	 * Pre-push tier. Tier 1 = fast parallel; tier 2 = slow audits
	 * batch (`slow-audits` lefthook command); tier 3 = mutation
	 * gate. Omit when not pre-push wired.
	 */
	readonly prePushTier?: AuditTier;
	/**
	 * Lefthook glob filter (when pre-commit). Empty array means the
	 * audit runs unconditionally (e.g. honesty audit reads tracked
	 * files independent of staged content).
	 */
	readonly preCommitGlob?: string;
	/** One-line human description. */
	readonly description: string;
}

export const AUDITS: readonly AuditEntry[] = [
	{
		name: "integration-honesty",
		script: "tooling/scripts/audit-integration-honesty.ts",
		preCommit: false,
		ci: false,
		description:
			"Cross-checks INTEGRATIONS + ADMIN_STUB_PAGES manifests against the actual ap-admin pages. Currently runs via Playwright project; pre-commit/CI wiring is a follow-up.",
	},
	{
		name: "integration-secrets",
		script: "tooling/scripts/audit-integration-secrets.ts",
		preCommit: false,
		ci: false,
		description:
			"Forbids raw column reads of integration_secrets outside envelope/repo modules; enforces last_error sanitisation. Currently runs via the slow-audits batch; pre-commit/CI wiring is a follow-up.",
	},
	{
		name: "registry-sync",
		script: "tooling/scripts/audit-registry-sync.ts",
		preCommit: true,
		ci: true,
		preCommitGlob:
			"{tooling/audit-registry.ts,tooling/playwright-registry.ts,package.json,lefthook.yml,.github/workflows/ci.yml,playwright.config.ts}",
		description:
			"Validates that the audit + Playwright registries are in sync with package.json, lefthook.yml, ci.yml, and playwright.config.ts.",
	},
];

export function findAuditByName(name: string): AuditEntry | undefined {
	return AUDITS.find((a) => a.name === name);
}
