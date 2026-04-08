use std::fs;
use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::cli_config::args::CrawlMode;
use crate::js_bridge::loaders::{resolve_admin_db_path, resolve_local_provider};
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

fn now_unix_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

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

    let spinner = crate::tui::spinner("Importing Wix content…");
    let package_manager = detect_package_manager(project_dir);
    let importer_module =
        crate::js_bridge::loaders::package_module_import("import/wix.js", Some(project_dir))?;
    let local_provider = resolve_local_provider(project_dir, None)?;
    let admin_db_path = resolve_admin_db_path(project_dir, local_provider)?;
    let resolved_admin_db_path = {
        let candidate = PathBuf::from(&admin_db_path);
        if candidate.is_absolute() {
            candidate
        } else {
            project_dir.join(candidate)
        }
    };

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

    // Optional: crawl pages not covered by the blog CSV export.
    if effective_crawl != CrawlMode::None {
        if let Some(site_url) = url {
            let pm = detect_package_manager(project_dir);
            let crawler_module = crate::js_bridge::loaders::package_module_import(
                "import/page-crawler.js",
                Some(project_dir),
            )?;
            let (fn_name, label) = match effective_crawl {
                CrawlMode::Browser => ("crawlSitePagesWithBrowser", "browser"),
                _ => ("crawlSitePages", "fetch"),
            };
            let crawl_spinner = crate::tui::spinner(&format!("Crawling site pages ({label})…"));
            let crawl_script = format!(
                r#"import {{ {fn_name} }} from {};
const result = await {fn_name}({{ siteUrl: {} }});
console.log(JSON.stringify(result));"#,
                serde_json::to_string(&crawler_module).map_err(|e| e.to_string())?,
                serde_json::to_string(site_url).map_err(|e| e.to_string())?,
            );
            let crawl_result: serde_json::Value =
                run_package_json_command(project_dir, pm, &crawl_script)?;
            let page_count = crawl_result["pages"].as_array().map_or(0, |p| p.len());
            let fail_count = crawl_result["failed"].as_array().map_or(0, |f| f.len());
            crate::tui::finish_spinner(
                crawl_spinner,
                &format!("Crawled {page_count} pages ({fail_count} failures)."),
            );
            let crawl_json =
                serde_json::to_string_pretty(&crawl_result).map_err(|e| e.to_string())?;
            fs::write(import_dir.join("crawled-pages.json"), format!("{crawl_json}\n"))
                .map_err(crate::io_error)?;
            println!("Crawl results saved to crawled-pages.json");
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Credential resolution helpers
// ---------------------------------------------------------------------------

fn resolve_wix_credentials(
    site_url: &str,
    credentials_file: Option<&Path>,
    email: Option<&str>,
    password: Option<&str>,
) -> Result<(String, String), String> {
    // 1. Credentials file
    if let Some(file) = credentials_file {
        let content = fs::read_to_string(file)
            .map_err(|e| format!("Cannot read credentials file: {e}"))?;
        let json: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Credentials file is not valid JSON: {e}"))?;
        let wix = json
            .get("wix")
            .ok_or("Credentials file is missing a 'wix' section")?;
        let e = wix["email"]
            .as_str()
            .ok_or("Credentials file missing 'wix.email'")?
            .to_string();
        let p = wix["password"]
            .as_str()
            .ok_or("Credentials file missing 'wix.password'")?
            .to_string();
        return Ok((e, p));
    }

    // 2. Inline flags
    if let (Some(e), Some(p)) = (email, password) {
        return Ok((e.to_string(), p.to_string()));
    }

    // 3. Interactive prompt
    let e = match email {
        Some(e) => e.to_string(),
        None => {
            eprint!("Wix email for {site_url}: ");
            std::io::stderr().flush().ok();
            let mut buf = String::new();
            std::io::stdin()
                .read_line(&mut buf)
                .map_err(|e| format!("Failed to read email: {e}"))?;
            buf.trim().to_string()
        }
    };
    let p = rpassword::prompt_password(format!("Wix password for {e}: "))
        .map_err(|e| format!("Failed to read password: {e}"))?;
    Ok((e, p))
}
