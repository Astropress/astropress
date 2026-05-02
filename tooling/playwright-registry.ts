/**
 * Playwright project registry.
 *
 * Adding a new Playwright project today requires touching at
 * minimum:
 *
 *   - `tooling/e2e/playwright.config.ts` — register the project;
 *   - `package.json` `test:acceptance` — pass `--project=<name>`;
 *   - `tooling/scripts/run-playwright.ts` — validate the project
 *     name when called with `--project=<name>`.
 *
 * `audit:registry-sync` (in
 * `tooling/scripts/audit-registry-sync.ts`) cross-checks this
 * manifest against `playwright.config.ts` and the
 * `test:acceptance` script invocation in `package.json` so a
 * project added in one place but missed elsewhere is caught at
 * commit time.
 *
 * As with `audit-registry.ts`, migration is incremental — the
 * audit only enforces lockstep on the entries listed here.
 */

export interface PlaywrightProjectEntry {
	readonly name: string;
	/** Whether the project is part of the default `test:acceptance` run. */
	readonly inAcceptanceMatrix: boolean;
	/** One-line human description (shown in `run-playwright.ts --list`). */
	readonly description: string;
}

export const PLAYWRIGHT_PROJECTS: ReadonlyArray<PlaywrightProjectEntry> = [
	{
		name: "admin-integration-honesty",
		inAcceptanceMatrix: true,
		description:
			"Verifies every coming-soon manifest leaf renders the right header and roadmap link.",
	},
	{
		name: "admin-pre-alpha-walkthrough",
		inAcceptanceMatrix: true,
		description:
			"End-to-end walkthrough of the admin shell exercising the most-trafficked routes.",
	},
];

export function findProjectByName(
	name: string,
): PlaywrightProjectEntry | undefined {
	return PLAYWRIGHT_PROJECTS.find((p) => p.name === name);
}
