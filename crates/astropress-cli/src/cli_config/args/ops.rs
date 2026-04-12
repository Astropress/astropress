use std::env;
use std::path::PathBuf;

use super::Command;

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

pub(super) fn parse_services_bootstrap_command(args: &[String]) -> Result<Command, String> {
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

pub(super) fn parse_services_verify_command(args: &[String]) -> Result<Command, String> {
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

pub(super) fn parse_db_migrate_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut migrations_dir = None;
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
            other => {
                return Err(format!(
                    "Unsupported astropress db migrate option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    Ok(Command::DbMigrate { project_dir, migrations_dir, dry_run })
}

pub(super) fn parse_db_rollback_command(args: &[String]) -> Result<Command, String> {
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
                    "Unsupported astropress db rollback option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    Ok(Command::DbRollback { project_dir, dry_run })
}

pub(super) fn parse_upgrade_check_command(args: &[String]) -> Result<Command, String> {
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

pub(super) fn parse_upgrade_apply_command(args: &[String]) -> Result<Command, String> {
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

pub(super) fn parse_config_migrate_command(args: &[String]) -> Result<Command, String> {
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
        index += 1;
    }

    Ok(Command::ConfigMigrate { project_dir, dry_run })
}
