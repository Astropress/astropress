use std::path::Path;

use crate::js_bridge::loaders::{run_db_migrations_operation, run_db_rollback_operation, resolve_admin_db_path, resolve_local_provider};

pub(crate) fn run_db_migrations(
    project_dir: &Path,
    migrations_dir: Option<&str>,
    dry_run: bool,
) -> Result<(), String> {
    let provider = resolve_local_provider(project_dir, None)?;
    let db_path = resolve_admin_db_path(project_dir, provider)?;
    let abs_db_path = project_dir.join(&db_path);
    let abs_db_path_str = abs_db_path.to_string_lossy();

    let resolved_migrations_dir = migrations_dir
        .map(|d| project_dir.join(d).to_string_lossy().into_owned())
        .unwrap_or_else(|| project_dir.join("migrations").to_string_lossy().into_owned());

    let report = run_db_migrations_operation(
        project_dir,
        &abs_db_path_str,
        &resolved_migrations_dir,
        dry_run,
    )?;

    if dry_run {
        println!("Dry run — no changes written to {}", report.db_path);
    } else {
        println!("Database: {}", report.db_path);
    }
    println!("Migrations directory: {}", report.migrations_dir);
    println!();

    if report.applied.is_empty() && report.skipped.is_empty() {
        println!("No migration files found in {}", report.migrations_dir);
    } else {
        if !report.applied.is_empty() {
            let verb = if dry_run { "Would apply" } else { "Applied" };
            println!("{verb} {} migration(s):", report.applied.len());
            for name in &report.applied {
                println!("  + {name}");
            }
        }
        if !report.skipped.is_empty() {
            println!("Skipped {} already-applied migration(s):", report.skipped.len());
            for name in &report.skipped {
                println!("  - {name}");
            }
        }
        if report.applied.is_empty() {
            println!("All migrations already applied — database is up to date.");
        }
    }

    Ok(())
}

pub(crate) fn rollback_db_migration(
    project_dir: &Path,
    dry_run: bool,
) -> Result<(), String> {
    let provider = resolve_local_provider(project_dir, None)?;
    let db_path = resolve_admin_db_path(project_dir, provider)?;
    let abs_db_path = project_dir.join(&db_path);
    let abs_db_path_str = abs_db_path.to_string_lossy();

    let report = run_db_rollback_operation(project_dir, &abs_db_path_str, dry_run)?;

    println!("Database: {}", report.db_path);
    println!();

    match report.status.as_str() {
        "rolled_back" => {
            let name = report.migration_name.as_deref().unwrap_or("(unknown)");
            println!("Rolled back migration: {name}");
        }
        "dry_run" => {
            let name = report.migration_name.as_deref().unwrap_or("(unknown)");
            println!("Dry run — would roll back: {name}");
            println!("Re-run without --dry-run to apply.");
        }
        "no_rollback_sql" => {
            let name = report.migration_name.as_deref().unwrap_or("(unknown)");
            println!("Cannot roll back: migration `{name}` has no rollback SQL.");
            println!("Add a companion `.down.sql` file alongside the migration to enable rollback.");
            return Err(format!("No rollback SQL for migration: {name}"));
        }
        "no_migrations" => {
            println!("No migrations have been applied — nothing to roll back.");
        }
        other => {
            return Err(format!("Unexpected rollback status: {other}"));
        }
    }

    Ok(())
}
