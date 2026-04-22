use std::path::Path;
use std::process::Command as ProcessCommand;

use crate::js_bridge::loaders::{run_db_migrations_operation, run_db_rollback_operation, resolve_admin_db_path, resolve_local_provider};

#[mutants::skip]
pub(crate) fn run_db_migrations(
    project_dir: &Path,
    migrations_dir: Option<&str>,
    dry_run: bool,
    target: &str,
) -> Result<(), String> {
    let resolved_migrations_dir = migrations_dir
        .map(|d| project_dir.join(d).to_string_lossy().into_owned())
        .unwrap_or_else(|| project_dir.join("migrations").to_string_lossy().into_owned());

    match target {
        "d1" => run_db_migrations_d1(&resolved_migrations_dir, dry_run),
        _ => {
            // local / SQLite
            let provider = resolve_local_provider(project_dir, None)?;
            let db_path = resolve_admin_db_path(project_dir, provider)?;
            let abs_db_path = project_dir.join(&db_path);
            let abs_db_path_str = abs_db_path.to_string_lossy();

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
    }
}

/// Runs migrations against a Cloudflare D1 database by shelling out to `wrangler d1 execute`.
///
/// Requires:
///   - `wrangler` CLI on PATH (install: `npm install -g wrangler` or `bun add -g wrangler`)
///   - `CLOUDFLARE_D1_BINDING` env var (name of the D1 binding, e.g. `DB`)
///   - `CLOUDFLARE_ACCOUNT_ID` env var
///   - Wrangler authenticated (`wrangler login` or `CLOUDFLARE_API_TOKEN`)
///
/// Each `.sql` file in `migrations_dir` is passed to `wrangler d1 execute <binding> --file=<path> --remote`.
#[mutants::skip]
fn run_db_migrations_d1(migrations_dir: &str, dry_run: bool) -> Result<(), String> {
    let binding = std::env::var("CLOUDFLARE_D1_BINDING").unwrap_or_else(|_| "DB".to_string());

    let migrations_path = Path::new(migrations_dir);
    if !migrations_path.exists() {
        println!("No migrations directory found at {migrations_dir}");
        return Ok(());
    }

    let mut sql_files: Vec<_> = std::fs::read_dir(migrations_path)
        .map_err(|e| format!("Failed to read migrations dir: {e}"))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension().and_then(|e| e.to_str()) == Some("sql")
                && !p.to_string_lossy().ends_with(".down.sql")
        })
        .collect();
    sql_files.sort();

    if sql_files.is_empty() {
        println!("No migration files found in {migrations_dir}");
        return Ok(());
    }

    println!("Target: D1 binding `{binding}`");
    println!("Migrations directory: {migrations_dir}");
    println!();

    for file in &sql_files {
        let file_str = file.to_string_lossy();
        println!("  {} {}", if dry_run { "Would apply" } else { "Applying" }, file_str);

        if !dry_run {
            let status = ProcessCommand::new("wrangler")
                .args(["d1", "execute", &binding, "--remote", "--file"])
                .arg(file)
                .status()
                .map_err(|e| format!("Failed to invoke wrangler: {e}. Is `wrangler` on PATH?"))?;

            if !status.success() {
                return Err(format!("wrangler d1 execute failed for {file_str}"));
            }
        }
    }

    if dry_run {
        println!("\nDry run complete — {} file(s) would be applied.", sql_files.len());
    } else {
        println!("\nApplied {} migration file(s) to D1 binding `{}`.", sql_files.len(), binding);
    }

    Ok(())
}

#[mutants::skip]
pub(crate) fn rollback_db_migration(
    project_dir: &Path,
    dry_run: bool,
    target: &str,
) -> Result<(), String> {
    match target {
        "d1" => {
            println!("D1 rollback via wrangler is not automated — apply the .down.sql file manually:");
            println!();
            println!("  wrangler d1 execute $CLOUDFLARE_D1_BINDING --remote --file migrations/<name>.down.sql");
            println!();
            println!("The .down.sql file path is recorded in the schema_migrations table's rollback_sql column.");
            if dry_run {
                println!("(dry-run: no changes would be made)");
            }
            Ok(())
        }
        _ => {
            // local / SQLite
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
    }
}
