use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::cli_config::args::CrawlMode;
use crate::js_bridge::loaders::{
    resolve_admin_db_path, resolve_local_provider, run_content_services_operation,
    ContentServicesReport,
};
use crate::js_bridge::runner::{detect_package_manager, run_package_json_command};

pub(crate) fn bootstrap_content_services(project_dir: &Path) -> Result<(), String> {
    let report = run_content_services_operation(project_dir, "bootstrapAstropressContentServices")?;
    print_content_services_report(&report);
    Ok(())
}

pub(crate) fn print_content_services_report(report: &ContentServicesReport) {
    println!("Astropress content services report");
    println!("Content services: {}", report.content_services);
    println!("Status: {}", report.support_level);
    println!(
        "Service origin: {}",
        report.service_origin.as_deref().unwrap_or("not set")
    );
    if let Some(manifest_file) = &report.manifest_file {
        println!("Manifest: {manifest_file}");
    }
    if !report.required_env_keys.is_empty() {
        println!("Required keys:");
        for key in &report.required_env_keys {
            println!("  - {key}");
        }
    }
    if !report.missing_env_keys.is_empty() {
        println!("Missing keys:");
        for key in &report.missing_env_keys {
            println!("  - {key}");
        }
    }
}

pub(crate) fn now_unix_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

/// Resolves the admin DB path to an absolute `PathBuf` for the given project.
pub(crate) fn resolve_absolute_admin_db_path(project_dir: &Path) -> Result<PathBuf, String> {
    let local_provider = resolve_local_provider(project_dir, None)?;
    let admin_db_path = resolve_admin_db_path(project_dir, local_provider)?;
    let candidate = PathBuf::from(&admin_db_path);
    if candidate.is_absolute() {
        Ok(candidate)
    } else {
        Ok(project_dir.join(candidate))
    }
}

/// After an import, optionally crawl remaining site pages and save results to
/// `{import_dir}/crawled-pages.json`. Does nothing when `crawl_mode` is `None`
/// or `url` is absent.
pub(crate) fn crawl_and_save(
    project_dir: &Path,
    import_dir: &Path,
    url: Option<&str>,
    crawl_mode: CrawlMode,
) -> Result<(), String> {
    if crawl_mode == CrawlMode::None {
        return Ok(());
    }
    let Some(site_url) = url else {
        return Ok(());
    };
    let pm = detect_package_manager(project_dir);
    let crawler_module = crate::js_bridge::loaders::package_module_import(
        "import/page-crawler.js",
        Some(project_dir),
    )?;
    let (fn_name, label) = match crawl_mode {
        CrawlMode::Browser => ("crawlSitePagesWithBrowser", "browser"),
        _ => ("crawlSitePages", "fetch"),
    };
    let crawl_spinner = crate::tui::spinner(&format!("Crawling site pages ({label})\u{2026}"));
    let crawl_script = format!(
        "import {{ {fn_name} }} from {};\nconst result = await {fn_name}({{ siteUrl: {} }});\nconsole.log(JSON.stringify(result));",
        serde_json::to_string(&crawler_module).map_err(|e| e.to_string())?,
        serde_json::to_string(site_url).map_err(|e| e.to_string())?,
    );
    let crawl_result: serde_json::Value =
        run_package_json_command(project_dir, pm, &crawl_script)?;
    let page_count = crawl_result["pages"].as_array().map_or(0, Vec::len);
    let fail_count = crawl_result["failed"].as_array().map_or(0, Vec::len);
    crate::tui::finish_spinner(
        crawl_spinner,
        &format!("Crawled {page_count} pages ({fail_count} failures)."),
    );
    let crawl_json = serde_json::to_string_pretty(&crawl_result).map_err(|e| e.to_string())?;
    fs::write(
        import_dir.join("crawled-pages.json"),
        format!("{crawl_json}\n"),
    )
    .map_err(crate::io_error)?;
    println!("Crawl results saved to crawled-pages.json");
    Ok(())
}
