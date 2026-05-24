#!/usr/bin/env bun
/**
 * run-mutants-shared — wrap `bun run test:mutants` with a shared
 * `.stryker-incremental.json` cache and a soft lock, so devs and CI don't
 * each pay the multi-hour cold-start cost after a large refactor.
 *
 * Modeled after Terraform remote state: latest-wins, with a TTL'd lock to
 * prevent two concurrent runs from clobbering each other's increments.
 *
 * Backend: a dedicated git branch `stryker-state` on the origin remote,
 * containing just two files:
 *   incremental.json   — the shared `.stryker-incremental.json`
 *   lock.json          — `{ host, pid, startedAt, ttlHours }` (absent = unlocked)
 *
 * Why a branch (and not a release): the repo enforces immutable releases
 * (supply-chain hardening), so release assets cannot be replaced. A
 * dedicated branch with single-commit force-pushes gives us atomic
 * compare-and-swap via `gh api -X PATCH .../git/refs/heads/stryker-state`,
 * which is exactly the primitive Terraform's S3 backend uses for state
 * locking. The branch never merges into main and is excluded from PR
 * targets via the branch protection ruleset.
 *
 * Subcommands
 * -----------
 *   run            (default) acquire lock → pull → run → push → release
 *   bootstrap      seed the branch with the current local incremental file
 *   pull           download the shared incremental file (no run)
 *   push           upload the local incremental file (no run, requires lock)
 *   status         print remote lock + branch metadata
 *   force-unlock   clear a stale lock (manual recovery)
 *
 * Flags
 * -----
 *   --force        ignore an existing lock (use only if you've confirmed
 *                  it's stale beyond TTL)
 *   --no-pull      skip the pre-run download (for offline testing)
 *   --no-push      run but don't write back (for one-off experiments)
 */

