//! Argument parsers for `astropress services`, `db`, `upgrade`, and `config migrate`.
//! Split from `ops.rs` to keep each file under the 300-line arch-lint threshold.

use std::env;
use std::path::PathBuf;

use super::Command;

pub(in crate::cli_config::args) fn parse_services_bootstrap_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
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
            other => {
                return Err(format!(
                    "Unsupported astropress services bootstrap option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    Ok(Command::ServicesBootstrap { project_dir })
}

pub(in crate::cli_config::args) fn parse_services_verify_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
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
            other => {
                return Err(format!(
                    "Unsupported astropress services verify option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    Ok(Command::ServicesVerify { project_dir })
}

pub(in crate::cli_config::args) fn parse_db_migrate_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut migrations_dir = None;
    let mut dry_run = false;
    let mut target = "local".to_string();
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
            "--migrations-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--migrations-dir`.".to_string())?;
                migrations_dir = Some(value.clone());
            }
            "--dry-run" => {
                dry_run = true;
            }
            "--target" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--target`. Use `local` or `d1`.".to_string())?;
                match value.as_str() {
                    "local" | "d1" => target = value.clone(),
                    other => return Err(format!("Unknown --target `{other}`. Supported: local, d1.")),
                }
            }
            other => {
                return Err(format!(
                    "Unsupported astropress db migrate option: `{other}`."
                ))
            }
        }
        index += 1; // ~ skip
    }

    Ok(Command::DbMigrate { project_dir, migrations_dir, dry_run, target })
}

pub(in crate::cli_config::args) fn parse_db_rollback_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut dry_run = false;
    let mut target = "local".to_string();
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
            "--dry-run" => {
                dry_run = true;
            }
            "--target" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--target`. Use `local` or `d1`.".to_string())?;
                match value.as_str() {
                    "local" | "d1" => target = value.clone(),
                    other => return Err(format!("Unknown --target `{other}`. Supported: local, d1.")),
                }
            }
            other => {
                return Err(format!(
                    "Unsupported astropress db rollback option: `{other}`."
                ))
            }
        }
        index += 1; // ~ skip
    }

    Ok(Command::DbRollback { project_dir, dry_run, target })
}

pub(in crate::cli_config::args) fn parse_upgrade_check_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
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
            "--check" => {
                // --check is the default and only behaviour; accept it as a no-op flag.
            }
            other => {
                return Err(format!(
                    "Unsupported astropress upgrade option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    Ok(Command::UpgradeCheck { project_dir })
}

pub(in crate::cli_config::args) fn parse_upgrade_apply_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
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
            "--apply" => {
                // --apply is the subcommand; accept it as a no-op flag if repeated.
            }
            other => {
                return Err(format!(
                    "Unsupported astropress upgrade --apply option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    Ok(Command::UpgradeApply { project_dir })
}

pub(in crate::cli_config::args) fn parse_config_migrate_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut dry_run = false;
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
            "--dry-run" => {
                dry_run = true;
            }
            other => {
                return Err(format!(
                    "Unsupported astropress config migrate option: `{other}`."
                ))
            }
        }
        index += 1; // ~ skip
    }

    Ok(Command::ConfigMigrate { project_dir, dry_run })
}
