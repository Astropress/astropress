#!/usr/bin/env bun
/**
 * audit-deps.ts — dependency vulnerability gate (a thin wrapper around
 * `bun audit`).
 *
 * The wrapper exists so the handful of advisories we must suppress carry a
 * documented rubric IN CODE — `package.json` scripts cannot hold comments, and
 * a bare `bun audit --ignore GHSA-…` in the script string would hide *why*.
 *
 * Every entry in {@link IGNORED_ADVISORIES} must satisfy the same rubric the
 * source-suppression registry enforces (see `audit-suppressions.ts`):
 *   1. why a code fix / dependency bump does NOT resolve it,
 *   2. what alternatives were considered,
 *   3. what mitigations remain in force even with the suppression.
 *
 * `bun audit --ignore <id>` remains the authoritative pass/fail signal (so we
 * never re-implement — and risk mis-implementing — the vulnerability match).
 * A best-effort staleness check additionally WARNS when an ignored advisory is
 * no longer reported, so a suppression cannot silently outlive its upstream
 * fix. The warning never changes the exit code.
 */
import { spawnSync } from "node:child_process";

type IgnoredAdvisory = { id: string; pkg: string; rubric: string };

const IGNORED_ADVISORIES: IgnoredAdvisory[] = [
	{
		id: "GHSA-w3rx-r6r6-pgpr",
		pkg: "image-size",
		rubric:
			"image-size ICNS parser: denial of service via an infinite loop. " +
			"NO CODE FIX / BUMP RESOLVES IT: the vulnerable range is <=2.0.2 and " +
			"2.0.2 is the latest published version, so there is no patched release to " +
			"bump to. ALTERNATIVES CONSIDERED: (a) version bump — none exists; " +
			"(b) a magic-byte guard in detectImageDimensions that refuses ICNS/JXL/HEIF " +
			"payloads before image-size parses them — the genuine mitigation, tracked as " +
			"a follow-up; note it would still not green this gate because bun audit keys " +
			"off the installed version, not reachability; (c) dropping image-size and " +
			"reimplementing dimension detection — larger change, also tracked as a " +
			"follow-up. MITIGATIONS PRESENT: the parser is reachable only through " +
			"authenticated uploads (an admin/editor session, or a media:write API token " +
			"on an opt-in REST API), never anonymously; uploads are rate-limited and " +
			"capped at 10 MiB; and on Cloudflare Workers the per-request CPU limit bounds " +
			"the loop rather than hanging the host.",
	},
	{
		id: "GHSA-5p2g-fcmc-qvqq",
		pkg: "image-size",
		rubric:
			"image-size JXL and HEIF parsers: denial of service via infinite loops. " +
			"Same disposition as GHSA-w3rx-r6r6-pgpr: no upstream fix (vulnerable " +
			"<=2.0.2, 2.0.2 is latest), reachable only via authenticated media:write / " +
			"admin uploads (rate-limited, 10 MiB cap), and bounded on Cloudflare Workers " +
			"by the per-request CPU limit. The real mitigation — a magic-byte guard that " +
			"rejects ICNS/JXL/HEIF payloads before image-size sees them — is tracked as a " +
			"follow-up.",
	},
];

const ids = IGNORED_ADVISORIES.map((a) => a.id);
const ignoreArgs = ids.flatMap((id) => ["--ignore", id]);

// Authoritative gate: bun's own audit, with the documented ignores.
const gate = spawnSync("bun", ["audit", ...ignoreArgs], { stdio: "inherit" });

// Best-effort staleness check — never affects the exit code.
try {
	const json = spawnSync("bun", ["audit", "--json"], { encoding: "utf8" });
	const report = JSON.parse(json.stdout || "{}") as Record<string, unknown>;
	const present = new Set<string>();
	for (const advisories of Object.values(report)) {
		if (!Array.isArray(advisories)) continue;
		for (const advisory of advisories) {
			const url = (advisory as { url?: unknown }).url;
			const match = typeof url === "string" ? url.match(/GHSA-[0-9a-z-]+/i) : null;
			if (match) present.add(match[0]);
		}
	}
	const stale = ids.filter((id) => !present.has(id));
	if (stale.length > 0) {
		console.warn(
			`\n⚠ audit:deps — ${stale.length} suppression(s) no longer reported by bun audit ` +
				`(upstream may be fixed). Remove from tooling/scripts/audit-deps.ts: ${stale.join(", ")}`,
		);
	}
} catch {
	// Staleness reporting is advisory only; parsing failures must not mask or
	// invert the authoritative gate result above.
}

process.exit(gate.status ?? 1);
