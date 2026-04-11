use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::cli_config::args::CrawlMode;
use crate::commands::import_common::{crawl_and_save, now_unix_ms, resolve_absolute_admin_db_path, resolve_wix_credentials};
use crate::js_bridge::runner::{detect_package_manager, run_package_json_command};
use crate::telemetry::{ImportSummary, PostImportChoice};

#[derive(Debug, Serialize)]
pub(crate) struct WixImportManifest {
    source_file: String,
    imported_at_unix_ms: u128,
    report_file: String,
    artifact_dir: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct WixImportFailedMedia {
    id: String,
    source_url: String,
    reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct WixImportArtifacts {
    artifact_dir: Option<String>,
    content_file: Option<String>,
    media_file: Option<String>,
    user_file: Option<String>,
    taxonomy_file: Option<String>,
    download_state_file: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WixLocalApplyReport {
    applied_records: usize,
    applied_media: usize,
    applied_authors: usize,
    admin_db_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct WixImportResult {
    status: String,
    imported_records: usize,
    imported_media: usize,
    imported_authors: usize,
    downloaded_media: usize,
    failed_media: Vec<WixImportFailedMedia>,
    warnings: Vec<String>,
    artifacts: Option<WixImportArtifacts>,
    local_apply: Option<WixLocalApplyReport>,
}

/// Returned by the JS `fetchWixExport` call.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FetchWixResult {
    export_path: String,
    warnings: Vec<String>,
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn stage_wix_import(
    project_dir: &Path,
    source_path: Option<&Path>,
    url: Option<&str>,
    credentials_file: Option<&Path>,
    email: Option<&str>,
    password: Option<&str>,
    artifact_dir: Option<&Path>,
    download_media: bool,
    apply_local: bool,
    resume: bool,
    crawl_mode: CrawlMode,
) -> Result<(), String> {
    let import_dir = artifact_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            let ts = now_unix_ms();
            project_dir.join(".astropress").join("import").join(format!("wix-{ts}"))
        });
    fs::create_dir_all(&import_dir).map_err(crate::io_error)?;

    // Resolve source file — either provided directly or fetched via browser automation.
    let resolved_source: PathBuf = if let Some(path) = source_path {
        if !path.is_file() {
            return Err(format!(
                "Wix export file was not found: {}",
                path.display()
            ));
        }
        path.to_path_buf()
    } else if let Some(site_url) = url {
        let (wix_email, wix_password) = resolve_wix_credentials(
            site_url,
            credentials_file,
            email,
            password,
        )?;
        let package_manager = detect_package_manager(project_dir);
        let fetch_module = crate::js_bridge::loaders::package_module_import(
            "import/fetch-wix.js",
            Some(project_dir),
        )?;
        let download_dir = import_dir.join("downloads");
        let fetch_script = format!(
            r#"import {{ fetchWixExport }} from {};
const result = await fetchWixExport({{
  siteUrl: {},
  email: {},
  password: {},
  downloadDir: {},
}});
console.log(JSON.stringify(result));"#,
            serde_json::to_string(&fetch_module).map_err(|e| e.to_string())?,
            serde_json::to_string(site_url).map_err(|e| e.to_string())?,
            serde_json::to_string(&wix_email).map_err(|e| e.to_string())?,
            serde_json::to_string(&wix_password).map_err(|e| e.to_string())?,
            serde_json::to_string(&download_dir.display().to_string()).map_err(|e| e.to_string())?,
        );
        let fetch_result: FetchWixResult =
            run_package_json_command(project_dir, package_manager, &fetch_script)?;
        for warning in &fetch_result.warnings {
            println!("Warning: {warning}");
        }
        println!("Fetched Wix blog export from {site_url}");
        PathBuf::from(fetch_result.export_path)
    } else {
        unreachable!("args parser guarantees source_path or url is set");
    };

    let staged_source = import_dir.join("wix-export.csv");
    fs::copy(&resolved_source, &staged_source).map_err(crate::io_error)?;

    let spinner = crate::tui::spinner("Importing Wix content\u{2026}");
    let package_manager = detect_package_manager(project_dir);
    let importer_module =
        crate::js_bridge::loaders::package_module_import("import/wix.js", Some(project_dir))?;
    let resolved_admin_db_path = resolve_absolute_admin_db_path(project_dir)?;

    let resume_from = if resume {
        let state_file = import_dir.join("download-state.json");
        serde_json::to_string(&state_file.display().to_string())
            .map_err(|error| error.to_string())?
    } else {
        "undefined".to_string()
    };

    let script = format!(
        r#"import {{ createAstropressWixImportSource }} from {};
const importer = createAstropressWixImportSource();
const result = await importer.importWix({{
  exportFile: {},
  artifactDir: {},
  downloadMedia: {},
  applyLocal: {},
  workspaceRoot: {},
  adminDbPath: {},
  resumeFrom: {},
}});
console.log(JSON.stringify(result));
"#,
        serde_json::to_string(&importer_module).map_err(|error| error.to_string())?,
        serde_json::to_string(&staged_source.display().to_string())
            .map_err(|error| error.to_string())?,
        serde_json::to_string(&import_dir.display().to_string())
            .map_err(|error| error.to_string())?,
        serde_json::to_string(&download_media).map_err(|error| error.to_string())?,
        serde_json::to_string(&apply_local).map_err(|error| error.to_string())?,
        serde_json::to_string(&project_dir.display().to_string())
            .map_err(|error| error.to_string())?,
        serde_json::to_string(&resolved_admin_db_path.display().to_string())
            .map_err(|error| error.to_string())?,
        resume_from,
    );

    let result: WixImportResult =
        run_package_json_command(project_dir, package_manager, &script)?;
    crate::tui::finish_spinner(spinner, "Wix import complete.");
    let report_json =
        serde_json::to_string_pretty(&result).map_err(|error| error.to_string())?;
    let report_file = import_dir.join("wix.report.json");
    fs::write(&report_file, format!("{report_json}\n")).map_err(crate::io_error)?;

    let manifest = WixImportManifest {
        source_file: staged_source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("wix-export.csv")
            .to_string(),
        imported_at_unix_ms: now_unix_ms(),
        report_file: "wix.report.json".to_string(),
        artifact_dir: import_dir.display().to_string(),
    };
    let manifest_json =
        serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    fs::write(import_dir.join("manifest.json"), format!("{manifest_json}\n"))
        .map_err(crate::io_error)?;

    println!(
        "Staged Wix import artifacts in {}",
        import_dir.display()
    );
    println!(
        "Imported {} posts, {} media references, {} authors from {}",
        result.imported_records,
        result.imported_media,
        result.imported_authors,
        resolved_source.display()
    );
    println!(
        "Execution status: {} (downloaded {} media files)",
        result.status, result.downloaded_media
    );
    if !result.failed_media.is_empty() {
        println!("{} media files failed to download.", result.failed_media.len());
    }
    if let Some(local_apply) = result.local_apply {
        println!(
            "Applied import into local database at {}",
            local_apply.admin_db_path
        );
    }
    if !result.warnings.is_empty() {
        println!("Warnings:");
        for warning in &result.warnings {
            println!("  - {warning}");
        }
    }

    // Post-import verification (interactive, skipped in plain mode).
    let source_label = resolved_source
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("Wix")
        .to_string();
    let summary = ImportSummary {
        post_count: result.imported_records,
        page_count: 0,
        media_count: result.imported_media,
        warning_count: result.warnings.len(),
        source_label,
    };
    let choice = crate::telemetry::post_import_verification(&summary);

    // Determine effective crawl mode (user may have chosen 'c' in the verification prompt).
    let effective_crawl = match choice {
        PostImportChoice::Crawl => CrawlMode::Browser,
        _ => crawl_mode,
    };

    crawl_and_save(project_dir, &import_dir, url, effective_crawl)?;
    Ok(())
}
