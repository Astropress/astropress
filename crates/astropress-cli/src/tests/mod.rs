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
fn parses_crawl_modes() {
    assert!(matches!(
        parse_command(&strings(&["import", "wordpress", "--url", "https://mysite.com", "--crawl-pages"])),
        Ok(Command::ImportWordPress { crawl_mode: cli_config::args::CrawlMode::Fetch, .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["import", "wordpress", "--url", "https://mysite.com", "--crawl-pages=playwright"])),
        Ok(Command::ImportWordPress { crawl_mode: cli_config::args::CrawlMode::Browser, .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["import", "wix", "--url", "https://site.wixsite.com/s", "--crawl-pages=playwright"])),
        Ok(Command::ImportWix { crawl_mode: cli_config::args::CrawlMode::Browser, .. })
    ));
}

#[test]
fn strips_plain_flag_from_args() {
    // --plain is a global flag stripped before subcommand parsing.
    // parse_command should not see it; the import command should still parse correctly.
    let raw: Vec<String> = strings(&["--plain", "import", "wordpress", "--source", "export.xml"]);
    let plain = raw.iter().any(|a| a == "--plain" || a == "--no-tui");
    let filtered: Vec<String> = raw.into_iter().filter(|a| a != "--plain" && a != "--no-tui").collect();
    assert!(plain);
    assert!(matches!(
        parse_command(&filtered),
        Ok(Command::ImportWordPress { .. })
    ));
}

#[test]
fn parses_nested_commands() {
    assert!(matches!(
        parse_command(&strings(&["import", "wordpress", "--source", "export.xml"])),
        Ok(Command::ImportWordPress { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["import", "wordpress", "--source", "export.xml", "--apply-local"])),
        Ok(Command::ImportWordPress { apply_local: true, .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["backup"])),
        Ok(Command::Backup { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["restore", "--from", "snapshot"])),
        Ok(Command::Restore { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["sync", "export"])),
        Ok(Command::SyncExport { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["sync", "import", "--from", "snapshot"])),
        Ok(Command::SyncImport { .. })
    ));
}

