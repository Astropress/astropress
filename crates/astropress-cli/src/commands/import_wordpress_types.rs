//! Types, helpers, and output functions for the WordPress import command.
//! Extracted from import_wordpress.rs to keep that file under the 300-line limit.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::commands::import_common::now_unix_ms;

// ── manifest ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub(crate) struct WordPressImportManifest {
    pub source_file: String,
    pub imported_at_unix_ms: u128,
    pub inventory_file: String,
    pub plan_file: String,
    pub report_file: String,
    pub artifact_dir: String,
    pub content_file: String,
    pub media_file: String,
    pub comment_file: String,
    pub user_file: String,
    pub redirect_file: String,
    pub taxonomy_file: String,
    pub remediation_file: String,
    pub download_state_file: String,
    pub local_apply_report_file: String,
}

// ── import result types ───────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct WordPressImportEntityCounts {
    pub posts: usize,
    pub pages: usize,
    pub attachments: usize,
    pub redirects: usize,
    pub comments: usize,
    pub users: usize,
    pub categories: usize,
    pub tags: usize,
    pub skipped: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct WordPressImportInventory {
    pub detected_records: usize,
    pub detected_media: usize,
    pub detected_comments: usize,
    pub detected_users: usize,
    pub detected_shortcodes: usize,
    pub detected_builder_markers: usize,
    pub entity_counts: WordPressImportEntityCounts,
    pub unsupported_patterns: Vec<String>,
    pub remediation_candidates: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct WordPressImportPlan {
    pub artifact_dir: Option<String>,
    pub include_comments: bool,
    pub include_users: bool,
    pub include_media: bool,
    pub download_media: bool,
    pub apply_local: bool,
    pub permalink_strategy: String,
    pub resume_supported: bool,
    pub entity_counts: WordPressImportEntityCounts,
    pub review_required: bool,
    pub manual_tasks: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct WordPressImportArtifacts {
    pub artifact_dir: Option<String>,
    pub inventory_file: Option<String>,
    pub plan_file: Option<String>,
    pub content_file: Option<String>,
    pub media_file: Option<String>,
    pub comment_file: Option<String>,
    pub user_file: Option<String>,
    pub redirect_file: Option<String>,
    pub taxonomy_file: Option<String>,
    pub remediation_file: Option<String>,
    pub download_state_file: Option<String>,
    pub local_apply_report_file: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct WordPressLocalApplyReport {
    pub runtime: String,
    pub workspace_root: String,
    pub admin_db_path: String,
    pub applied_records: usize,
    pub applied_media: usize,
    pub applied_comments: usize,
    pub applied_users: usize,
    pub applied_redirects: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct WordPressImportFailedMedia {
    pub id: String,
    pub source_url: Option<String>,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct WordPressImportResult {
    pub status: String,
    pub imported_records: usize,
    pub imported_media: usize,
    pub imported_comments: usize,
    pub imported_users: usize,
    pub imported_redirects: usize,
    pub downloaded_media: usize,
    pub failed_media: Vec<WordPressImportFailedMedia>,
    pub review_required: bool,
    pub manual_tasks: Vec<String>,
    pub inventory: WordPressImportInventory,
    pub plan: WordPressImportPlan,
    pub artifacts: Option<WordPressImportArtifacts>,
    pub local_apply: Option<WordPressLocalApplyReport>,
    pub warnings: Vec<String>,
}

/// Returned by the JS `fetchWordPressExport` call.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FetchExportResult {
    pub export_path: String,
    pub warnings: Vec<String>,
}

// ── helpers ───────────────────────────────────────────────────────────────────

pub(crate) fn basename_or(value: Option<String>, fallback: &str) -> String {
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

pub(crate) fn build_wordpress_manifest(
    result: &WordPressImportResult,
    staged_source: &Path,
    import_dir: &Path,
    report_file: &Path,
) -> WordPressImportManifest {
    WordPressImportManifest {
        source_file: staged_source
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("source.xml")
            .to_string(),
        imported_at_unix_ms: now_unix_ms(),
        inventory_file: basename_or(
            result.artifacts.as_ref().and_then(|a| a.inventory_file.clone()),
            "wordpress.inventory.json",
        ),
        plan_file: basename_or(
            result.artifacts.as_ref().and_then(|a| a.plan_file.clone()),
            "wordpress.plan.json",
        ),
        report_file: report_file
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("wordpress.report.json")
            .to_string(),
        artifact_dir: import_dir.display().to_string(),
        content_file: basename_or(
            result.artifacts.as_ref().and_then(|a| a.content_file.clone()),
            "content-records.json",
        ),
        media_file: basename_or(
            result.artifacts.as_ref().and_then(|a| a.media_file.clone()),
            "media-manifest.json",
        ),
        comment_file: basename_or(
            result.artifacts.as_ref().and_then(|a| a.comment_file.clone()),
            "comment-records.json",
        ),
        user_file: basename_or(
            result.artifacts.as_ref().and_then(|a| a.user_file.clone()),
            "user-records.json",
        ),
        redirect_file: basename_or(
            result.artifacts.as_ref().and_then(|a| a.redirect_file.clone()),
            "redirect-records.json",
        ),
        taxonomy_file: basename_or(
            result.artifacts.as_ref().and_then(|a| a.taxonomy_file.clone()),
            "taxonomy-records.json",
        ),
        remediation_file: basename_or(
            result.artifacts.as_ref().and_then(|a| a.remediation_file.clone()),
            "remediation-candidates.json",
        ),
        download_state_file: basename_or(
            result.artifacts.as_ref().and_then(|a| a.download_state_file.clone()),
            "download-state.json",
        ),
        local_apply_report_file: basename_or(
            result.artifacts.as_ref().and_then(|a| a.local_apply_report_file.clone()),
            "",
        ),
    }
}

pub(crate) fn print_wordpress_import_results(
    result: &WordPressImportResult,
    resolved_source: &Path,
    import_dir: &Path,
) {
    println!("Staged WordPress import artifacts in {}", import_dir.display());
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
    if let Some(local_apply) = &result.local_apply {
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
}
