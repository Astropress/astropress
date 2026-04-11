use std::fs;
use std::path::{Path, PathBuf};

use crate::cli_config::args::CrawlMode;
use super::import_common::{
    crawl_and_save, resolve_absolute_admin_db_path, resolve_wordpress_credentials,
};
use super::import_wordpress_types::{
    FetchExportResult, WordPressImportResult,
    build_wordpress_manifest, print_wordpress_import_results,
};
use crate::js_bridge::runner::{detect_package_manager, run_package_json_command};
use crate::telemetry::{ImportSummary, PostImportChoice};

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

    let manifest = build_wordpress_manifest(&result, &staged_source, &import_dir, &report_file);
    let manifest_json =
        serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    fs::write(import_dir.join("manifest.json"), format!("{manifest_json}\n"))
        .map_err(crate::io_error)?;

    print_wordpress_import_results(&result, &resolved_source, &import_dir);

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
