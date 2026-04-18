//! Unit tests for `migrate.rs`. Extracted to keep that file under the
//! 300-line arch-lint warning. Wired in via `#[cfg(test)] #[path = ...] mod tests;`.

use super::*;
use std::path::PathBuf;

fn opts(from: &str, to: &str, dry_run: bool) -> MigrateOptions {
    MigrateOptions {
        project_dir: PathBuf::from("/tmp"),
        from: from.to_string(),
        to: to.to_string(),
        dry_run,
    }
}

#[test]
fn migrate_rallly_to_calcom_generates_guide() {
    assert!(run_migrate(&opts("rallly", "calcom", true)).is_ok());
}

#[test]
fn migrate_medusa_to_vendure_generates_guide() {
    assert!(run_migrate(&opts("medusa", "vendure", true)).is_ok());
}

#[test]
fn migrate_flarum_to_discourse_generates_guide() {
    assert!(run_migrate(&opts("flarum", "discourse", true)).is_ok());
}

#[test]
fn migrate_ntfy_to_gotify_generates_guide() {
    assert!(run_migrate(&opts("ntfy", "gotify", true)).is_ok());
}

#[test]
fn migrate_keystatic_to_payload_generates_guide() {
    assert!(run_migrate(&opts("keystatic", "payload", true)).is_ok());
}

#[test]
fn migrate_umami_to_plausible_generates_guide() {
    assert!(run_migrate(&opts("umami", "plausible", true)).is_ok());
}

#[test]
fn migrate_same_tool_returns_error() {
    let result = run_migrate(&opts("rallly", "rallly", true));
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("nothing to migrate"));
}

#[test]
fn migrate_incompatible_categories_returns_error() {
    let result = run_migrate(&opts("rallly", "flarum", true));
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("different categories"));
}

#[test]
fn migrate_unknown_from_returns_error() {
    let result = run_migrate(&opts("unknown-tool", "calcom", true));
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Unknown tool"));
}

#[test]
fn migrate_unknown_to_returns_error() {
    let result = run_migrate(&opts("rallly", "unknown-tool", true));
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Unknown tool"));
}

#[test]
fn migrate_builtin_cms_rejected() {
    // builtin is not in the registry — projects on built-in should use
    // astropress add --cms keystatic/payload instead.
    let result = run_migrate(&opts("builtin", "keystatic", true));
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Unknown tool"));
}

#[test]
fn migrate_dry_run_prints_without_writing() {
    let o = MigrateOptions {
        project_dir: PathBuf::from("/nonexistent/path"),
        from: "ntfy".to_string(),
        to: "gotify".to_string(),
        dry_run: true,
    };
    assert!(run_migrate(&o).is_ok());
}

#[test]
fn migration_guide_contains_both_tool_names() {
    let from = find_tool("rallly").unwrap();
    let to   = find_tool("calcom").unwrap();
    let guide = build_migration_guide(from, to);
    assert!(guide.contains("Rallly"));
    assert!(guide.contains("Cal.com"));
}

#[test]
fn migrate_nonexistent_project_dir_returns_does_not_exist_error() {
    // Kills `delete !` at migrate.rs:233:8.
    // Original: `if !exists` → Err("...does not exist.") for absent dir.
    // Mutation: `if exists` → no early return → fs::write fails → Err("Could not write...").
    // Asserting the specific message distinguishes original from mutation.
    let result = run_migrate(&MigrateOptions {
        project_dir: PathBuf::from("/nonexistent/dir/cargo-mutants-migrate-test"),
        from: "ntfy".to_string(),
        to: "gotify".to_string(),
        dry_run: false,
    });
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(
        err.contains("does not exist"),
        "expected 'does not exist' error for absent project dir, got: {err}"
    );
}