import { execFileSync, spawnSync } from "node:child_process";
import {
	closeSync,
	existsSync,
	fstatSync,
	mkdtempSync,
	openSync,
	readFileSync,
	readSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { hostname, tmpdir } from "node:os";
import path from "node:path";

const BRANCH = "stryker-state";
const README_FILE = "README.md";
const DEFAULT_LOCK_TTL_HOURS = 8;

// Shard suffix: when --shard <name> is passed (or STRYKER_SHARD env is set),
// each shard maintains its own incremental file + lock on the stryker-state
// branch. The CI workflow runs shard=a + shard=b in parallel; locally devs
// run unsharded (suffix=""). The local incremental file path must also
// match what stryker.config.mjs writes — the config respects STRYKER_SHARD
// the same way.
function shardName(): string {
	const idx = process.argv.indexOf("--shard");
	if (idx >= 0 && idx + 1 < process.argv.length) {
		return process.argv[idx + 1];
	}
	return process.env.STRYKER_SHARD ?? "";
}
const SHARD = shardName();
const SHARD_SUFFIX = SHARD ? `-${SHARD}` : "";
const INCREMENTAL_FILE = `incremental${SHARD_SUFFIX}.json`;
const LOCK_FILE = `lock${SHARD_SUFFIX}.json`;
const LOCAL_INCREMENTAL = `.stryker-incremental${SHARD_SUFFIX}.json`;
const LOCAL_REPORT = "reports/mutation/report.json";

interface LockData {
	host: string;
	pid: number;
	startedAt: string;
	ttlHours: number;
}

interface RepoIdent {
	owner: string;
	name: string;
}

function gh(args: string[], opts: { stdin?: string; stderr?: "pipe" | "inherit" } = {}): string {
	const result = spawnSync("gh", args, {
		input: opts.stdin,
		encoding: "utf8",
		stdio: ["pipe", "pipe", opts.stderr ?? "pipe"],
	});
	if (result.status !== 0) {
		throw new Error(`gh ${args.join(" ")}\n${result.stderr || result.stdout}`.trim());
	}
	return result.stdout;
}

function repoIdent(): RepoIdent {
	const json = gh(["repo", "view", "--json", "owner,name"]);
	const data = JSON.parse(json) as { owner: { login: string }; name: string };
	return { owner: data.owner.login, name: data.name };
}

function withTempDir<T>(fn: (dir: string) => T): T {
	const dir = mkdtempSync(path.join(tmpdir(), "stryker-shared-"));
	try {
		return fn(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

interface BranchHead {
	sha: string;
	treeSha: string;
}

function getBranchHead(repo: RepoIdent): BranchHead | null {
	const refResult = spawnSync(
		"gh",
		["api", `repos/${repo.owner}/${repo.name}/git/refs/heads/${BRANCH}`],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	);
	if (refResult.status !== 0) return null;
	const ref = JSON.parse(refResult.stdout) as { object: { sha: string } };
	const commit = JSON.parse(
		gh(["api", `repos/${repo.owner}/${repo.name}/git/commits/${ref.object.sha}`]),
	) as { tree: { sha: string } };
	return { sha: ref.object.sha, treeSha: commit.tree.sha };
}

function readBranchFileBuffer(repo: RepoIdent, filename: string): Buffer | null {
	// Stream gh's response directly to a file via fd redirection — the default
	// stdout buffer overflows on 15+ MB blobs. `Accept: application/vnd.github.raw`
	// returns file bytes without the Contents API's 1 MB inline limit.
	return withTempDir((dir) => {
		const out = path.join(dir, "raw");
		// Open read+write so we can read back through the same fd without ever
		// re-resolving the path. Eliminates the open→close→re-open TOCTOU
		// (CodeQL js/file-system-race) and is faster (no second open syscall).
		const fd = openSync(out, "w+");
		try {
			const result = spawnSync(
				"gh",
				[
					"api",
					"-H",
					"Accept: application/vnd.github.raw",
					`repos/${repo.owner}/${repo.name}/contents/${filename}?ref=${BRANCH}`,
				],
				{ stdio: ["ignore", fd, "pipe"] },
			);
			if (result.status !== 0) {
				const stderr = (result.stderr ?? Buffer.alloc(0)).toString();
				if (stderr.includes("Not Found") || stderr.includes("HTTP 404")) {
					return null;
				}
				throw new Error(`gh api ${filename}: ${stderr.trim()}`);
			}
			const size = fstatSync(fd).size;
			const buf = Buffer.alloc(size);
			let read = 0;
			while (read < size) {
				const n = readSync(fd, buf, read, size - read, read);
				if (n === 0) break;
				read += n;
			}
			return buf.subarray(0, read);
		} finally {
			closeSync(fd);
		}
	});
}

function readBranchFile(repo: RepoIdent, filename: string): string | null {
	const buf = readBranchFileBuffer(repo, filename);
	return buf ? buf.toString("utf8") : null;
}

interface BlobUpload {
	path: string;
	// Present → create/update the blob. Absent → delete the path from the
	// base tree (the tree entry is emitted with `sha: null`). Deletion only
	// takes effect when the tree is built on a `base_tree`; see createTree.
	content?: Buffer;
}

function createBlob(repo: RepoIdent, content: Buffer): string {
	// Stage the JSON body to a tempfile and pass `--input file`. Piping 15+ MB
	// over stdin via spawnSync is unreliable across Bun versions.
	return withTempDir((dir) => {
		const inputFile = path.join(dir, "blob.json");
		writeFileSync(
			inputFile,
			JSON.stringify({
				content: content.toString("base64"),
				encoding: "base64",
			}),
		);
		const out = gh([
			"api",
			"-X",
			"POST",
			`repos/${repo.owner}/${repo.name}/git/blobs`,
			"--input",
			inputFile,
		]);
		return (JSON.parse(out) as { sha: string }).sha;
	});
}

/**
 * Build a git tree. When `baseTreeSha` is provided the uploads are layered
 * ON TOP of that tree (GitHub's `base_tree`), so paths not mentioned in
 * `uploads` are preserved and a `content`-less upload deletes its path
 * (`sha: null`).
 *
 * This base_tree layering is load-bearing: each CI shard pushes only its own
 * `incremental-<shard>.json` + `lock-<shard>.json`. Without base_tree every
 * push replaced the whole branch with just that one shard's files, so the
 * shard that finished LAST clobbered every other shard's incremental cache —
 * which is why only a single shard's cache ever survived and the rest ran
 * permanently cold. Layering on base_tree lets all shards' caches coexist.
 */
function createTree(repo: RepoIdent, uploads: BlobUpload[], baseTreeSha?: string): string {
	const tree = uploads.map((u) =>
		u.content === undefined
			? { path: u.path, mode: "100644", type: "blob", sha: null }
			: { path: u.path, mode: "100644", type: "blob", sha: createBlob(repo, u.content) },
	);
	const body = JSON.stringify(baseTreeSha ? { base_tree: baseTreeSha, tree } : { tree });
	const out = gh(
		["api", "-X", "POST", `repos/${repo.owner}/${repo.name}/git/trees`, "--input", "-"],
		{ stdin: body },
	);
	return (JSON.parse(out) as { sha: string }).sha;
}

function createCommit(
	repo: RepoIdent,
	treeSha: string,
	parentSha: string | null,
	message: string,
): string {
	const body = JSON.stringify({
		message,
		tree: treeSha,
		parents: parentSha ? [parentSha] : [],
	});
	const out = gh(
		["api", "-X", "POST", `repos/${repo.owner}/${repo.name}/git/commits`, "--input", "-"],
		{ stdin: body },
	);
	return (JSON.parse(out) as { sha: string }).sha;
}

function createOrUpdateRef(
	repo: RepoIdent,
	commitSha: string,
	expectedHeadSha: string | null,
): void {
	if (expectedHeadSha === null) {
		const body = JSON.stringify({
			ref: `refs/heads/${BRANCH}`,
			sha: commitSha,
		});
		gh(["api", "-X", "POST", `repos/${repo.owner}/${repo.name}/git/refs`, "--input", "-"], {
			stdin: body,
		});
		return;
	}
	// Compare-and-swap: GitHub rejects with 422 if remote sha != current.
	const body = JSON.stringify({ sha: commitSha, force: false });
	gh(
		[
			"api",
			"-X",
			"PATCH",
			`repos/${repo.owner}/${repo.name}/git/refs/heads/${BRANCH}`,
			"--input",
			"-",
		],
		{ stdin: body },
	);
}

/**
 * Retries on the only conflict path that matters in CI: shard a and
 * shard b run in parallel, both read the same `head` SHA, both create
 * a commit on top, and the second `PATCH refs/heads/stryker-state`
 * loses with HTTP 422 ("Update is not a fast forward"). Each shard
 * mutates a disjoint pair of files (`incremental-<shard>.json` +
 * `lock-<shard>.json`), so re-resolving against the winner's tree
 * and re-committing is safe — there is no logical merge needed.
 *
 * We rebuild the tree from scratch each attempt so the new commit
 * extends the latest remote tree with our uploads on top, which is
 * how git's "non-fast-forward, but the diff is non-overlapping"
 * pattern is normally handled.
 */
const COMMIT_MAX_ATTEMPTS = 5;
const COMMIT_RETRY_BASE_MS = 250;

function isFastForwardConflict(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	const msg = err.message;
	return msg.includes("not a fast forward") || msg.includes("HTTP 422");
}

function sleepSync(ms: number): void {
	const end = Date.now() + ms;
	// Spin via Atomics.wait on a throwaway buffer — sync, no event-loop
	// dependence (important under the test driver). Falls back if
	// SharedArrayBuffer is unavailable.
	try {
		const sab = new SharedArrayBuffer(4);
		Atomics.wait(new Int32Array(sab), 0, 0, ms);
	} catch {
		while (Date.now() < end) {
			/* spin */
		}
	}
}

function commitFiles(repo: RepoIdent, uploads: BlobUpload[], message: string): void {
	let lastErr: unknown;
	for (let attempt = 1; attempt <= COMMIT_MAX_ATTEMPTS; attempt++) {
		const head = getBranchHead(repo);
		try {
			// Layer uploads on the latest remote tree so a racing shard's
			// just-pushed files (and our own untouched paths) are preserved.
			const treeSha = createTree(repo, uploads, head?.treeSha);
			const commitSha = createCommit(repo, treeSha, head?.sha ?? null, message);
			createOrUpdateRef(repo, commitSha, head?.sha ?? null);
			return;
		} catch (err) {
			lastErr = err;
			if (!isFastForwardConflict(err) || attempt === COMMIT_MAX_ATTEMPTS) {
				throw err;
			}
			// Jittered backoff so two racing shards don't ricochet in lockstep.
			const delay = COMMIT_RETRY_BASE_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
			console.log(
				`stryker-state ref advanced under us (attempt ${attempt}/${COMMIT_MAX_ATTEMPTS}); retrying in ${delay}ms…`,
			);
			sleepSync(delay);
		}
	}
	// Unreachable under the loop above — every path either returns or
	// throws — but TypeScript needs the explicit fallthrow.
	throw lastErr;
}

function readRemoteLock(repo: RepoIdent): LockData | null {
	const raw = readBranchFile(repo, LOCK_FILE);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as LockData;
	} catch {
		return null;
	}
}

function lockIsStale(lock: LockData, now = new Date()): boolean {
	const started = new Date(lock.startedAt);
	if (Number.isNaN(started.getTime())) return true;
	const ttlMs = lock.ttlHours * 60 * 60 * 1000;
	return now.getTime() - started.getTime() > ttlMs;
}

function readmeContent(): Buffer {
	return Buffer.from(
		[
			"# stryker-state",
			"",
			"This branch is the shared backend for `tooling/scripts/run-mutants-shared.ts`.",
			"",
			"- `incremental.json` — the latest `.stryker-incremental.json` from any successful run.",
			"- `lock.json` — present while a run holds the lock; contains `{host,pid,startedAt,ttlHours}`.",
			"",
			"Do not edit by hand. Do not merge into `main`.",
			"",
		].join("\n"),
		"utf8",
	);
}

function acquireLock(repo: RepoIdent, force: boolean): LockData {
	const existing = readRemoteLock(repo);
	if (existing && !lockIsStale(existing) && !force) {
		const ageMin = Math.round((Date.now() - new Date(existing.startedAt).getTime()) / 60000);
		throw new Error(
			`Lock held by ${existing.host}:${existing.pid} for ${ageMin} min (TTL ${existing.ttlHours}h, started ${existing.startedAt}).\nIf you're certain it's stale, re-run with --force.`,
		);
	}
	if (existing) {
		console.log(`overwriting ${force ? "" : "stale "}lock from ${existing.host}:${existing.pid}…`);
	}
	const me: LockData = {
		host: hostname(),
		pid: process.pid,
		startedAt: new Date().toISOString(),
		ttlHours: DEFAULT_LOCK_TTL_HOURS,
	};
	// commitFiles layers on base_tree, so this only writes README + our lock
	// file; every other shard's incremental/lock and our own incremental are
	// preserved untouched (no need to re-read the multi-MB incremental here).
	commitFiles(
		repo,
		[
			{ path: README_FILE, content: readmeContent() },
			{
				path: LOCK_FILE,
				content: Buffer.from(`${JSON.stringify(me, null, 2)}\n`),
			},
		],
		`lock: acquire by ${me.host}:${me.pid}`,
	);
	console.log(`lock acquired (host=${me.host} pid=${me.pid}).`);
	return me;
}

function releaseLock(repo: RepoIdent): void {
	try {
		// Delete only our lock file; base_tree layering preserves everything
		// else (our pushed incremental + every other shard's files).
		commitFiles(repo, [{ path: LOCK_FILE }], "lock: release");
		console.log("lock released.");
	} catch (e) {
		console.error(`failed to release lock: ${(e as Error).message}`);
	}
}

function pullState(repo: RepoIdent): void {
	const content = readBranchFileBuffer(repo, INCREMENTAL_FILE);
	if (content === null) {
		console.log(`no remote ${INCREMENTAL_FILE} yet — run will start from scratch.`);
		return;
	}
	writeFileSync(LOCAL_INCREMENTAL, content);
	const size = statSync(LOCAL_INCREMENTAL).size;
	console.log(`pulled ${LOCAL_INCREMENTAL} from ${BRANCH} (${size} bytes).`);
}

function pushState(repo: RepoIdent, lock: LockData): void {
	if (!existsSync(LOCAL_INCREMENTAL)) {
		console.log(`no local ${LOCAL_INCREMENTAL} to push (skipping).`);
		return;
	}
	const incremental = readFileSync(LOCAL_INCREMENTAL);
	commitFiles(
		repo,
		[
			{ path: README_FILE, content: readmeContent() },
			{
				path: LOCK_FILE,
				content: Buffer.from(`${JSON.stringify(lock, null, 2)}\n`),
			},
			{ path: INCREMENTAL_FILE, content: incremental },
		],
		`state: push from ${lock.host}:${lock.pid} (${incremental.length} bytes)`,
	);
	console.log(
		`pushed ${LOCAL_INCREMENTAL} → ${BRANCH}/${INCREMENTAL_FILE} (${incremental.length} bytes).`,
	);
}

function runMutants(): { exitCode: number; reportFresh: boolean } {
	const before = existsSync(LOCAL_REPORT) ? statSync(LOCAL_REPORT).mtimeMs : 0;
	// Use the shared-cache config (break: 0). Per-file quality is enforced
	// by mutation-gate + audit:baseline-* jobs, not by the global threshold
	// of this cache-refresh run.
	// Stryker is hoisted to the root node_modules/.bin by bun's workspace
	// install — it is not symlinked into packages/astropress/node_modules
	// in CI (`bun install --frozen-lockfile` skips per-package shims).
	// The package.json scripts use `../../node_modules/.bin/stryker`
	// from packages/astropress; mirror that convention here.
	const result = spawnSync(
		"node",
		[
			"../../node_modules/.bin/stryker",
			"run",
			"../../tooling/stryker/stryker-shared-cache.config.mjs",
		],
		{
			stdio: "inherit",
			cwd: path.join(process.cwd(), "packages/astropress"),
			// Propagate SHARD so the stryker config picks the right mutate
			// glob filter and incremental file path. Unsharded local runs
			// pass through unchanged.
			env: SHARD ? { ...process.env, STRYKER_SHARD: SHARD } : process.env,
		},
	);
	const reportFresh = existsSync(LOCAL_REPORT) && statSync(LOCAL_REPORT).mtimeMs > before;
	return { exitCode: result.status ?? 1, reportFresh };
}

function ensureBranch(repo: RepoIdent): void {
	if (getBranchHead(repo) !== null) return;
	console.log(`creating ${BRANCH} branch…`);
	const treeSha = createTree(repo, [{ path: README_FILE, content: readmeContent() }]);
	const commitSha = createCommit(repo, treeSha, null, "init: stryker-state branch");
	createOrUpdateRef(repo, commitSha, null);
}

function cmdRun(
	repo: RepoIdent,
	flags: { force: boolean; noPull: boolean; noPush: boolean },
): number {
	ensureBranch(repo);
	let lock: LockData | null = null;
	try {
		lock = acquireLock(repo, flags.force);
		if (!flags.noPull) pullState(repo);
		const { exitCode, reportFresh } = runMutants();
		if (!flags.noPush && reportFresh) {
			pushState(repo, lock);
		} else if (!reportFresh) {
			console.log("report.json was not refreshed — skipping push.");
		}
		return exitCode;
	} catch (e) {
		console.error(`run-mutants-shared: ${(e as Error).message}`);
		return 1;
	} finally {
		if (lock) releaseLock(repo);
	}
}

function cmdBootstrap(repo: RepoIdent): number {
	ensureBranch(repo);
	if (!existsSync(LOCAL_INCREMENTAL)) {
		console.error(
			`bootstrap: no local ${LOCAL_INCREMENTAL} to seed.\n  Run \`bun run test:mutants\` first to produce one.`,
		);
		return 1;
	}
	const content = readFileSync(LOCAL_INCREMENTAL);
	commitFiles(
		repo,
		[
			{ path: README_FILE, content: readmeContent() },
			{ path: INCREMENTAL_FILE, content },
		],
		`bootstrap: seed ${INCREMENTAL_FILE} from ${hostname()} (${content.length} bytes)`,
	);
	console.log(
		`bootstrapped ${BRANCH}/${INCREMENTAL_FILE} from local file (${content.length} bytes).`,
	);
	return 0;
}

function cmdStatus(repo: RepoIdent): number {
	const head = getBranchHead(repo);
	if (!head) {
		console.log(`branch ${BRANCH} does not exist (run \`bootstrap\` first).`);
		return 0;
	}
	console.log(`branch ${BRANCH} @ ${head.sha.slice(0, 12)}`);
	for (const f of [README_FILE, INCREMENTAL_FILE, LOCK_FILE]) {
		const content = readBranchFile(repo, f);
		if (content === null) {
			console.log(`  ${f.padEnd(20)} (absent)`);
		} else {
			console.log(`  ${f.padEnd(20)} ${content.length} bytes`);
		}
	}
	const lock = readRemoteLock(repo);
	if (lock) {
		const stale = lockIsStale(lock) ? " (STALE)" : "";
		console.log(
			`\nlock: ${lock.host}:${lock.pid} since ${lock.startedAt} (ttl ${lock.ttlHours}h)${stale}`,
		);
	} else {
		console.log("\nlock: free");
	}
	return 0;
}

function cmdForceUnlock(repo: RepoIdent): number {
	// Delete only the lock file; base_tree layering preserves the incremental
	// caches (force-unlock must never wipe state, just clear a stuck lock).
	commitFiles(repo, [{ path: LOCK_FILE }], "lock: force-unlock");
	console.log("lock cleared.");
	return 0;
}

function checkGh(): void {
	try {
		execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
	} catch {
		console.error("gh CLI is not authenticated. Run `gh auth login` first, then retry.");
		process.exit(1);
	}
}

function parseArgs(argv: string[]): {
	cmd: string;
	flags: { force: boolean; noPull: boolean; noPush: boolean };
} {
	const args = argv.slice(2);
	return {
		cmd: args.find((a) => !a.startsWith("--")) ?? "run",
		flags: {
			force: args.includes("--force"),
			noPull: args.includes("--no-pull"),
			noPush: args.includes("--no-push"),
		},
	};
}

function main(): number {
	checkGh();
	const repo = repoIdent();
	const { cmd, flags } = parseArgs(process.argv);
	switch (cmd) {
		case "run":
			return cmdRun(repo, flags);
		case "bootstrap":
			return cmdBootstrap(repo);
		case "pull":
			ensureBranch(repo);
			pullState(repo);
			return 0;
		case "push": {
			ensureBranch(repo);
			let lock: LockData | null = null;
			try {
				lock = acquireLock(repo, flags.force);
				pushState(repo, lock);
				return 0;
			} catch (e) {
				console.error(`push: ${(e as Error).message}`);
				return 1;
			} finally {
				if (lock) releaseLock(repo);
			}
		}
		case "status":
			return cmdStatus(repo);
		case "force-unlock":
			return cmdForceUnlock(repo);
		default:
			console.error(
				`unknown command: ${cmd}\n  expected: run | bootstrap | pull | push | status | force-unlock`,
			);
			return 1;
	}
}

process.exit(main());
