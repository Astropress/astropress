//! Argument parsers for `astropress backup`, `restore`, `doctor`, and `sync`.
//! Parsers for `services`, `db`, `upgrade`, and `config migrate` live in
//! `ops_more.rs` to keep each file under the 300-line arch-lint threshold.

use std::env;
use std::path::PathBuf;

use super::Command;

#[path = "ops_more.rs"]
mod ops_more;

// Re-export so callers in `args/mod.rs` can keep using `ops::*`.
pub(super) use ops_more::{
    parse_config_migrate_command, parse_db_migrate_command, parse_db_rollback_command,
    parse_services_bootstrap_command, parse_services_verify_command,
    parse_upgrade_apply_command, parse_upgrade_check_command,
};

pub(super) fn parse_backup_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut output_dir = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--out" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--out`.".to_string())?;
                output_dir = Some(PathBuf::from(value));
            }
            other => return Err(format!("Unsupported astropress backup option: `{other}`.")),
        }
        index += 1;
    }

    Ok(Command::Backup {
        project_dir,
        output_dir,
    })
}

pub(super) fn parse_restore_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut input_dir = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--from" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--from`.".to_string())?;
                input_dir = Some(PathBuf::from(value));
            }
            other => return Err(format!("Unsupported astropress restore option: `{other}`.")),
        }
        index += 1;
    }

    Ok(Command::Restore {
        project_dir,
        input_dir: input_dir.ok_or_else(|| {
            "Usage: `astropress restore --from <snapshot-dir> [--project-dir <dir>]`.".to_string()
        })?,
    })
}

pub(super) fn parse_doctor_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut strict = false;
    let mut json = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--strict" => {
                strict = true;
            }
            "--json" => {
                json = true;
            }
            other => return Err(format!("Unsupported astropress doctor option: `{other}`.")),
        }
        index += 1;
    }

    Ok(Command::Doctor { project_dir, strict, json })
}

pub(super) fn parse_sync_export_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut output_dir = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--out" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--out`.".to_string())?;
                output_dir = Some(PathBuf::from(value));
            }
            other => {
                return Err(format!(
                    "Unsupported astropress sync export option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    Ok(Command::SyncExport {
        project_dir,
        output_dir,
    })
}

pub(super) fn parse_sync_import_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut input_dir = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--from" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--from`.".to_string())?;
                input_dir = Some(PathBuf::from(value));
            }
            other => {
                return Err(format!(
                    "Unsupported astropress sync import option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    Ok(Command::SyncImport {
        project_dir,
        input_dir: input_dir.ok_or_else(|| {
            "Usage: `astropress sync import --from <snapshot-dir> [--project-dir <dir>]`."
                .to_string()
        })?,
    })
}
