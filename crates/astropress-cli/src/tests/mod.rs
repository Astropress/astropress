use super::*;
use cli_config::args::{parse_command, Command};
use cli_config::env::{read_env_file, PackageManifest};
use commands::backup_restore::{export_project_snapshot, import_project_snapshot};
use commands::config::migrate_project_config;
use commands::deploy::deploy_script_for_target;
use commands::new::scaffold_new_project;
use commands::services::{bootstrap_content_services, verify_content_services};
use js_bridge::loaders::{
    load_project_env_contract, load_project_runtime_plan, resolve_admin_db_path,
    resolve_deploy_target, resolve_local_provider,
};
use js_bridge::runner::command_available;
use providers::{AppHost, DataServices, LocalProvider};

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

mod doctor;
mod parse;
mod scaffold;

fn strings(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| value.to_string()).collect()
}

fn temp_dir(label: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let path = std::env::temp_dir().join(format!("astropress-cli-{label}-{unique}"));
    fs::create_dir_all(&path).unwrap();
    path
}

#[test]
fn init_is_alias_for_new() {
    assert!(matches!(
        parse_command(&strings(&["init", "my-site"])),
        Ok(Command::New { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["init", "my-site", "--app-host", "vercel", "--data-services", "supabase"])),
        Ok(Command::New {
            app_host: Some(AppHost::Vercel),
            data_services: Some(DataServices::Supabase),
            ..
        })
    ));
}

#[test]
fn falls_back_to_help() {
    assert_eq!(parse_command(&strings(&[])), Ok(Command::Help));
    assert_eq!(parse_command(&strings(&["--help"])), Ok(Command::Help));
}

#[test]
fn rejects_unknown_subcommands() {
    let import_error = parse_command(&strings(&["import", "ghost"])).unwrap_err();
    assert!(import_error.contains("Unsupported import source"));

    let sync_error = parse_command(&strings(&["sync", "push"])).unwrap_err();
    assert!(sync_error.contains("Unsupported sync subcommand"));

    let db_error = parse_command(&strings(&["db", "unknown"])).unwrap_err();
    assert!(db_error.contains("Unsupported db subcommand"));
}

#[test]
fn rejects_unknown_commands() {
    let error = parse_command(&strings(&["explode"])).unwrap_err();
    assert!(error.contains("Unsupported astropress command"));
}

#[test]
fn version_flag_recognized() {
    // --version and -V are consumed before parse_command (in main), so we
    // verify only that the arg strings themselves are distinguishable from
    // subcommands (parse_command treats them as unknown commands, not panics).
    let err = parse_command(&strings(&["--version"]));
    // Acceptable: either recognized as Help or rejected as unknown flag.
    assert!(err.is_err() || matches!(err, Ok(Command::Help)));
}

#[test]
fn new_yes_flag_recognized() {
    assert!(matches!(
        parse_command(&strings(&["new", "demo", "--yes"])),
        Ok(Command::New { yes_defaults: true, .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["new", "demo", "--defaults"])),
        Ok(Command::New { yes_defaults: true, .. })
    ));
    // Without the flag, yes_defaults is false
    assert!(matches!(
        parse_command(&strings(&["new", "demo"])),
        Ok(Command::New { yes_defaults: false, .. })
    ));
}

#[test]
fn completions_command_recognized() {
    assert!(matches!(
        parse_command(&strings(&["completions", "bash"])),
        Ok(Command::Completions { shell }) if shell == "bash"
    ));
    assert!(matches!(
        parse_command(&strings(&["completions", "zsh"])),
        Ok(Command::Completions { shell }) if shell == "zsh"
    ));
    assert!(matches!(
        parse_command(&strings(&["completions", "fish"])),
        Ok(Command::Completions { shell }) if shell == "fish"
    ));
    // Missing shell argument → error
    assert!(parse_command(&strings(&["completions"])).is_err());
}

#[test]
fn sanitizes_package_names() {
    assert_eq!(sanitize_package_name("My Cool Site"), "my-cool-site");
}

#[test]
fn deploy_script_selection_prefers_targeted_scripts() {
    let mut manifest = PackageManifest {
        name: "demo".into(),
        private: true,
        package_type: Some("module".into()),
        scripts: BTreeMap::new(),
        dependencies: BTreeMap::new(),
        dev_dependencies: BTreeMap::new(),
    };
    manifest.scripts.insert("build".into(), "astro build".into());
    manifest
        .scripts
        .insert("build:cloudflare-production".into(), "astro build".into());
    assert_eq!(
        deploy_script_for_target(&manifest, Some("cloudflare")).unwrap(),
        "build:cloudflare-production"
    );
    assert_eq!(
        deploy_script_for_target(&manifest, Some("github-pages")).unwrap(),
        "build"
    );
}

#[test]
fn command_availability_check_is_safe() {
    let _ = command_available("definitely-not-a-real-command-binary");
}

#[test]
fn list_tools_command_parses() {
    assert!(matches!(
        parse_command(&strings(&["list", "tools"])),
        Ok(Command::ListTools)
    ));
}

#[test]
fn list_without_subcommand_returns_error() {
    let err = parse_command(&strings(&["list"])).unwrap_err();
    assert!(
        err.contains("list tools"),
        "expected 'list tools' in error message, got: {err}"
    );
}

#[test]
fn list_tools_with_unknown_flag_returns_error() {
    let err = parse_command(&strings(&["list", "tools", "--unknown"])).unwrap_err();
    assert!(
        err.contains("--unknown"),
        "expected unknown flag name in error, got: {err}"
    );
}

#[test]
fn ls_tools_alias_parses() {
    assert!(matches!(
        parse_command(&strings(&["ls", "tools"])),
        Ok(Command::ListTools)
    ));
}

#[test]
fn ls_without_subcommand_returns_error() {
    let err = parse_command(&strings(&["ls"])).unwrap_err();
    assert!(
        err.contains("list tools"),
        "expected 'list tools' in error message, got: {err}"
    );
}

#[test]
fn list_providers_command_parses() {
    assert!(matches!(
        parse_command(&strings(&["list", "providers"])),
        Ok(Command::ListProviders)
    ));
}

#[test]
fn ls_providers_alias_parses() {
    assert!(matches!(
        parse_command(&strings(&["ls", "providers"])),
        Ok(Command::ListProviders)
    ));
}

#[test]
fn list_providers_with_unknown_flag_returns_error() {
    let err = parse_command(&strings(&["list", "providers", "--unknown"])).unwrap_err();
    assert!(
        err.contains("--unknown"),
        "expected unknown flag name in error, got: {err}"
    );
}
