use super::*;
use cli_config::env::PackageManifest;
use commands::deploy::deploy_script_for_target;
use js_bridge::runner::command_available;
use std::collections::BTreeMap;

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
