use std::path::Path;

use crate::js_bridge::loaders::{run_content_services_operation, ContentServicesReport};

pub(crate) fn bootstrap_content_services(project_dir: &Path) -> Result<(), String> {
    let report =
        run_content_services_operation(project_dir, "bootstrapAstropressContentServices")?;
    print_content_services_report(&report);
    Ok(())
}

pub(crate) fn verify_content_services(
    project_dir: &Path,
) -> Result<ContentServicesReport, String> {
    run_content_services_operation(project_dir, "verifyAstropressContentServices")
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
