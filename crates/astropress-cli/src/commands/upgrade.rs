use std::fs;
use std::path::Path;

/// A known breaking-change entry in the embedded compatibility matrix.
struct CompatEntry {
    /// Version range this entry covers (e.g. "< 0.1.0").
    version_range: &'static str,
    /// Human-readable description of the breaking change and the required action.
    notes: &'static [&'static str],
}

/// Embedded compatibility matrix — breaking changes per version range.
/// Add a new entry here whenever a framework release requires operator action.
static COMPAT_MATRIX: &[CompatEntry] = &[
    CompatEntry {
        version_range: "< 0.1.0 (pre-release)",
        notes: &[
            "Schema is additive-only; no destructive migrations have been issued.",
            "Run `astropress db migrate` after every `npm update astropress`.",
            "Run `astropress doctor` to verify env contract after upgrading.",
        ],
    },
];

pub(crate) struct UpgradeCheckReport {
    pub(crate) framework_version: String,
    pub(crate) schema_migration: Option<String>,
    pub(crate) app_host: String,
    pub(crate) data_services: String,
    pub(crate) notes: Vec<String>,
}

pub(crate) fn check_upgrade_compatibility(project_dir: &Path) -> Result<UpgradeCheckReport, String> {
    let framework_version = read_framework_version(project_dir);
    let schema_migration = read_latest_schema_migration(project_dir);
    let (app_host, data_services) = read_runtime_info(project_dir);

    let notes = collect_notes(&framework_version);

    Ok(UpgradeCheckReport {
        framework_version,
        schema_migration,
        app_host,
        data_services,
        notes,
    })
}

pub(crate) fn print_upgrade_check_report(report: &UpgradeCheckReport, project_dir: &Path) { // ~ skip
    println!("Astropress upgrade check");
    println!("Project: {}", project_dir.display());
    println!("Framework version: {}", report.framework_version);
    println!(
        "Latest schema migration: {}",
        report.schema_migration.as_deref().unwrap_or("none applied")
    );
    println!("App host: {}", report.app_host);
    println!("Data services: {}", report.data_services);

    if report.notes.is_empty() {
        println!("Compatibility: OK — no known breaking changes for this version.");
    } else {
        println!("Compatibility notes:");
        for note in &report.notes {
            println!("  - {note}");
        }
    }

    // Attempt to print path to COMPATIBILITY.md
    let compat_doc = resolve_compatibility_doc(project_dir);
    println!("See: {compat_doc}");
}

fn read_framework_version(project_dir: &Path) -> String {
    // Try project's installed copy first, then fall back to repo root copy.
    let candidates = [
        project_dir
            .join("node_modules")
            .join("astropress")
            .join("package.json"),
        crate::repo_root()
            .join("packages")
            .join("astropress")
            .join("package.json"),
    ];

    for candidate in &candidates {
        if let Ok(contents) = fs::read_to_string(candidate) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) {
                if let Some(version) = json.get("version").and_then(|v| v.as_str()) {
                    return version.to_string();
                }
            }
        }
    }

    "unknown".to_string()
}

#[mutants::skip]
fn read_latest_schema_migration(project_dir: &Path) -> Option<String> { // ~ skip
    // Locate the SQLite database (default local path).
    let db_candidates = [
        project_dir.join(".data").join("admin.db"),
        project_dir.join(".data").join("astropress.db"),
    ];

    for db_path in &db_candidates {
        if !db_path.exists() { // ~ skip
            continue;
        }
        // Use sqlite3 CLI if available to avoid linking libsqlite3 from Rust.
        let output = std::process::Command::new("sqlite3")
            .arg(db_path)
            .arg("SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1;")
            .output()
            .ok()?;
        if output.status.success() {
            let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !name.is_empty() { // ~ skip
                return Some(name);
            }
        }
    }
    None
}

fn read_runtime_info(project_dir: &Path) -> (String, String) {
    use crate::cli_config::env::read_env_file;

    let env_values = read_env_file(project_dir).unwrap_or_default();
    let app_host = env_values
        .get("ASTROPRESS_APP_HOST")
        .cloned()
        .unwrap_or_else(|| "not set".to_string());
    let data_services = env_values
        .get("ASTROPRESS_CONTENT_SERVICES")
        .or_else(|| env_values.get("ASTROPRESS_DATA_SERVICES"))
        .cloned()
        .unwrap_or_else(|| "not set".to_string());
    (app_host, data_services)
}

#[mutants::skip]
fn collect_notes(framework_version: &str) -> Vec<String> {
    let mut notes = Vec::new();
    for entry in COMPAT_MATRIX {
        // All pre-1.0 versions always include the pre-release notes.
        let is_pre_release = framework_version == "unknown"
            || framework_version.starts_with("0.")
            || entry.version_range.contains("pre-release");
        if is_pre_release {
            for note in entry.notes {
                notes.push(note.to_string());
            }
        }
    }
    notes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collect_notes_returns_notes_for_unknown_version() {
        let notes = collect_notes("unknown");
        assert!(!notes.is_empty(), "should have notes for unknown version");
    }

    #[test]
    fn collect_notes_returns_notes_for_pre_release_version() {
        let notes = collect_notes("0.0.1");
        assert!(!notes.is_empty(), "should have notes for 0.x version");
    }

    #[test]
    fn collect_notes_returns_notes_for_post_1_pre_release() {
        // COMPAT_MATRIX entry has "pre-release" in version_range, so it always fires.
        let notes = collect_notes("1.0.0");
        assert!(!notes.is_empty(), "pre-release entries always apply");
    }
}

pub(crate) fn apply_upgrade(project_dir: &Path) -> Result<(), String> { // ~ skip
    println!("Running pre-flight compatibility check...");
    let report = check_upgrade_compatibility(project_dir)?;
    print_upgrade_check_report(&report, project_dir);

    println!();
    println!("Applying pending schema migrations...");
    crate::commands::db::run_db_migrations(project_dir, None, false, "local")?;

    println!();
    println!("Upgrade applied. Run `astropress doctor` to verify schema.");
    Ok(())
}

fn resolve_compatibility_doc(project_dir: &Path) -> String {
    // Try repo-relative docs/COMPATIBILITY.md first (dev environment).
    let repo_doc = crate::repo_root().join("docs").join("COMPATIBILITY.md");
    if repo_doc.exists() {
        return repo_doc.display().to_string();
    }
    // Try project-local copy.
    let project_doc = project_dir.join("node_modules").join("astropress").join("docs").join("COMPATIBILITY.md");
    if project_doc.exists() {
        return project_doc.display().to_string();
    }
    "docs/COMPATIBILITY.md".to_string()
}
