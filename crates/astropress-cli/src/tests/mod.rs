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
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::sync::Once;
use std::time::{SystemTime, UNIX_EPOCH};

mod doctor;
mod parse;
mod scaffold;

fn strings(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| value.to_string()).collect()
}

/// RAII guard for a per-test temp directory.
///
/// Creates `/tmp/astropress-cli-{label}-{nanos}` on construction and removes it on drop.
/// Implements `Deref<Target=Path>` and `AsRef<Path>` so call sites can use `&dir`,
/// `dir.join(...)`, etc. without changes.
pub(crate) struct TestDir(PathBuf);

impl TestDir {
    fn new(label: &str) -> Self {
        sweep_orphaned_test_dirs_once();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("astropress-cli-{label}-{unique}"));
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}

impl Deref for TestDir {
    type Target = Path;
    fn deref(&self) -> &Path {
        &self.0
    }
}

impl AsRef<Path> for TestDir {
    fn as_ref(&self) -> &Path {
        &self.0
    }
}

impl Drop for TestDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn temp_dir(label: &str) -> TestDir {
    TestDir::new(label)
}

/// Removes orphaned `astropress-cli-*` and `astropress-*` dirs older than 1 hour.
/// Runs once per test process to clear leftovers from prior crashed runs.
fn sweep_orphaned_test_dirs_once() {
    static SWEEP: Once = Once::new();
    SWEEP.call_once(|| {
        let Ok(entries) = fs::read_dir(std::env::temp_dir()) else {
            return;
        };
        let cutoff = SystemTime::now() - std::time::Duration::from_secs(60 * 60);
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if !name.starts_with("astropress-cli-") && !name.starts_with("astropress-") {
                continue;
            }
            let Ok(metadata) = entry.metadata() else {
                continue;
            };
            if metadata.modified().map(|m| m < cutoff).unwrap_or(false) {
                let _ = fs::remove_dir_all(entry.path());
            }
        }
    });
}

#[test]
fn init_is_alias_for_new() {
    assert!(matches!(
        parse_command(&strings(&["init", "my-site"])),
        Ok(Command::New { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&[
            "init",
            "my-site",
            "--app-host",
            "vercel",
            "--data-services",
            "supabase"
        ])),
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
        Ok(Command::New {
            yes_defaults: true,
            ..
        })
    ));
    assert!(matches!(
        parse_command(&strings(&["new", "demo", "--defaults"])),
        Ok(Command::New {
            yes_defaults: true,
            ..
        })
    ));
    // Without the flag, yes_defaults is false
    assert!(matches!(
        parse_command(&strings(&["new", "demo"])),
        Ok(Command::New {
            yes_defaults: false,
            ..
        })
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
    assert!(matches!(
        parse_command(&strings(&["completions", "powershell"])),
        Ok(Command::Completions { shell }) if shell == "powershell"
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
    manifest
        .scripts
        .insert("build".into(), "astro build".into());
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
fn deploy_script_for_railway_prefers_deploy_script() {
    let mut manifest = PackageManifest {
        name: "demo".into(),
        private: true,
        package_type: Some("module".into()),
        scripts: BTreeMap::new(),
        dependencies: BTreeMap::new(),
        dev_dependencies: BTreeMap::new(),
    };
    // With a dedicated deploy:railway script, that is preferred.
    manifest
        .scripts
        .insert("deploy:railway".into(), "railway up".into());
    assert_eq!(
        deploy_script_for_target(&manifest, Some("railway")).unwrap(),
        "deploy:railway"
    );
    // Without deploy:railway, falls back to build.
    manifest.scripts.remove("deploy:railway");
    manifest
        .scripts
        .insert("build".into(), "astro build".into());
    assert_eq!(
        deploy_script_for_target(&manifest, Some("railway")).unwrap(),
        "build"
    );
}

#[test]
fn deploy_script_rejects_unknown_target() {
    let manifest = PackageManifest {
        name: "demo".into(),
        private: true,
        package_type: Some("module".into()),
        scripts: BTreeMap::new(),
        dependencies: BTreeMap::new(),
        dev_dependencies: BTreeMap::new(),
    };
    assert!(deploy_script_for_target(&manifest, Some("heroku")).is_err());
    assert!(deploy_script_for_target(&manifest, Some("railway-app")).is_err());
}

#[test]
fn deploy_script_for_new_hosts_falls_back_to_build() {
    // Fly.io, Coolify, DigitalOcean all fall back to "build" when no
    // targeted script exists — same pattern as Railway.
    let mut manifest = PackageManifest {
        name: "demo".into(),
        private: true,
        package_type: Some("module".into()),
        scripts: BTreeMap::new(),
        dependencies: BTreeMap::new(),
        dev_dependencies: BTreeMap::new(),
    };
    manifest
        .scripts
        .insert("build".into(), "astro build".into());
    for target in &["fly-io", "coolify", "digitalocean", "railway"] {
        assert_eq!(
            deploy_script_for_target(&manifest, Some(target)).unwrap(),
            "build",
            "expected fallback to 'build' for target '{target}'"
        );
    }
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
