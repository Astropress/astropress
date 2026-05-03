# Discovery audit — quality gap inventory

Generated: 2026-05-03T11:39:14.586Z

Each row links to the JSON artifact with the full file list. The follow-up sweeping-fix plan consumes these artifacts directly.

| # | Workstream | Headline | Artifact |
|---|---|---|---|
| W1 | Admin route registry drift | 28 unregistered entrypoints, 0 unbacked registry entries | [route-drift.json](./route-drift.json) |
| W2 | Astro check gap | 73/78 `.astro` files have no astro-check (framework pages = 45, components = 28) | [astro-build-gap.json](./astro-build-gap.json) |
| W3 | Route × auth coverage | 24/102 routes test-untouched; 25 have no anon-auth/redirect test; smoke covers 39 | [route-http-matrix.json](./route-http-matrix.json) |
| W4 | Dynamic-segment edge cases | 1/10 dynamic routes never mentioned in tests | [dynamic-segments.json](./dynamic-segments.json) |
| W5 | Admin label coverage | 80/115 label keys are dead (defined, never read); 3 dynamic call sites | [admin-label-coverage.json](./admin-label-coverage.json) |
| W6 | Mutation blind spots | ignoreStatic=true; 91 files <80%, 17 [80,90), 8 [90,95); 10 high-fanout tests on allowlist | [mutation-blindspots.json](./mutation-blindspots.json) |
| W7 | v8 coverage scope | only 23 files in vitest `coverage.include`; 242/265 baseline-tracked files unmeasured by v8; 139 files mutation-passing ≥95 with no v8 line/branch threshold | [v8-coverage-scope.json](./v8-coverage-scope.json) |
| W8 | Source-test pairing | TS: 120 unpaired src / 75 orphan tests (heuristic, includes false positives from path-flattened naming). Rust: 63/89 unpaired (21 are inline-tested) | [source-test-pairing.json](./source-test-pairing.json) |
| W9 | Schema/migration robustness | SQLite has 37 tables, D1 path declares 1 (only `schema_migrations`); 36 tables have no D1 mirror. Host migration dir absent — `.down.sql` companion check N/A | [schema-migration-robustness.json](./schema-migration-robustness.json) |
| W10 | Boundary type safety | TS: 96 `Record<string,unknown>`, 18 `unknown[]`, 1 caught-error casts. Rust: 84 `Result<T,String>`, 1 panic, 64 unwrap, 14 expect (outside `tests/`) | [boundary-types.json](./boundary-types.json) |

## Top architectural smells (cross-cutting)

1. **D1 schema is undocumented and unsynced** — host apps deploy 36 tables manually with no parity check or migration runner that mirrors SQLite. Every new sqlite-schema column is a silent D1 production-drift bomb.
2. **Framework pages are unchecked** — `astro check` runs on docs (3 files) and the harness (3 files); the 73 framework `.astro` files compile only when a downstream consumer builds. Recent 404 regression matches this gap.
3. **Mutation gate's blind side** — `ignoreStatic: true` silently drops mutants on top-level constants (e.g. cookie names, label literals). 91 baseline files are below 80% and the floor never sweeps them; combined with v8 coverage covering only 23 files, ~140 files are mutation-passing-without-line-coverage.
4. **Action handlers untested for auth** — 24/102 admin route files have no test mention; 25/102 have no anon/redirect test. Most are `actions/*.ts` POST endpoints — write-path access control is not behaviourally verified.
5. **Stringly-typed errors at boundaries** — Rust returns `Result<T, String>` in 84 places; TS uses `Record<string, unknown>` in 96 exported signatures. Every consumer must guess the error/payload shape; no compiler help on misuse.
6. **Dead-weight labels & fan-out tests** — 80 of 115 admin labels are unused (carry-cost on every translator); 10 tests stay on the high-fanout allowlist (each is ~minutes of cache invalidation per edit).

## Next plan trigger

Consume each JSON artifact in a follow-up sweeping-fix plan: W1 → register-or-delete; W2 → wire `astro check`; W3/W4 → write missing route tests; W5 → delete dead labels; W6 → flip ignoreStatic OFF for a per-file sweep, raise floor; W7 → broaden vitest `coverage.include`; W8 → split orphan tests, add companions; W9 → ship a D1 schema mirror + parity test; W10 → introduce error enums (Rust) and shape types (TS) at boundaries.

