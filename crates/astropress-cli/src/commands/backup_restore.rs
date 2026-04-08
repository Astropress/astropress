use std::path::Path;

use serde::Deserialize;

use crate::js_bridge::loaders::package_module_import;
use crate::js_bridge::runner::{detect_package_manager, run_package_json_command};

#[derive(Debug, Deserialize)]
pub(crate) struct SnapshotResult {
    pub(crate) target_dir: Option<String>,
    pub(crate) source_dir: Option<String>,
    pub(crate) file_count: usize,
}

pub(crate) fn export_project_snapshot(
    project_dir: &Path,
    output_dir: Option<&Path>,
) -> Result<(), String> {
    let snapshot_dir = output_dir
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| {
            project_dir
                .join(".astropress")
                .join("sync")
                .join("latest")
        });
    let package_manager = detect_package_manager(project_dir);
    let sync_module = package_module_import("sync/git.js", Some(project_dir))?;
    let script = format!(
        r#"import {{ createAstropressGitSyncAdapter }} from {};
const sync = createAstropressGitSyncAdapter({{ projectDir: process.cwd() }});
const result = await sync.exportSnapshot({});
console.log(JSON.stringify({{
  target_dir: result.targetDir,
  file_count: result.fileCount,
}}));"#,
        serde_json::to_string(&sync_module).map_err(|error| error.to_string())?,
        serde_json::to_string(&snapshot_dir.display().to_string())
            .map_err(|error| error.to_string())?
    );
    let result: SnapshotResult =
        run_package_json_command(project_dir, package_manager, &script)?;
    println!(
        "Exported Astropress snapshot to {} ({} files)",
        result
            .target_dir
            .as_deref()
            .unwrap_or_else(|| snapshot_dir.to_str().unwrap_or("unknown")),
        result.file_count
    );
    Ok(())
}

pub(crate) fn import_project_snapshot(
    project_dir: &Path,
    input_dir: &Path,
) -> Result<(), String> {
    if !input_dir.exists() {
        return Err(format!(
            "Snapshot directory was not found: {}",
            input_dir.display()
        ));
    }
    let package_manager = detect_package_manager(project_dir);
    let sync_module = package_module_import("sync/git.js", Some(project_dir))?;
    let script = format!(
        r#"import {{ createAstropressGitSyncAdapter }} from {};
const sync = createAstropressGitSyncAdapter({{ projectDir: process.cwd() }});
const result = await sync.importSnapshot({});
console.log(JSON.stringify({{
  source_dir: result.sourceDir,
  file_count: result.fileCount,
}}));"#,
        serde_json::to_string(&sync_module).map_err(|error| error.to_string())?,
        serde_json::to_string(&input_dir.display().to_string())
            .map_err(|error| error.to_string())?
    );
    let result: SnapshotResult =
        run_package_json_command(project_dir, package_manager, &script)?;
    println!(
        "Imported Astropress snapshot from {} into {} ({} files)",
        result
            .source_dir
            .as_deref()
            .unwrap_or_else(|| input_dir.to_str().unwrap_or("unknown")),
        project_dir.display(),
        result.file_count
    );
    Ok(())
}
