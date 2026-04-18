use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::features::AllFeatures;

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
// Suppression check — checked before any prompt or send
// ---------------------------------------------------------------------------

/// Returns true if telemetry must be silent regardless of stored preference.
/// Order: explicit env var → EFF DNT spec → standard CI env vars.
fn is_telemetry_suppressed() -> bool {
    // ASTROPRESS_TELEMETRY=0 / false / disabled
    if matches!(
        std::env::var("ASTROPRESS_TELEMETRY").as_deref(),
        Ok("0") | Ok("false") | Ok("disabled")
    ) {
        return true;
    }
    // EFF Do Not Track spec (https://www.eff.org/dnt-policy)
    if matches!(std::env::var("DO_NOT_TRACK").as_deref(), Ok("1")) {
        return true;
    }
    // Standard CI environment variables — never prompt or send in CI
    if std::env::var("CI").is_ok()
        || std::env::var("GITHUB_ACTIONS").is_ok()
        || std::env::var("GITLAB_CI").is_ok()
        || std::env::var("CIRCLECI").is_ok()
    {
        return true;
    }
    false
}

// ---------------------------------------------------------------------------
// `astropress telemetry` subcommand
// ---------------------------------------------------------------------------

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum TelemetryAction {
    Status,
    Enable,
    Disable,
}

pub(crate) fn run_telemetry_command(action: TelemetryAction) { // ~ skip
    match action {
        TelemetryAction::Status => {
            if is_telemetry_suppressed() {
                println!("Telemetry: disabled (environment variable override)");
                println!("  Unset ASTROPRESS_TELEMETRY / DO_NOT_TRACK / CI to allow opt-in.");
            } else {
                match read_telemetry_config().telemetry {
                    Some(true)  => println!("Telemetry: enabled"),
                    Some(false) => println!("Telemetry: disabled"),
                    None => println!(
                        "Telemetry: not yet answered  \
                        (run `astropress new` to be prompted, or use `astropress telemetry enable`)"
                    ),
                }
            }
            println!("  Config: ~/.astropress/config.json");
            println!(
                "  Schema: \
                https://github.com/Astropress/astropress/blob/main/docs/TELEMETRY.md"
            );
        }
        TelemetryAction::Enable => {
            let mut c = read_telemetry_config();
            c.telemetry = Some(true);
            write_telemetry_config(&c);
            println!("Telemetry enabled. Thank you.");
            println!(
                "  Schema: \
                https://github.com/Astropress/astropress/blob/main/docs/TELEMETRY.md"
            );
        }
        TelemetryAction::Disable => {
            let mut c = read_telemetry_config();
            c.telemetry = Some(false);
            write_telemetry_config(&c);
            println!("Telemetry disabled. No data will be sent.");
        }
    }
}

// ---------------------------------------------------------------------------
// Post-`astropress new` consent + event
// ---------------------------------------------------------------------------

