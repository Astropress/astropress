use std::path::PathBuf;

use crate::providers::{AbTestingProvider, AnalyticsProvider, AppHost, DataServices, HeatmapProvider, LocalProvider};

use super::Command;

pub(super) fn parse_new_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = PathBuf::from("astropress-site");
    let mut use_local_package = true;
    let mut provider = LocalProvider::Sqlite;
    let mut app_host = None;
    let mut data_services = None;
    let mut analytics = None;
    let mut ab_testing = None;
    let mut heatmap = None;
    let mut enable_api = false;
    let mut yes_defaults = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--use-published-package" => use_local_package = false,
            "--use-local-package" => use_local_package = true,
            "--enable-api" => enable_api = true,
            "--yes" | "--defaults" => yes_defaults = true,
            "--provider" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--provider`.".to_string())?;
                provider = LocalProvider::parse(value)?;
            }
            "--app-host" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--app-host`.".to_string())?;
                app_host = Some(AppHost::parse(value)?);
            }
            "--data-services" | "--content-services" => {
                index += 1; // ~ skip
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--content-services`.".to_string())?;
                let selected = DataServices::parse(value)?;
                provider = selected.default_local_provider();
                data_services = Some(selected);
            }
            "--analytics" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--analytics`.".to_string())?;
                analytics = Some(AnalyticsProvider::parse(value)?);
            }
            "--ab-testing" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--ab-testing`.".to_string())?;
                ab_testing = Some(AbTestingProvider::parse(value)?);
            }
            "--heatmap" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--heatmap`.".to_string())?;
                heatmap = Some(HeatmapProvider::parse(value)?);
            }
            value if value.starts_with("--") => {
                return Err(format!("Unsupported astropress new option: `{value}`."));
            }
            value => {
                project_dir = PathBuf::from(value);
            }
        }
        index += 1; // ~ skip
    }

    Ok(Command::New {
        project_dir,
        use_local_package,
        provider,
        app_host,
        data_services,
        analytics,
        ab_testing,
        heatmap,
        enable_api,
        yes_defaults,
    })
}
