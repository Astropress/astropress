# Claude Code guidance for this repo

## Security fix verification protocol

A security fix is not done until the evidence says so — not when local audits pass.

### CodeQL / GHAS alerts

**Verification step (required before declaring done):**
```
bun run tooling/scripts/check-pr-ghas.ts
```
This queries `refs/pull/<N>/merge` — the ref the GitHub CodeQL gate actually evaluates. The pre-push gate checks the branch ref, which can show 0 alerts while the PR merge ref still shows open alerts from a stale scan. These are not the same thing.

After pushing, the PR merge ref scan runs asynchronously. Wait for it to complete, then run `check-pr-ghas.ts` to confirm. Do not declare "fixed" until this script exits 0 on a scan that post-dates the fix commit.

**Taint chain rules:**
- `obj[taintedKey]` propagates taint even if `obj` only contains safe hardcoded values. CodeQL does not reason about the map's contents.
- The only way to break a taint chain is to not use user-derived data at the sink at all.
- Validate by tracing every variable in the flagged expression back to its origin. If any path leads to user input, the taint chain is intact.

**Suppression vs code fix:**
- If a code fix is possible, make the code fix. Suppression is for intentional patterns where no fix is possible (e.g. `js/http-to-file-access` in a deliberate HTTP→file media downloader).
- Suppression format for GHAS: `// codeql[rule-id]` inline on the flagged line, or on the preceding line. The comment must start with `codeql[`.
- Local `bun run audit:codeql-patterns` does NOT run CodeQL — it runs regex pattern matching. A local audit pass is not evidence that GHAS will pass.

## Pre-push gates

The pre-push hook runs a full suite (~10 minutes). Do not re-run `git push` while one is already in progress. Wait for the background task notification to complete before concluding anything.