/// Called at the end of `run_post_scaffold_setup`. Asks for consent once (if
/// not already answered and not suppressed), then fires a `project_created`
/// event if the user opts in.
#[mutants::skip]
pub(crate) fn post_new_wizard(features: &AllFeatures, cli_version: &str, app_host: &str, data_services: &str) {
    if is_telemetry_suppressed() || crate::tui::is_plain() {
        return;
    }
    let opted_in = ask_telemetry_consent();
    if opted_in {
        let _ = send_project_created(features, cli_version, app_host, data_services);
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
#[mutants::skip]
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
// Telemetry consent prompt (shared by new wizard + import feedback)
// ---------------------------------------------------------------------------

#[mutants::skip]
fn ask_telemetry_consent() -> bool {
    // Env-var suppression takes precedence over everything.
    if is_telemetry_suppressed() {
        return false;
    }

    let config = read_telemetry_config();

    // Already opted in or out — respect the stored preference silently.
    if let Some(opted_in) = config.telemetry {
        return opted_in;
    }

    // Not yet asked — show an explanatory block, then a y/N prompt.
    println!();
    println!("Help improve Astropress? You can share anonymous usage data");
    println!("(feature selections, OS, CLI version — no paths, no content, no credentials).");
    println!(
        "  Full schema:  \
        https://github.com/Astropress/astropress/blob/main/docs/TELEMETRY.md"
    );
    println!("  Change later: astropress telemetry disable");
    println!();

    let result = dialoguer::Confirm::with_theme(&dialoguer::theme::ColorfulTheme::default())
        .with_prompt("Share anonymous usage data?")
        .default(false)   // N is default — user must explicitly choose Y to opt in
        .interact();

    let opted_in = result.unwrap_or(false);
    let mut updated = config;
    updated.telemetry = Some(opted_in);
    write_telemetry_config(&updated);
    opted_in
}

#[path = "telemetry_sends.rs"]
mod telemetry_sends;
use telemetry_sends::{send_project_created, send_telemetry_report};

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // Serialize env-var tests so they don't interfere with each other.
    static ENV_MUTEX: Mutex<()> = Mutex::new(());

    #[test]
    fn suppressed_by_astropress_telemetry_0() {
        let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        std::env::remove_var("DO_NOT_TRACK");
        std::env::remove_var("CI");
        std::env::remove_var("GITHUB_ACTIONS");
        std::env::remove_var("GITLAB_CI");
        std::env::remove_var("CIRCLECI");
        std::env::set_var("ASTROPRESS_TELEMETRY", "0");
        assert!(is_telemetry_suppressed());
        std::env::remove_var("ASTROPRESS_TELEMETRY");
    }

    #[test]
    fn suppressed_by_astropress_telemetry_false() {
        let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        std::env::remove_var("DO_NOT_TRACK");
        std::env::remove_var("CI");
        std::env::remove_var("GITHUB_ACTIONS");
        std::env::remove_var("GITLAB_CI");
        std::env::remove_var("CIRCLECI");
        std::env::set_var("ASTROPRESS_TELEMETRY", "false");
        assert!(is_telemetry_suppressed());
        std::env::remove_var("ASTROPRESS_TELEMETRY");
    }

    #[test]
    fn suppressed_by_astropress_telemetry_disabled() {
        let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        std::env::remove_var("DO_NOT_TRACK");
        std::env::remove_var("CI");
        std::env::remove_var("GITHUB_ACTIONS");
        std::env::remove_var("GITLAB_CI");
        std::env::remove_var("CIRCLECI");
        std::env::set_var("ASTROPRESS_TELEMETRY", "disabled");
        assert!(is_telemetry_suppressed());
        std::env::remove_var("ASTROPRESS_TELEMETRY");
    }

    #[test]
    fn suppressed_by_do_not_track() {
        let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        std::env::remove_var("ASTROPRESS_TELEMETRY");
        std::env::remove_var("CI");
        std::env::remove_var("GITHUB_ACTIONS");
        std::env::remove_var("GITLAB_CI");
        std::env::remove_var("CIRCLECI");
        std::env::set_var("DO_NOT_TRACK", "1");
        assert!(is_telemetry_suppressed());
        std::env::remove_var("DO_NOT_TRACK");
    }

    #[test]
    fn suppressed_by_ci() {
        let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        std::env::remove_var("ASTROPRESS_TELEMETRY");
        std::env::remove_var("DO_NOT_TRACK");
        std::env::remove_var("GITHUB_ACTIONS");
        std::env::remove_var("GITLAB_CI");
        std::env::remove_var("CIRCLECI");
        std::env::set_var("CI", "true");
        assert!(is_telemetry_suppressed());
        std::env::remove_var("CI");
    }

    #[test]
    fn suppressed_by_github_actions() {
        let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        std::env::remove_var("ASTROPRESS_TELEMETRY");
        std::env::remove_var("DO_NOT_TRACK");
        std::env::remove_var("CI");
        std::env::remove_var("GITLAB_CI");
        std::env::remove_var("CIRCLECI");
        std::env::set_var("GITHUB_ACTIONS", "true");
        assert!(is_telemetry_suppressed());
        std::env::remove_var("GITHUB_ACTIONS");
    }

    #[test]
    fn suppressed_by_gitlab_ci() {
        let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        std::env::remove_var("ASTROPRESS_TELEMETRY");
        std::env::remove_var("DO_NOT_TRACK");
        std::env::remove_var("CI");
        std::env::remove_var("GITHUB_ACTIONS");
        std::env::remove_var("CIRCLECI");
        std::env::set_var("GITLAB_CI", "true");
        assert!(is_telemetry_suppressed());
        std::env::remove_var("GITLAB_CI");
    }

    #[test]
    fn suppressed_by_circleci() {
        let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        std::env::remove_var("ASTROPRESS_TELEMETRY");
        std::env::remove_var("DO_NOT_TRACK");
        std::env::remove_var("CI");
        std::env::remove_var("GITHUB_ACTIONS");
        std::env::remove_var("GITLAB_CI");
        std::env::set_var("CIRCLECI", "true");
        assert!(is_telemetry_suppressed());
        std::env::remove_var("CIRCLECI");
    }

    #[test]
    fn not_suppressed_when_no_env_vars_set() {
        let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        std::env::remove_var("ASTROPRESS_TELEMETRY");
        std::env::remove_var("DO_NOT_TRACK");
        std::env::remove_var("CI");
        std::env::remove_var("GITHUB_ACTIONS");
        std::env::remove_var("GITLAB_CI");
        std::env::remove_var("CIRCLECI");
        assert!(!is_telemetry_suppressed());
    }

    #[test]
    fn config_path_uses_home_env_var() {
        let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        std::env::remove_var("USERPROFILE");
        std::env::set_var("HOME", "/tmp/ap_test_home");
        let path = astropress_config_path().expect("should return Some when HOME is set");
        assert!(path.ends_with(".astropress/config.json"),
            "expected path ending in .astropress/config.json, got: {}", path.display());
        std::env::remove_var("HOME");
    }

    #[test]
    fn read_telemetry_config_returns_stored_preference() {
        let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let tmp = std::env::temp_dir().join("ap_telemetry_test");
        let cfg_dir = tmp.join(".astropress");
        std::fs::create_dir_all(&cfg_dir).unwrap();
        std::fs::write(cfg_dir.join("config.json"), r#"{"telemetry":true}"#).unwrap();
        std::env::remove_var("USERPROFILE");
        std::env::set_var("HOME", &tmp);
        let config = read_telemetry_config();
        std::env::remove_var("HOME");
        assert_eq!(config.telemetry, Some(true),
            "expected telemetry=Some(true) from stored config, got: {:?}", config.telemetry);
    }
}
