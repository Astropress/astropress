use std::path::Path;
use std::process::{Command as ProcessCommand, ExitCode};

use serde::Deserialize;

use crate::providers::{LocalProvider, PackageManager};

pub(crate) fn detect_package_manager(project_dir: &Path) -> PackageManager {
    if project_dir.join("bun.lock").exists() || command_available("bun") {
        PackageManager::Bun
    } else {
        PackageManager::Npm
    }
}

pub(crate) fn command_available(command: &str) -> bool {
    ProcessCommand::new(command)
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

pub(crate) fn install_dependencies_if_needed(
    project_dir: &Path,
    package_manager: PackageManager,
) -> Result<(), String> {
    if project_dir.join("node_modules").exists() {
        return Ok(());
    }

    let status = match package_manager {
        PackageManager::Bun => ProcessCommand::new("bun")
            .arg("install")
            .current_dir(project_dir)
            .status()
            .map_err(crate::io_error)?,
        PackageManager::Npm => ProcessCommand::new("npm")
            .arg("install")
            .current_dir(project_dir)
            .status()
            .map_err(crate::io_error)?,
    };

    if status.success() {
        Ok(())
    } else {
        Err("Dependency installation failed.".into())
    }
}

pub(crate) fn run_package_json_command<T: for<'de> Deserialize<'de>>(
    project_dir: &Path,
    package_manager: PackageManager,
    script: &str,
) -> Result<T, String> {
    let output = match package_manager {
        PackageManager::Bun => ProcessCommand::new("bun")
            .args(["--eval", script])
            .current_dir(project_dir)
            .output()
            .map_err(crate::io_error)?,
        PackageManager::Npm => ProcessCommand::new("node")
            .args(["--input-type=module", "--eval", script])
            .current_dir(project_dir)
            .output()
            .map_err(crate::io_error)?,
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(if detail.is_empty() {
            "Astropress package command failed.".into()
        } else {
            detail
        });
    }

    let stdout = String::from_utf8(output.stdout).map_err(|error| error.to_string())?;
    serde_json::from_str(stdout.trim()).map_err(|error| error.to_string())
}

pub(crate) fn seed_local_sqlite_database(
    project_dir: &Path,
    package_manager: PackageManager,
    provider: LocalProvider,
    db_path: &str,
) -> Result<(), String> {
    let script = r#"import { createDefaultAstropressSqliteSeedToolkit } from "astropress/sqlite-bootstrap";

const toolkit = createDefaultAstropressSqliteSeedToolkit();
const dbPath = process.env.ADMIN_DB_PATH ?? toolkit.getDefaultAdminDbPath(process.cwd());
toolkit.seedDatabase({ dbPath, workspaceRoot: process.cwd() });
console.log(`Seeded Astropress SQLite runtime at ${dbPath}`);
"#;

    let mut command = match package_manager {
        PackageManager::Bun => {
            let mut command = ProcessCommand::new("bun");
            command.args(["--eval", script]);
            command
        }
        PackageManager::Npm => {
            let mut command = ProcessCommand::new("node");
            command.args(["--input-type=module", "--eval", script]);
            command
        }
    };
    let status = command
        .current_dir(project_dir)
        .env("ASTROPRESS_LOCAL_PROVIDER", provider.as_str())
        .env("ADMIN_DB_PATH", db_path)
        .status()
        .map_err(crate::io_error)?;

    if status.success() {
        Ok(())
    } else {
        Err("Local Astropress SQLite bootstrap failed.".into())
    }
}

pub(crate) fn run_script(project_dir: &Path, script_name: &str) -> Result<ExitCode, String> {
    let package_manager = detect_package_manager(project_dir);
    install_dependencies_if_needed(project_dir, package_manager)?;

    let status = match package_manager {
        PackageManager::Bun => ProcessCommand::new("bun")
            .args(["run", script_name])
            .current_dir(project_dir)
            .status()
            .map_err(crate::io_error)?,
        PackageManager::Npm => ProcessCommand::new("npm")
            .args(["run", script_name])
            .current_dir(project_dir)
            .status()
            .map_err(crate::io_error)?,
    };

    Ok(ExitCode::from(status.code().unwrap_or(1) as u8))
}
