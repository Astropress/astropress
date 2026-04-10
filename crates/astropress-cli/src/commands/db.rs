use std::path::Path;

use crate::js_bridge::loaders::{run_db_migrations_operation, resolve_admin_db_path, resolve_local_provider};

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
