# Rubric Realism — Backlog and Standards

Tracks known gaps in evaluation grade integrity and the scripts/policies needed to close them.

## Root cause

Both Claude Code and Codex assigned rubric grades for their own work. Self-assessed grades are unreliable — the same session that builds a feature will overestimate its quality. The hallucinated "Runway" provider reached the type system, adapter layer, docs, and tests across multiple evaluation runs without being caught because the audits checked text claims, not whether referenced entities existed.

## Grade validity standard

**A rubric grade is only valid if a CI-enforced script would fail if the rubric criteria were violated.**

Grades without automated backing are claims, not evidence. Any grade without a named CI script should be treated as `?` (unverified) by human reviewers, and should not be promoted to A+ by an AI agent.

Grades should also be annotated `(self-assessed)` when assigned by the same session that built the feature.

---

## Scripts to implement

### `audit:cli-docs` (high priority)
**Prevents:** CLI commands documented in `crates/astropress-cli/README.md` that have no handler in `main.rs`.

Cross-reference every `### command-name` heading (and subcommand like `import wordpress`) in the CLI README against the `Command::*` match arms in `main.rs`. Fail if any documented command has no corresponding arm.

Wire into: `ci.yml` lint job alongside `audit:providers`.

---

### `audit:env-contract` (high priority)
**Prevents:** env vars that are documented as required but never read by the code (the SUPABASE_ANON_KEY pattern).

For every env var key listed in `tooling/verified-providers.json` and the deployment matrix `requiredEnvKeys` arrays, assert that `env.KEY_NAME` or `env["KEY_NAME"]` appears at least once in `packages/astropress/src/`. Fail if a listed key is never read.

Wire into: `ci.yml` lint job.

---

### `audit:exports` (medium priority)
**Prevents:** `packages/astropress/index.ts` re-exporting symbols from adapter files that have been deleted or never created.

Parse every `from "./src/adapters/foo"` path in `index.ts`, assert the `.ts` file exists. Also assert that each exported adapter function name appears in at least one test file. Fail on missing files or zero test coverage for an exported adapter.

Wire into: `ci.yml` lint job.

---

### `audit:crypto` (medium priority)
**Prevents:** docs claiming Argon2id/KMAC256/ML-DSA-65 are used when the actual call sites have drifted to different implementations.

The honesty audit already checks that the algorithm names appear in docs. This script checks that the actual function call sites in `packages/astropress/src/` reference the correct implementations (not just that the names appear in comments or prose). Grep for the implementing library imports alongside the algorithm name assertions.

Wire into: `ci.yml` lint job.

---

## Rubric table improvements

Add an `Evidence` column to the grade table in `evaluation.mdx`. Each row must cite:
- A CI script that passes (e.g. `audit:security`, `test:accessibility`), or
- A specific test file and count (e.g. `sqlite-admin-runtime-auth.test.ts — 47 tests`), or
- `(self-assessed — no automated backing)` if neither exists

Example format:
```
| 4 | Security Posture | A+ | `audit:security` passes; no inline handlers in admin pages |
| 8 | Browser/Web API Usage | A | (self-assessed — no automated backing) |
```

This is not implemented yet. It requires a one-time pass through all 56 rubrics to add evidence. Until that pass happens, all grades without a named CI script should be treated as self-assessed.

---

## Grades likely to drop on honest re-evaluation

These rubrics currently hold A or A+ but have no CI-enforced backing — they were assigned by the same AI session that built the features:

| Rubric | Current grade | Why it's suspect |
|---|---|---|
| 8 — Browser / Web API Usage | A+ | No automated check; self-assessed |
| 18 — AI Drivability | A+ | Circular: AI graded itself on how well AI can use it |
| 19 — Internationalization | A+ | No i18n test suite; self-assessed |
| 28 — Real-Time Collaboration | A | No real-time infra visible; claim is unclear |
| 36 — CLI UX Quality | A+ | No UX test suite; self-assessed |
| 44 — Multi-site Nexus | A+ | Nexus has minimal tests; self-assessed |
| 46–52 — UX rubrics | A | Explicitly noted as engineering-observed, no user research |

These should be re-evaluated in a fresh context with no memory of building the features, using the criteria defined in `docs/reference/EVALUATION.md` for each rubric.

---

## Provider verification (already implemented)

- `tooling/verified-providers.json` — ground truth for all `AstropressAppHost` and `AstropressDataServices` IDs
- `tooling/scripts/audit-providers.ts` — fails CI if any type union ID is not in the verified list
- `AGENTS.md` — "No speculative features" rule: no provider enters the type system without being explicitly named by the user and verified with a real URL
- Runway removed 2026-04-14 as the motivating example

To add a new provider: update `verified-providers.json` first, run `bun run audit:providers`, then add the adapter.

---

## Process for fresh evaluations

When asking an AI agent to evaluate rubric grades:

1. Start a fresh context with no memory of having built the features
2. Point the agent at `docs/reference/EVALUATION.md` for rubric criteria
3. Point the agent at this file for grade validity standards
4. Ask for evidence per rubric, not just a letter grade
5. Any grade the agent cannot back with a specific test, script, or artifact should be marked `?`
