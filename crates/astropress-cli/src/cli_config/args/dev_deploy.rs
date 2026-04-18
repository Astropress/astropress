use std::env;
use std::path::PathBuf;

use crate::providers::{AppHost, DataServices, LocalProvider};

use super::Command;

pub(super) fn parse_dev_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut provider = None;
    let mut app_host = None;
    let mut data_services = None;
    let mut index = 0;
    let mut positional_project_dir = None;

    while index < args.len() {
        match args[index].as_str() {
            "--provider" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--provider`.".to_string())?;
                provider = Some(LocalProvider::parse(value)?);
            }
            "--app-host" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--app-host`.".to_string())?;
                app_host = Some(AppHost::parse(value)?);
            }
            "--data-services" | "--content-services" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--content-services`.".to_string())?;
                let selected = DataServices::parse(value)?;
                provider = Some(selected.default_local_provider());
                data_services = Some(selected);
            }
            value if value.starts_with("--") => {
                return Err(format!("Unsupported astropress dev option: `{value}`."));
            }
            value => {
                if positional_project_dir.is_some() {
                    return Err("Usage: `astropress dev [project-dir] [--provider sqlite|supabase] [--app-host <host>] [--content-services <services>]`.".into());
                }
                positional_project_dir = Some(PathBuf::from(value));
            }
        }
        index += 1; // ~ skip
    }

    Ok(Command::Dev {
        project_dir: positional_project_dir.unwrap_or_else(|| std::mem::take(&mut project_dir)),
        provider,
        app_host,
        data_services,
    })
}

pub(super) fn parse_deploy_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut target = None;
    let mut app_host = None;
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
            "--target" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--target`.".to_string())?;
                target = Some(value.clone());
            }
            "--app-host" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--app-host`.".to_string())?;
                let selected = AppHost::parse(value)?;
                target = Some(selected.deploy_target().to_string());
                app_host = Some(selected);
            }
            other => return Err(format!("Unsupported astropress deploy option: `{other}`.")),
        }
        index += 1; // ~ skip
    }

    Ok(Command::Deploy {
        project_dir,
        target,
        app_host,
    })
}
