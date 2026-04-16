//! Fire-and-forget telemetry event senders.
//! Extracted from `telemetry.rs` to keep that file under the 300-line limit.

use serde::Serialize;
use crate::features::AllFeatures;
use super::ImportSummary;


pub(super) fn send_project_created(f: &AllFeatures, version: &str, app_host: &str, data_services: &str) -> Result<(), String> {
    // Debug representations of enums produce clean variant names ("HyperSwitch",
    // "Postiz", etc.) — no paths, no content, no credentials.
    let payload = serde_json::json!({
        "event":        "project_created",
        "version":      version,
        "os":           std::env::consts::OS,
        "app_host":     app_host,
        "data_services": data_services,
        "features": {
            "cms":                 format!("{:?}", f.cms),
            "analytics":           format!("{:?}", f.analytics),
            "payments":            format!("{:?}", f.payments),
            "social":              format!("{:?}", f.social),
            "commerce":            format!("{:?}", f.commerce),
            "email":               format!("{:?}", f.email),
            "transactional_email": format!("{:?}", f.transactional_email),
            "forum":               format!("{:?}", f.forum),
            "chat":                format!("{:?}", f.chat),
            "notify":              format!("{:?}", f.notify),
            "schedule":            format!("{:?}", f.schedule),
            "video":               format!("{:?}", f.video),
            "podcast":             format!("{:?}", f.podcast),
            "events":              format!("{:?}", f.events),
            "sso":                 format!("{:?}", f.sso),
            "crm":                 format!("{:?}", f.crm),
            "knowledge_base":      format!("{:?}", f.knowledge_base),
            "search":              format!("{:?}", f.search),
            "courses":             format!("{:?}", f.courses),
            "forms":               format!("{:?}", f.forms),
            "status":              format!("{:?}", f.status),
            "ab_testing":          format!("{:?}", f.ab_testing),
            "heatmap":             format!("{:?}", f.heatmap),
            "docs":                format!("{:?}", f.docs),
            "job_board":           f.job_board,
            "enable_api":          f.enable_api,
        }
    });
    let json = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    let _ = std::process::Command::new("curl")
        .args([
            "-s", "-X", "POST",
            "-H", "Content-Type: application/json",
            "-d", &json,
            "https://telemetry.astropress.diy/project-created",
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();
    Ok(())
}

#[derive(Serialize)]
struct TelemetryPayload<'a> {
    source: &'a str,
    issues: &'a [String],
    post_count: usize,
    warning_count: usize,
    platform: &'a str,
}

pub(super) fn send_telemetry_report(summary: &ImportSummary, issues: &[String]) -> Result<(), String> {
    // Payload: source, issues[], postCount, warningCount, platform.
    // No URLs, no content, no credentials.
    let payload = TelemetryPayload {
        source: &summary.source_label,
        issues,
        post_count: summary.post_count,
        warning_count: summary.warning_count,
        platform: std::env::consts::OS,
    };
    let json = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    let _ = std::process::Command::new("curl")
        .args([
            "-s",
            "-X",
            "POST",
            "-H",
            "Content-Type: application/json",
            "-d",
            &json,
            "https://telemetry.astropress.diy/import-feedback",
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();
    Ok(())
}
