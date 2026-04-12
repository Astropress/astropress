use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Default)]
struct TelemetryConfig {
    /// None = not yet asked, true = opted in, false = opted out.
    telemetry: Option<bool>,
}

fn astropress_config_path() -> Option<PathBuf> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()?;
    Some(PathBuf::from(home).join(".astropress").join("config.json"))
}

fn read_telemetry_config() -> TelemetryConfig {
    let Some(path) = astropress_config_path() else {
        return TelemetryConfig::default();
    };
    let Ok(content) = fs::read_to_string(&path) else {
        return TelemetryConfig::default();
    };
    serde_json::from_str(&content).unwrap_or_default()
}

fn write_telemetry_config(config: &TelemetryConfig) {
    let Some(path) = astropress_config_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(config) {
        let _ = fs::write(path, format!("{json}\n"));
    }
}

// ---------------------------------------------------------------------------
// Post-import verification
// ---------------------------------------------------------------------------

/// The user's choice after reviewing the import result.
#[derive(Debug)]
pub(crate) enum PostImportChoice {
    Happy,
    Unhappy,
    Crawl,
}

pub(crate) struct ImportSummary {
    pub post_count: usize,
    pub page_count: usize,
    pub media_count: usize,
    pub warning_count: usize,
    pub source_label: String,
}

/// Show the post-import summary and ask the user how it went.
/// In plain mode, always returns Happy (no prompt).
pub(crate) fn post_import_verification(summary: &ImportSummary) -> PostImportChoice {
    if crate::tui::is_plain() {
        return PostImportChoice::Happy;
    }

    println!();
    println!(
        "Imported {} posts, {} pages, {} media files from {}.",
        summary.post_count, summary.page_count, summary.media_count, summary.source_label,
    );
    if summary.warning_count > 0 {
        println!("Warnings: {}", summary.warning_count);
    }
    println!();

    let options = &[
        "Yes, looks good!",
        "No — something was wrong",
        "Crawl remaining pages with browser (Playwright)",
    ];

    let selection = dialoguer::Select::with_theme(&dialoguer::theme::ColorfulTheme::default())
        .with_prompt("Happy with the result?")
        .items(options)
        .default(0)
        .interact();

    let idx = match selection {
        Ok(i) => i,
        Err(_) => return PostImportChoice::Happy,
    };

    match idx {
        1 => {
            let issues = collect_issues();
            let share = ask_telemetry_consent();
            if share {
                let _ = send_telemetry_report(summary, &issues);
            }
            PostImportChoice::Unhappy
        }
        2 => PostImportChoice::Crawl,
        _ => PostImportChoice::Happy,
    }
}

// ---------------------------------------------------------------------------
// Issue collection
// ---------------------------------------------------------------------------

const ISSUE_OPTIONS: &[&str] = &[
    "Missing posts or pages",
    "Formatting / HTML issues",
    "Missing images or media",
    "Wrong metadata (authors, dates, categories)",
    "Other",
];

fn collect_issues() -> Vec<String> {
    let result = dialoguer::MultiSelect::with_theme(&dialoguer::theme::ColorfulTheme::default())
        .with_prompt("What was wrong? (space to select, enter to confirm)")
        .items(ISSUE_OPTIONS)
        .interact();

    match result {
        Ok(selected) => selected
            .into_iter()
            .map(|i| ISSUE_OPTIONS[i].to_string())
            .collect(),
        Err(_) => vec![],
    }
}

// ---------------------------------------------------------------------------
// Telemetry consent
// ---------------------------------------------------------------------------

fn ask_telemetry_consent() -> bool {
    let config = read_telemetry_config();

    // Already opted in or out — respect the stored preference.
    if let Some(opted_in) = config.telemetry {
        return opted_in;
    }

    // Not yet asked — prompt.
    let result = dialoguer::Confirm::with_theme(&dialoguer::theme::ColorfulTheme::default())
        .with_prompt("Share feedback anonymously to improve AstroPress?")
        .default(false)
        .interact();

    let opted_in = result.unwrap_or(false);
    let mut updated = config;
    updated.telemetry = Some(opted_in);
    write_telemetry_config(&updated);
    opted_in
}

// ---------------------------------------------------------------------------
// Anonymous telemetry POST
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct TelemetryPayload<'a> {
    source: &'a str,
    issues: &'a [String],
    post_count: usize,
    warning_count: usize,
    platform: &'a str,
}

fn send_telemetry_report(summary: &ImportSummary, issues: &[String]) -> Result<(), String> {
    // Fire-and-forget via curl subprocess so we don't need an async runtime.
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