#[test]
fn parses_top_level_commands() {
    assert!(matches!(
        parse_command(&strings(&["new", "demo"])),
        Ok(Command::New { .. })
    ));
    assert!(matches!(parse_command(&strings(&["dev"])), Ok(Command::Dev { .. })));
    assert!(matches!(
        parse_command(&strings(&["doctor"])),
        Ok(Command::Doctor { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["doctor", "--strict"])),
        Ok(Command::Doctor { strict: true, .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["doctor", "--json"])),
        Ok(Command::Doctor { json: true, .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["new", "demo", "--provider", "supabase"])),
        Ok(Command::New {
            provider: LocalProvider::Supabase,
            ..
        })
    ));
    assert!(matches!(
        parse_command(&strings(&["new", "demo", "--app-host", "vercel", "--data-services", "supabase"])),
        Ok(Command::New {
            app_host: Some(AppHost::Vercel),
            data_services: Some(DataServices::Supabase),
            ..
        })
    ));
    assert!(matches!(
        parse_command(&strings(&["dev", "--provider", "runway"])),
        Ok(Command::Dev {
            provider: Some(LocalProvider::Runway),
            ..
        })
    ));
    assert!(matches!(
        parse_command(&strings(&["dev", "--app-host", "netlify", "--data-services", "appwrite"])),
        Ok(Command::Dev {
            app_host: Some(AppHost::Netlify),
            data_services: Some(DataServices::Appwrite),
            ..
        })
    ));
    assert!(matches!(
        parse_command(&strings(&["deploy", "--target", "cloudflare"])),
        Ok(Command::Deploy { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["deploy", "--app-host", "gitlab-pages"])),
        Ok(Command::Deploy {
            app_host: Some(AppHost::GitlabPages),
            ..
        })
    ));
    assert!(matches!(
        parse_command(&strings(&["config", "migrate", "--dry-run"])),
        Ok(Command::ConfigMigrate { dry_run: true, .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["services", "bootstrap"])),
        Ok(Command::ServicesBootstrap { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["services", "verify"])),
        Ok(Command::ServicesVerify { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["db", "migrate"])),
        Ok(Command::DbMigrate { dry_run: false, .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["db", "migrate", "--dry-run"])),
        Ok(Command::DbMigrate { dry_run: true, .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["db", "rollback"])),
        Ok(Command::DbRollback { dry_run: false, .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["db", "rollback", "--dry-run"])),
        Ok(Command::DbRollback { dry_run: true, .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["upgrade"])),
        Ok(Command::UpgradeCheck { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["upgrade", "--check"])),
        Ok(Command::UpgradeCheck { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["upgrade", "--apply"])),
        Ok(Command::UpgradeApply { .. })
    ));
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
fn scaffolds_new_project_from_example() {
    let root = temp_dir("new");
    let project_dir = root.join("demo");
    // Pass explicit app_host to skip the interactive hosting prompt
    scaffold_new_project(&project_dir, true, LocalProvider::Supabase, Some(AppHost::Vercel), Some(DataServices::Supabase), crate::commands::new::ScaffoldOptions { analytics_flag: None, ab_testing_flag: None, heatmap_flag: None, enable_api_flag: false, yes_defaults_flag: false }).unwrap();

    let package_json = fs::read_to_string(project_dir.join("package.json")).unwrap();
    assert!(package_json.contains("\"name\": \"demo\""));
    assert!(package_json.contains("\"astropress\": \"file:"));
    let env_contents = fs::read_to_string(project_dir.join(".env")).unwrap();
    assert!(env_contents.contains("ASTROPRESS_CONTENT_SERVICES=supabase"));
    assert!(!env_contents.contains("ASTROPRESS_LOCAL_PROVIDER="));
    assert!(!env_contents.contains("ASTROPRESS_DEPLOY_TARGET="));
    assert!(env_contents.contains(&format!(
        "ADMIN_DB_PATH={}",
        default_admin_db_relative_path(LocalProvider::Supabase)
    )));
    // Passwords are now passphrases: word+char-word+char-word+char-word+char
    assert!(env_contents.contains("ADMIN_PASSWORD="));
    assert!(env_contents.contains("EDITOR_PASSWORD="));
    assert!(env_contents.contains("ADMIN_BOOTSTRAP_DISABLED=0"));
    let admin_pw = env_contents.lines()
        .find(|l| l.starts_with("ADMIN_PASSWORD="))
        .and_then(|l| l.strip_prefix("ADMIN_PASSWORD="))
        .unwrap_or("");
    // passphrase has exactly 3 hyphens separating 4 word+char segments
    assert_eq!(admin_pw.chars().filter(|&c| c == '-').count(), 3, "ADMIN_PASSWORD should have 3 hyphens: {admin_pw}");
    assert!(env_contents.contains("SESSION_SECRET="));
    let env_example = fs::read_to_string(project_dir.join(".env.example")).unwrap();
    assert!(env_example.contains("SUPABASE_URL=https://your-project.supabase.co"));
    assert!(env_example.contains(
        "ASTROPRESS_SERVICE_ORIGIN=https://your-project.supabase.co/functions/v1/astropress"
    ));
    assert!(!env_example.contains("ASTROPRESS_HOSTED_PROVIDER="));
    assert!(env_example.contains("SUPABASE_ANON_KEY=replace-me"));
    assert!(env_example.contains("SUPABASE_SERVICE_ROLE_KEY=replace-me"));
    assert!(env_example.contains(
        "ADMIN_PASSWORD=replace-with-a-generated-local-admin-password"
    ));
    assert!(env_example.contains(
        "SESSION_SECRET=replace-with-a-long-random-session-secret"
    ));
    assert!(project_dir.join(".data/.gitkeep").exists());
    assert!(project_dir.join("src/pages/index.astro").exists());
    assert!(project_dir.join("DEPLOY.md").exists());
    assert!(project_dir.join(".github/workflows/deploy-astropress.yml").exists());
    assert!(package_json.contains("\"doctor:strict\": \"astropress doctor --strict\""));
    assert!(package_json.contains("\"deploy:vercel\":"));
}

#[test]
fn preserves_existing_data_dir_when_setting_sqlite_defaults() {
    let root = temp_dir("env");
    fs::write(root.join(".data-existing"), "").unwrap();

    ensure_local_provider_defaults(&root).unwrap();

    assert!(root.join(".data/.gitkeep").exists());
}

#[test]
fn reads_provider_and_db_path_from_env() {
    let root = temp_dir("env-config");
    fs::write(
        root.join(".env"),
        "ASTROPRESS_LOCAL_PROVIDER=runway\nADMIN_DB_PATH=.data/custom-runway.sqlite\n",
    )
    .unwrap();

    let env_values = read_env_file(&root).unwrap();
    assert_eq!(
        env_values.get("ASTROPRESS_LOCAL_PROVIDER"),
        Some(&"runway".to_string())
    );
    let project_env = load_project_env_contract(&root).unwrap();
    assert_eq!(project_env.local_provider, "runway");
    assert_eq!(project_env.deploy_target, "runway");
    assert_eq!(project_env.hosted_provider, "runway");
    assert_eq!(project_env.app_host, "runway");
    assert_eq!(project_env.data_services, "runway");
    assert_eq!(project_env.content_services, "runway");
    assert_eq!(project_env.admin_db_path, ".data/custom-runway.sqlite");
    assert_eq!(
        resolve_local_provider(&root, None).unwrap(),
        LocalProvider::Runway
    );
    assert_eq!(
        resolve_admin_db_path(&root, LocalProvider::Runway).unwrap(),
        ".data/custom-runway.sqlite"
    );
}

#[test]
fn migrates_legacy_env_keys() {
    let root = temp_dir("config-migrate");
    fs::write(
        root.join(".env"),
        "ASTROPRESS_DATA_SERVICES=supabase\nSUPABASE_URL=https://demo.supabase.co\nASTROPRESS_DEPLOY_TARGET=cloudflare\nASTROPRESS_HOSTED_PROVIDER=supabase\n",
    )
    .unwrap();

    let changed = migrate_project_config(&root, false).unwrap();
    assert_eq!(changed, 1);

    let env_values = read_env_file(&root).unwrap();
    assert_eq!(
        env_values.get("ASTROPRESS_CONTENT_SERVICES"),
        Some(&"supabase".to_string())
    );
    assert!(!env_values.contains_key("ASTROPRESS_DATA_SERVICES"));
    assert!(!env_values.contains_key("ASTROPRESS_HOSTED_PROVIDER"));
    assert!(!env_values.contains_key("ASTROPRESS_DEPLOY_TARGET"));
    assert_eq!(
        env_values.get("ASTROPRESS_APP_HOST"),
        Some(&"cloudflare-pages".to_string())
    );
    assert_eq!(
        env_values.get("ASTROPRESS_SERVICE_ORIGIN"),
        Some(&"https://demo.supabase.co/functions/v1/astropress".to_string())
    );
}

#[test]
fn bootstraps_and_verifies_content_services() {
    let root = temp_dir("services");
    fs::write(
        root.join(".env"),
        "ASTROPRESS_CONTENT_SERVICES=supabase\nSUPABASE_URL=https://demo.supabase.co\nSUPABASE_ANON_KEY=anon\nSUPABASE_SERVICE_ROLE_KEY=service\nASTROPRESS_SERVICE_ORIGIN=https://demo.supabase.co/functions/v1/astropress\n",
    )
    .unwrap();

    bootstrap_content_services(&root).unwrap();
    let report = verify_content_services(&root).unwrap();
    assert_eq!(report.support_level, "configured");
    assert!(root.join(".astropress/services/supabase.json").exists());
}

#[test]
fn project_runtime_plan_exposes_local_runtime_selection() {
    let root = temp_dir("project-runtime");
    fs::write(
        root.join(".env"),
        "ASTROPRESS_RUNTIME_MODE=local\nASTROPRESS_LOCAL_PROVIDER=supabase\nADMIN_DB_PATH=.data/local-supabase.sqlite\n",
    )
    .unwrap();

    let plan = load_project_runtime_plan(&root, None, None, None).unwrap();
    assert_eq!(plan.mode, "local");
    assert_eq!(plan.env.local_provider, "supabase");
    assert_eq!(plan.env.admin_db_path, ".data/local-supabase.sqlite");
    assert_eq!(plan.adapter.capabilities.name, "supabase");
}

#[test]
fn explicit_provider_overrides_env_provider() {
    let root = temp_dir("env-provider-override");
    fs::write(root.join(".env"), "ASTROPRESS_LOCAL_PROVIDER=runway\n").unwrap();

    assert_eq!(
        resolve_local_provider(&root, Some(LocalProvider::Supabase)).unwrap(),
        LocalProvider::Supabase
    );
}

#[test]
fn deploy_target_defaults_follow_local_provider() {
    let root = temp_dir("deploy-target");
    fs::write(root.join(".env"), "ASTROPRESS_LOCAL_PROVIDER=supabase\n").unwrap();

    assert_eq!(resolve_deploy_target(&root, None).unwrap(), "vercel");
    assert_eq!(
        resolve_deploy_target(&root, Some("cloudflare")).unwrap(),
        "cloudflare"
    );
}

#[test]
fn deploy_target_prefers_explicit_env_target() {
    let root = temp_dir("deploy-target-env");
    fs::write(
        root.join(".env"),
        "ASTROPRESS_LOCAL_PROVIDER=sqlite\nASTROPRESS_DEPLOY_TARGET=runway\n",
    )
    .unwrap();

    assert_eq!(resolve_deploy_target(&root, None).unwrap(), "runway");
}

#[test]
fn stages_wordpress_imports() {
    let root = temp_dir("import");
    let project_dir = root.join("project");
    fs::create_dir_all(&project_dir).unwrap();
    let source = root.join("export.xml");
    fs::write(&source, "<rss></rss>").unwrap();

    stage_wordpress_import(&project_dir, Some(&source), None, None, None, None, None, true, false, false, cli_config::args::CrawlMode::None).unwrap();
    assert!(project_dir.join(".astropress/import/wordpress-source.xml").exists());
    let manifest = fs::read_to_string(project_dir.join(".astropress/import/manifest.json")).unwrap();
    assert!(manifest.contains("\"inventory_file\": \"wordpress.inventory.json\""));
    assert!(manifest.contains("\"report_file\": \"wordpress.report.json\""));
    assert!(manifest.contains("\"content_file\":"));
    let report = fs::read_to_string(project_dir.join(".astropress/import/wordpress.report.json")).unwrap();
    assert!(report.contains("\"status\":"));
    assert!(report.contains("\"imported_records\": 0"));
    assert!(report.contains("\"downloaded_media\": 0"));
}

#[test]
fn exports_and_imports_project_snapshots() {
    let root = temp_dir("sync");
    let project_dir = root.join("project");
    fs::create_dir_all(project_dir.join("src")).unwrap();
    fs::write(project_dir.join("package.json"), "{\"name\":\"demo\",\"scripts\":{}}").unwrap();
    fs::write(project_dir.join("src/index.txt"), "hello").unwrap();

    let snapshot_dir = root.join("snapshot");
    export_project_snapshot(&project_dir, Some(&snapshot_dir)).unwrap();
    assert!(snapshot_dir.join("package.json").exists());
    assert!(snapshot_dir.join("src/index.txt").exists());

    fs::write(snapshot_dir.join("src/index.txt"), "updated").unwrap();
    import_project_snapshot(&project_dir, &snapshot_dir).unwrap();
    assert_eq!(
        fs::read_to_string(project_dir.join("src/index.txt")).unwrap(),
        "updated"
    );
}

#[test]
fn command_availability_check_is_safe() {
    let _ = command_available("definitely-not-a-real-command-binary");
}
