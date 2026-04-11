# ADR-002: Rust CLI Volatility Decomposition

**Date:** 2024-11-15
**Status:** Accepted

## Context

The Astropress CLI (`crates/astropress-cli`) started as a single `main.rs` file with all commands inlined. As new commands were added (import, backup/restore, services, deploy, db migrate), the file exceeded 1000 lines and became difficult to navigate.

The question was: how to split the CLI code without losing navigability or introducing over-abstraction?

Options considered:
1. **By command group** — split into `new.rs`, `import.rs`, `backup.rs`, etc. Simple and obvious, but some commands share setup logic that would need to be duplicated or extracted.
2. **By volatility** — split by how frequently each axis changes. Commands that change together stay together; commands that change independently are separated.
3. **Monolithic with modules** — keep all logic in one file but use Rust modules for namespacing. Easy to navigate locally but scales poorly.

## Decision

Split the CLI using **volatility-based decomposition** into one Rust source file per command or related command group:

```
src/commands/
  new.rs          — scaffold command (most volatile: new features regularly)
  doctor.rs       — health check (moderate: new checks added as features grow)
  import_wordpress.rs  — WP import (stable after initial implementation)
  import_common.rs     — shared import logic (split from wordpress.rs when wix.rs was added)
  backup_restore.rs    — snapshot commands (stable)
  dev.rs              — dev server launch (stable)
  deploy.rs           — deploy preparation (moderate: new targets occasionally)
  services.rs         — services bootstrap/verify (stable after initial impl)
  db.rs               — database migration commands (stable)
  config.rs           — config migration (stable)
```

Additionally, argument parsing was separated from command execution:

```
src/cli_config/
  args/mod.rs     — Command enum + parse_command() dispatcher
  args/new.rs     — `new` command argument parsing
  args/import.rs  — import subcommand parsing
  args/ops.rs     — operational command parsing (backup, doctor, services, db)
  args/dev_deploy.rs  — dev + deploy argument parsing
```

## Consequences

**Positive:**
- New commands are added by creating a new `src/commands/xxx.rs` — zero impact on existing commands
- Architectural fitness functions enforce file LOC limits (≤ 600 lines per source file)
- Argument parsing and command execution are independently testable
- `src/main.rs` stays as a thin dispatcher — easy to read and follow control flow

**Negative:**
- More files to navigate for new contributors
- `import_common.rs` is a shared-logic file that may accumulate complexity over time — should be monitored
- The split requires discipline: new commands must not add logic to `main.rs`
