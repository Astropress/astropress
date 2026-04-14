//! Small parsers that don't belong to a larger subcommand group — `add` and
//! `migrate`. Split out of `mod.rs` to keep it under the 300-line arch-lint
//! warning.

use std::path::PathBuf;

use super::Command;
use crate::telemetry::TelemetryAction;

pub(super) fn parse_add_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut feature_args: Vec<String> = Vec::new();
    let mut index = 0;

    // Optional positional: first arg that doesn't start with `--` is the project dir.
    if let Some(first) = args.first() {
        if !first.starts_with("--") {
            project_dir = PathBuf::from(first);
            index = 1;
        }
    }

    while index < args.len() {
        feature_args.push(args[index].clone());
        index += 1;
    }

    Ok(Command::Add { project_dir, feature_args })
}

pub(super) fn parse_migrate_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut from: Option<String> = None;
    let mut to: Option<String> = None;
    let mut dry_run = false;
    let mut index = 0;

    // Optional positional: first arg that doesn't start with `--` is the project dir.
    if let Some(first) = args.first() {
        if !first.starts_with("--") {
            project_dir = PathBuf::from(first);
            index = 1;
        }
    }

    while index < args.len() {
        match args[index].as_str() {
            "--from" => {
                index += 1;
                from = Some(
                    args.get(index)
                        .ok_or_else(|| "Missing value after `--from`.".to_string())?
                        .clone(),
                );
            }
            "--to" => {
                index += 1;
                to = Some(
                    args.get(index)
                        .ok_or_else(|| "Missing value after `--to`.".to_string())?
                        .clone(),
                );
            }
            "--dry-run" | "--dry_run" => {
                dry_run = true;
            }
            other => return Err(format!("Unsupported astropress migrate option: `{other}`.")),
        }
        index += 1;
    }

    let from = from.ok_or_else(|| "Usage: `astropress migrate --from <tool> --to <tool>`.".to_string())?;
    let to   = to.ok_or_else(|| "Usage: `astropress migrate --from <tool> --to <tool>`.".to_string())?;

    Ok(Command::Migrate { project_dir, from, to, dry_run })
}

pub(super) fn parse_telemetry_command(args: &[String]) -> Result<Command, String> {
    match args.first().map(|s| s.as_str()) {
        Some("status") | None => Ok(Command::Telemetry { action: TelemetryAction::Status }),
        Some("enable")        => Ok(Command::Telemetry { action: TelemetryAction::Enable }),
        Some("disable")       => Ok(Command::Telemetry { action: TelemetryAction::Disable }),
        Some(other) => Err(format!(
            "Unknown telemetry subcommand `{other}`. Use: status, enable, disable."
        )),
    }
}
