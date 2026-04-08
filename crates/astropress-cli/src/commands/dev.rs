use std::path::Path;
use std::process::{Command as ProcessCommand, ExitCode};

use crate::providers::{AppHost, DataServices, LocalProvider};
use crate::js_bridge::loaders::load_project_launch_plan;
use crate::js_bridge::runner::{
    detect_package_manager, install_dependencies_if_needed, seed_local_sqlite_database,
};

pub(crate) fn run_dev_server(
    project_dir: &Path,
    provider: Option<LocalProvider>,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
) -> Result<ExitCode, String> {
    let package_manager = detect_package_manager(project_dir);
    let launch_plan = load_project_launch_plan(project_dir, provider, app_host, data_services)?;
    let runtime_plan = launch_plan.runtime;
    if runtime_plan.mode != "local" {
        return Err(format!(
            "Astropress dev currently supports only local runtime mode, but this project resolved to `{}` with adapter `{}`.",
            runtime_plan.mode, runtime_plan.adapter.capabilities.name
        ));
    }
    let provider = LocalProvider::parse(&launch_plan.provider)?;
    let admin_db_path = launch_plan.admin_db_path;
    install_dependencies_if_needed(project_dir, package_manager)?;
    crate::ensure_local_provider_defaults(project_dir)?;
    if launch_plan.requires_local_seed {
        seed_local_sqlite_database(project_dir, package_manager, provider, &admin_db_path)?;
    }

    let mut command = match package_manager {
        crate::providers::PackageManager::Bun => {
            let mut command = ProcessCommand::new("bun");
            command.args(["run", "dev"]);
            command
        }
        crate::providers::PackageManager::Npm => {
            let mut command = ProcessCommand::new("npm");
            command.args(["run", "dev"]);
            command
        }
    };
    let status = command
        .current_dir(project_dir)
        .env("ASTROPRESS_LOCAL_PROVIDER", provider.as_str())
        .envs(
            app_host
                .map(|host| [("ASTROPRESS_APP_HOST", host.as_str())])
                .into_iter()
                .flatten(),
        )
        .envs(
            data_services
                .map(|services| {
                    [
                        ("ASTROPRESS_CONTENT_SERVICES", services.as_str()),
                        ("ASTROPRESS_DATA_SERVICES", services.as_str()),
                    ]
                })
                .into_iter()
                .flatten(),
        )
        .env("ADMIN_DB_PATH", &admin_db_path)
        .status()
        .map_err(crate::io_error)?;

    Ok(ExitCode::from(status.code().unwrap_or(1) as u8))
}
