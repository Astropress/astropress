use std::fs;
use std::io::Write as _;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::cli_config::args::CrawlMode;
use crate::commands::import_common::{crawl_and_save, now_unix_ms, resolve_absolute_admin_db_path};
use crate::js_bridge::runner::{detect_package_manager, run_package_json_command};
use crate::telemetry::{ImportSummary, PostImportChoice};

#[derive(Debug, Serialize)]
pub(crate) struct WordPressImportManifest {
    source_file: String,
    imported_at_unix_ms: u128,
    inventory_file: String,
    plan_file: String,
    report_file: String,
    artifact_dir: String,
    content_file: String,
    media_file: String,
    comment_file: String,
    user_file: String,
    redirect_file: String,
    taxonomy_file: String,
    remediation_file: String,
    download_state_file: String,
    local_apply_report_file: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportEntityCounts {
    posts: usize,
    pages: usize,
    attachments: usize,
    redirects: usize,
    comments: usize,
    users: usize,
    categories: usize,
    tags: usize,
    skipped: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportInventory {
    detected_records: usize,
    detected_media: usize,
    detected_comments: usize,
    detected_users: usize,
    detected_shortcodes: usize,
    detected_builder_markers: usize,
    entity_counts: WordPressImportEntityCounts,
    unsupported_patterns: Vec<String>,
    remediation_candidates: Vec<String>,
    warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportPlan {
    artifact_dir: Option<String>,
    include_comments: bool,
    include_users: bool,
    include_media: bool,
    download_media: bool,
    apply_local: bool,
    permalink_strategy: String,
    resume_supported: bool,
    entity_counts: WordPressImportEntityCounts,
    review_required: bool,
    manual_tasks: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportArtifacts {
    artifact_dir: Option<String>,
    inventory_file: Option<String>,
    plan_file: Option<String>,
    content_file: Option<String>,
    media_file: Option<String>,
    comment_file: Option<String>,
    user_file: Option<String>,
    redirect_file: Option<String>,
    taxonomy_file: Option<String>,
    remediation_file: Option<String>,
    download_state_file: Option<String>,
    local_apply_report_file: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressLocalApplyReport {
    runtime: String,
    workspace_root: String,
    admin_db_path: String,
    applied_records: usize,
    applied_media: usize,
    applied_comments: usize,
    applied_users: usize,
    applied_redirects: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportFailedMedia {
    id: String,
    source_url: Option<String>,
    reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportResult {
    status: String,
    imported_records: usize,
    imported_media: usize,
    imported_comments: usize,
    imported_users: usize,
    imported_redirects: usize,
    downloaded_media: usize,
    failed_media: Vec<WordPressImportFailedMedia>,
    review_required: bool,
    manual_tasks: Vec<String>,
    inventory: WordPressImportInventory,
    plan: WordPressImportPlan,
    artifacts: Option<WordPressImportArtifacts>,
    local_apply: Option<WordPressLocalApplyReport>,
    warnings: Vec<String>,
}

/// Returned by the JS `fetchWordPressExport` call.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FetchExportResult {
    export_path: String,
    warnings: Vec<String>,
}

fn basename_or(value: Option<String>, fallback: &str) -> String {
    value
        .as_deref()
        .map(PathBuf::from)
        .and_then(|path| {
            path.file_name()
                .and_then(|value| value.to_str())
                .map(ToString::to_string)
        })
        .unwrap_or_else(|| fallback.to_string())
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn stage_wordpress_import(
    project_dir: &Path,
    source_path: Option<&Path>,
    url: Option<&str>,
    credentials_file: Option<&Path>,
    username: Option<&str>,
    password: Option<&str>,
    artifact_dir: Option<&Path>,
    download_media: bool,
    apply_local: bool,
    resume: bool,
    crawl_mode: CrawlMode,
) -> Result<(), String> {
    let import_dir = artifact_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| project_dir.join(".astropress").join("import"));
    fs::create_dir_all(&import_dir).map_err(crate::io_error)?;

    // Resolve source file — either provided directly or fetched via browser automation.
    let resolved_source: PathBuf = if let Some(path) = source_path {
        if !path.is_file() {
            return Err(format!(
                "WordPress export file was not found: {}",
                path.display()
            ));
        }
        path.to_path_buf()
    } else if let Some(site_url) = url {
        let (wp_username, wp_password) = resolve_wordpress_credentials(
            site_url,
            credentials_file,
            username,
            password,
        )?;
        let package_manager = detect_package_manager(project_dir);
        let fetch_module = crate::js_bridge::loaders::package_module_import(
            "import/fetch-wordpress.js",
            Some(project_dir),
        )?;
        let download_dir = import_dir.join("downloads");
        let fetch_script = format!(
            r#"import {{ fetchWordPressExport }} from {};
const result = await fetchWordPressExport({{
  siteUrl: {},
  username: {},
  password: {},
  downloadDir: {},
}});
console.log(JSON.stringify(result));"#,
            serde_json::to_string(&fetch_module).map_err(|e| e.to_string())?,
            serde_json::to_string(site_url).map_err(|e| e.to_string())?,
            serde_json::to_string(&wp_username).map_err(|e| e.to_string())?,
            serde_json::to_string(&wp_password).map_err(|e| e.to_string())?,
            serde_json::to_string(&download_dir.display().to_string()).map_err(|e| e.to_string())?,
        );
        let fetch_result: FetchExportResult =
            run_package_json_command(project_dir, package_manager, &fetch_script)?;
        for warning in &fetch_result.warnings {
            println!("Warning: {warning}");
        }
        println!("Fetched WordPress export from {site_url}");
        PathBuf::from(fetch_result.export_path)
    } else {
        unreachable!("args parser guarantees source_path or url is set");
    };

    let extension = resolved_source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("xml");
    let staged_source = import_dir.join(format!("wordpress-source.{extension}"));
    fs::copy(&resolved_source, &staged_source).map_err(crate::io_error)?;

    let spinner = crate::tui::spinner("Importing WordPress content\u{2026}");
    let package_manager = detect_package_manager(project_dir);
    let importer_module =
        crate::js_bridge::loaders::package_module_import("import/wordpress.js", Some(project_dir))?;
    let resolved_admin_db_path = resolve_absolute_admin_db_path(project_dir)?;
    let script = format!(
        r#"import {{ createAstropressWordPressImportSource }} from {};
const importer = createAstropressWordPressImportSource();
const inventory = await importer.inspectWordPress({{ exportFile: {} }});
const plan = await importer.planWordPressImport({{
  inventory,
  artifactDir: {},
  downloadMedia: {},
  applyLocal: {},
}});
const result = await ({} ? importer.resumeWordPressImport({{
  exportFile: {},
  artifactDir: {},
  downloadMedia: {},
  applyLocal: {},
  workspaceRoot: {},
  adminDbPath: {},
}}) : importer.importWordPress({{
  exportFile: {},
  artifactDir: {},
  downloadMedia: {},
  applyLocal: {},
  workspaceRoot: {},
  adminDbPath: {},
  plan,
}}));
console.log(JSON.stringify({{
  status: result.status,
  imported_records: result.importedRecords,
  imported_media: result.importedMedia,
  imported_comments: result.importedComments,
  imported_users: result.importedUsers,
  imported_redirects: result.importedRedirects,
  downloaded_media: result.downloadedMedia,
  failed_media: result.failedMedia.map((entry) => ({{
    id: entry.id,
    source_url: entry.sourceUrl ?? null,
    reason: entry.reason,
  }})),
  review_required: result.reviewRequired,
  manual_tasks: result.manualTasks,
  inventory: {{
    detected_records: inventory.detectedRecords,
    detected_media: inventory.detectedMedia,
    detected_comments: inventory.detectedComments,
    detected_users: inventory.detectedUsers,
    detected_shortcodes: inventory.detectedShortcodes,
    detected_builder_markers: inventory.detectedBuilderMarkers,
    entity_counts: {{
      posts: inventory.entityCounts.posts,
      pages: inventory.entityCounts.pages,
      attachments: inventory.entityCounts.attachments,
      redirects: inventory.entityCounts.redirects,
      comments: inventory.entityCounts.comments,
      users: inventory.entityCounts.users,
      categories: inventory.entityCounts.categories,
      tags: inventory.entityCounts.tags,
      skipped: inventory.entityCounts.skipped,
    }},
    unsupported_patterns: inventory.unsupportedPatterns,
    remediation_candidates: inventory.remediationCandidates,
    warnings: inventory.warnings,
  }},
  plan: {{
    artifact_dir: plan.artifactDir ?? null,
    include_comments: plan.includeComments,
    include_users: plan.includeUsers,
    include_media: plan.includeMedia,
    download_media: plan.downloadMedia,
    apply_local: plan.applyLocal,
    permalink_strategy: plan.permalinkStrategy,
    resume_supported: plan.resumeSupported,
    entity_counts: {{
      posts: plan.entityCounts.posts,
      pages: plan.entityCounts.pages,
      attachments: plan.entityCounts.attachments,
      redirects: plan.entityCounts.redirects,
      comments: plan.entityCounts.comments,
      users: plan.entityCounts.users,
      categories: plan.entityCounts.categories,
      tags: plan.entityCounts.tags,
      skipped: plan.entityCounts.skipped,
    }},
    review_required: plan.reviewRequired,
    manual_tasks: plan.manualTasks,
  }},
  artifacts: result.artifacts ? {{
    artifact_dir: result.artifacts.artifactDir ?? null,
    inventory_file: result.artifacts.inventoryFile ?? null,
    plan_file: result.artifacts.planFile ?? null,
    content_file: result.artifacts.contentFile ?? null,
    media_file: result.artifacts.mediaFile ?? null,
    comment_file: result.artifacts.commentFile ?? null,
    user_file: result.artifacts.userFile ?? null,
    redirect_file: result.artifacts.redirectFile ?? null,
    taxonomy_file: result.artifacts.taxonomyFile ?? null,
    remediation_file: result.artifacts.remediationFile ?? null,
    download_state_file: result.artifacts.downloadStateFile ?? null,
    local_apply_report_file: result.artifacts.localApplyReportFile ?? null,
  }} : null,
  local_apply: result.localApply ? {{
    runtime: result.localApply.runtime,
    workspace_root: result.localApply.workspaceRoot,
    admin_db_path: result.localApply.adminDbPath,
    applied_records: result.localApply.appliedRecords,
    applied_media: result.localApply.appliedMedia,
    applied_comments: result.localApply.appliedComments,
    applied_users: result.localApply.appliedUsers,
    applied_redirects: result.localApply.appliedRedirects,
  }} : null,
  warnings: result.warnings,
}}));"#,
        serde_json::to_string(&importer_module).map_err(|error| error.to_string())?,
        serde_json::to_string(&staged_source.display().to_string())
            .map_err(|error| error.to_string())?,
        serde_json::to_string(&import_dir.display().to_string())
            .map_err(|error| error.to_string())?,
        serde_json::to_string(&download_media).map_err(|error| error.to_string())?,
        serde_json::to_string(&apply_local).map_err(|error| error.to_string())?,
        serde_json::to_string(&resume).map_err(|error| error.to_string())?,
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
        serde_json::to_string(&staged_source.display().to_string())
            .map_err(|error| error.to_string())?,
        serde_json::to_string(&import_dir.display().to_string())
            .map_err(|error| error.to_string())?,
        serde_json::to_string(&download_media).map_err(|error| error.to_string())?,
        serde_json::to_string(&apply_local).map_err(|error| error.to_string())?,
        serde_json::to_string(&project_dir.display().to_string())
            .map_err(|error| error.to_string())?,
        serde_json::to_string(&resolved_admin_db_path.display().to_string())
            .map_err(|error| error.to_string())?
    );
    let result: WordPressImportResult =
        run_package_json_command(project_dir, package_manager, &script)?;
    crate::tui::finish_spinner(spinner, "WordPress import complete.");
    let report_json =
        serde_json::to_string_pretty(&result).map_err(|error| error.to_string())?;
    let report_file = import_dir.join("wordpress.report.json");
    fs::write(&report_file, format!("{report_json}\n")).map_err(crate::io_error)?;

    let manifest = WordPressImportManifest {
        source_file: staged_source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("source.xml")
            .to_string(),
        imported_at_unix_ms: now_unix_ms(),
        inventory_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.inventory_file.clone()),
            "wordpress.inventory.json",
        ),
        plan_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.plan_file.clone()),
            "wordpress.plan.json",
        ),
        report_file: report_file
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("wordpress.report.json")
            .to_string(),
        artifact_dir: import_dir.display().to_string(),
        content_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.content_file.clone()),
            "content-records.json",
        ),
        media_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.media_file.clone()),
            "media-manifest.json",
        ),
        comment_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.comment_file.clone()),
            "comment-records.json",
        ),
        user_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.user_file.clone()),
            "user-records.json",
        ),
        redirect_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.redirect_file.clone()),
            "redirect-records.json",
        ),
        taxonomy_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.taxonomy_file.clone()),
            "taxonomy-records.json",
        ),
        remediation_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.remediation_file.clone()),
            "remediation-candidates.json",
        ),
        download_state_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.download_state_file.clone()),
            "download-state.json",
        ),
        local_apply_report_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.local_apply_report_file.clone()),
            "",
        ),
    };

    let manifest_json =
        serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    fs::write(import_dir.join("manifest.json"), format!("{manifest_json}\n"))
        .map_err(crate::io_error)?;

    println!(
        "Staged WordPress import artifacts in {}",
        import_dir.display()
    );
    println!(
        "Imported {} records, {} media references, {} comments, {} users, and {} redirects from {}",
        result.imported_records,
        result.imported_media,
        result.imported_comments,
        result.imported_users,
        result.imported_redirects,
        resolved_source.display()
    );
    println!(
        "Execution status: {} (downloaded {} media files)",
        result.status, result.downloaded_media
    );
    println!(
        "Detected {} shortcodes and {} builder markers",
        result.inventory.detected_shortcodes, result.inventory.detected_builder_markers
    );
    if result.review_required {
        println!("Manual review is required for this import.");
    }
    if let Some(local_apply) = result.local_apply {
        println!(
            "Applied import into {} at {}",
            local_apply.runtime, local_apply.admin_db_path
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
        .unwrap_or("WordPress")
        .to_string();
    let summary = ImportSummary {
        post_count: result.imported_records,
        page_count: result.inventory.entity_counts.pages,
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

// ---------------------------------------------------------------------------
// Credential resolution helpers
// ---------------------------------------------------------------------------

fn resolve_wordpress_credentials(
    site_url: &str,
    credentials_file: Option<&Path>,
    username: Option<&str>,
    password: Option<&str>,
) -> Result<(String, String), String> {
    // 1. Credentials file
    if let Some(file) = credentials_file {
        let content = fs::read_to_string(file)
            .map_err(|e| format!("Cannot read credentials file: {e}"))?;
        let json: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Credentials file is not valid JSON: {e}"))?;
        let wp = json
            .get("wordpress")
            .ok_or("Credentials file is missing a 'wordpress' section")?;
        let u = wp["username"]
            .as_str()
            .ok_or("Credentials file missing 'wordpress.username'")?
            .to_string();
        let p = wp["password"]
            .as_str()
            .ok_or("Credentials file missing 'wordpress.password'")?
            .to_string();
        return Ok((u, p));
    }

    // 2. Inline flags
    if let (Some(u), Some(p)) = (username, password) {
        return Ok((u.to_string(), p.to_string()));
    }

    // 3. Interactive prompt
    let u = match username {
        Some(u) => u.to_string(),
        None => {
            eprint!("WordPress username for {site_url}: ");
            std::io::stderr().flush().ok();
            let mut buf = String::new();
            std::io::stdin()
                .read_line(&mut buf)
                .map_err(|e| format!("Failed to read username: {e}"))?;
            buf.trim().to_string()
        }
    };
    let p = rpassword::prompt_password(format!("WordPress password for {u}: "))
        .map_err(|e| format!("Failed to read password: {e}"))?;
    Ok((u, p))
}
