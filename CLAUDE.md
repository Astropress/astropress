# Claude Code guidance for this repo

## Quality principle

End-user satisfaction is the only measure of success. User/session satisfaction is irrelevant.
Do not take an easy path now that creates a harder problem later. If a fix requires real work,
do the real work. Suppressing a problem is not fixing it.

## Security fix verification protocol

A security fix is not done until evidence says so — not when local audits pass.

### CodeQL / GHAS alerts

**Verification step (required before declaring done):**
```
bun run tooling/scripts/check-pr-ghas.ts
```
This queries `refs/pull/<N>/merge` — the ref the GitHub CodeQL gate actually evaluates. The
pre-push gate checks the branch ref, which can show 0 alerts while the PR merge ref still shows
open alerts from a stale scan.

After pushing, wait for the PR merge ref scan to complete, then run `check-pr-ghas.ts`.
Do not declare "fixed" until this script exits 0 on a scan that post-dates the fix commit.

**Taint chain rules:**
- `obj[taintedKey]` propagates taint even if `obj` only contains safe hardcoded values.
- The only way to break a taint chain is to not use user-derived data at the sink at all.
- Validate by tracing every variable in the flagged expression back to its origin.

**Suppression policy:**
- Fix the code first. Suppression is a last resort, not a first response.
- Comments that explain why a vulnerability is "safe" are security anti-patterns —
  they document attack surface for readers with malicious intent.
- For HTTP→file operations in import scripts: use `downloadMediaToFile()` from
  `packages/astropress/src/import/download-media.ts` which enforces URL scheme validation,
  SSRF prevention, content-type allowlist, and file size limits.
- Every suppression that remains must be registered in `tooling/scripts/audit-suppressions.ts`
  with a rubric explaining why a code fix is impossible.

## Pre-push gates

The pre-push hook runs a full suite (~10 minutes). Do not re-run `git push` while one is already
in progress. Wait for the background task notification before concluding anything.
