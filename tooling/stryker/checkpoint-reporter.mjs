// Stryker reporter that writes per-mutant progress to a JSONL file as it
// runs, so a SIGKILLed run preserves file-level checkpoints. Consumed by
// tooling/scripts/prepush-mutation-gate.ts to skip already-mutated files
// on resume.
//
// JSONL format (one JSON object per line):
//   { "type": "manifest", "session": <iso-timestamp>,
//     "files": { "<fileName>": <expected mutant count>, ... } }
//   { "type": "mutant", "session": <iso-timestamp>,
//     "fileName": "...", "id": "...", "status": "Killed|Survived|...",
//     "mutatorName": "...", "static": false }
//
// The wrapper finds the latest manifest line and counts subsequent mutant
// lines per file; a file with count >= manifest count is considered fully
// mutated and its score can be computed from the JSONL alone.
//
// Multiple sessions accumulate in the same JSONL — earlier sessions remain
// authoritative for files completed before a crash. The wrapper deletes
// the JSONL on full success.

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// The wrapper (tooling/scripts/prepush-mutation-gate.ts) sets
// STRYKER_PROGRESS_PATH to an absolute path under the repo root before
// invoking stryker. We honour that as the source of truth so the JSONL
// lands where the wrapper expects to read it. Stryker's own cwd is
// packages/astropress/, which is *not* where the wrapper looks — relying
// on a relative path here would silently route the file into the wrong
// directory. (See UPSTREAM_CONTRIBUTIONS.md item 14d.)
const PROGRESS_PATH =
	process.env.STRYKER_PROGRESS_PATH ?? ".stryker-progress.jsonl";
const PluginKind = { Reporter: "Reporter" };

class CheckpointReporter {
	#session = new Date().toISOString();
	#wroteManifest = false;

	#append(obj) {
		if (!existsSync(dirname(PROGRESS_PATH) || ".")) {
			mkdirSync(dirname(PROGRESS_PATH), { recursive: true });
		}
		appendFileSync(PROGRESS_PATH, `${JSON.stringify(obj)}\n`);
	}

	onMutationTestingPlanReady(event) {
		// Count expected mutants per file. EarlyResult plans (already-decided
		// mutants like NoCoverage) are excluded — only Run-plan mutants will
		// generate onMutantTested events.
		const counts = {};
		for (const plan of event.mutantPlans) {
			if (plan.plan !== "Run") continue;
			const f = plan.mutant.fileName;
			counts[f] = (counts[f] ?? 0) + 1;
		}
		this.#append({ type: "manifest", session: this.#session, files: counts });
		this.#wroteManifest = true;
	}

	onMutantTested(result) {
		// Defensive: if for any reason onMutationTestingPlanReady didn't fire
		// (older stryker, plugin loaded mid-run), still record mutants under a
		// synthetic empty manifest so the wrapper can see *something*.
		if (!this.#wroteManifest) {
			this.#append({ type: "manifest", session: this.#session, files: {} });
			this.#wroteManifest = true;
		}
		this.#append({
			type: "mutant",
			session: this.#session,
			fileName: result.fileName,
			id: result.id,
			status: result.status,
			mutatorName: result.mutatorName,
			static: result.static ?? false,
		});
	}
}

export const strykerPlugins = [
	{
		kind: PluginKind.Reporter,
		name: "checkpoint",
		factory: () => new CheckpointReporter(),
	},
];
