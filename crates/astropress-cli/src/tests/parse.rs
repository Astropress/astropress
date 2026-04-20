//! CLI argument-parsing tests. Extracted from `mod.rs` to keep that file
//! under the 600-line arch-lint cap.

use super::*;
use commands::add::parse_add_features;

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
        parse_command(&strings(&["dev", "--provider", "supabase"])),
        Ok(Command::Dev {
            provider: Some(LocalProvider::Supabase),
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
    assert!(matches!(
        parse_command(&strings(&["add", "--analytics", "umami"])),
        Ok(Command::Add { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["migrate", "--from", "rallly", "--to", "calcom"])),
        Ok(Command::Migrate { .. })
    ));
    assert!(matches!(
        parse_command(&strings(&["migrate", "--from", "ntfy", "--to", "gotify", "--dry-run"])),
        Ok(Command::Migrate { dry_run: true, .. })
    ));
}

#[test]
fn parses_backup_field_values() {
    let cmd = parse_command(&strings(&["backup", "--project-dir", "/my/proj", "--out", "/out/dir"])).unwrap();
    if let Command::Backup { project_dir, output_dir } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/my/proj"));
        assert_eq!(output_dir, Some(std::path::PathBuf::from("/out/dir")));
    } else {
        panic!("Expected Backup command");
    }
}

#[test]
fn parses_restore_field_values() {
    let cmd = parse_command(&strings(&["restore", "--project-dir", "/proj", "--from", "/snap"])).unwrap();
    if let Command::Restore { project_dir, input_dir } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/proj"));
        assert_eq!(input_dir, std::path::PathBuf::from("/snap"));
    } else {
        panic!("Expected Restore command");
    }
}

#[test]
fn parses_sync_export_field_values() {
    let cmd = parse_command(&strings(&["sync", "export", "--project-dir", "/p", "--out", "/o"])).unwrap();
    if let Command::SyncExport { project_dir, output_dir } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/p"));
        assert_eq!(output_dir, Some(std::path::PathBuf::from("/o")));
    } else {
        panic!("Expected SyncExport command");
    }
}

#[test]
fn parses_sync_import_field_values() {
    let cmd = parse_command(&strings(&["sync", "import", "--project-dir", "/p", "--from", "/snap"])).unwrap();
    if let Command::SyncImport { project_dir, input_dir } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/p"));
        assert_eq!(input_dir, std::path::PathBuf::from("/snap"));
    } else {
        panic!("Expected SyncImport command");
    }
}

#[test]
fn parses_db_migrate_field_values() {
    let cmd = parse_command(&strings(&["db", "migrate", "--project-dir", "/db", "--migrations-dir", "/mig", "--target", "d1"])).unwrap();
    if let Command::DbMigrate { project_dir, migrations_dir, target, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/db"));
        assert_eq!(migrations_dir, Some("/mig".to_string()));
        assert_eq!(target, "d1");
    } else {
        panic!("Expected DbMigrate command");
    }
}

#[test]
fn parses_db_rollback_field_values() {
    let cmd = parse_command(&strings(&["db", "rollback", "--project-dir", "/db", "--target", "d1"])).unwrap();
    if let Command::DbRollback { project_dir, target, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/db"));
        assert_eq!(target, "d1");
    } else {
        panic!("Expected DbRollback command");
    }
}

#[test]
fn parses_services_bootstrap_field_values() {
    let cmd = parse_command(&strings(&["services", "bootstrap", "--project-dir", "/svc"])).unwrap();
    if let Command::ServicesBootstrap { project_dir } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/svc"));
    } else {
        panic!("Expected ServicesBootstrap command");
    }
}

#[test]
fn parses_services_verify_field_values() {
    let cmd = parse_command(&strings(&["services", "verify", "--project-dir", "/svc"])).unwrap();
    if let Command::ServicesVerify { project_dir } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/svc"));
    } else {
        panic!("Expected ServicesVerify command");
    }
}

#[test]
fn parses_upgrade_check_field_values() {
    let cmd = parse_command(&strings(&["upgrade", "--check", "--project-dir", "/up"])).unwrap();
    if let Command::UpgradeCheck { project_dir } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/up"));
    } else {
        panic!("Expected UpgradeCheck command");
    }
}

#[test]
fn parses_upgrade_apply_field_values() {
    let cmd = parse_command(&strings(&["upgrade", "--apply", "--project-dir", "/up"])).unwrap();
    if let Command::UpgradeApply { project_dir } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/up"));
    } else {
        panic!("Expected UpgradeApply command");
    }
}

#[test]
fn parses_config_migrate_field_values() {
    let cmd = parse_command(&strings(&["config", "migrate", "--project-dir", "/cfg"])).unwrap();
    if let Command::ConfigMigrate { project_dir, dry_run } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/cfg"));
        assert!(!dry_run);
    } else {
        panic!("Expected ConfigMigrate command");
    }
}

#[test]
fn parses_import_wordpress_field_values() {
    let cmd = parse_command(&strings(&[
        "import", "wordpress",
        "--source", "export.xml",
        "--project-dir", "/wp",
        "--artifact-dir", "/art",
        "--username", "admin",
        "--password", "secret",
        "--credentials-file", "/creds.json",
    ])).unwrap();
    if let Command::ImportWordPress { project_dir, source_path, artifact_dir, username, password, credentials_file, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/wp"));
        assert_eq!(source_path, Some(std::path::PathBuf::from("export.xml")));
        assert_eq!(artifact_dir, Some(std::path::PathBuf::from("/art")));
        assert_eq!(username, Some("admin".to_string()));
        assert_eq!(password, Some("secret".to_string()));
        assert_eq!(credentials_file, Some(std::path::PathBuf::from("/creds.json")));
    } else {
        panic!("Expected ImportWordPress command");
    }
}

#[test]
fn parses_import_wordpress_url_field_values() {
    let cmd = parse_command(&strings(&[
        "import", "wordpress",
        "--url", "https://mysite.com",
        "--project-dir", "/wp2",
        "--artifact-dir", "/art2",
    ])).unwrap();
    if let Command::ImportWordPress { project_dir, url, artifact_dir, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/wp2"));
        assert_eq!(url, Some("https://mysite.com".to_string()));
        assert_eq!(artifact_dir, Some(std::path::PathBuf::from("/art2")));
    } else {
        panic!("Expected ImportWordPress command");
    }
}

#[test]
fn parses_import_wix_field_values() {
    let cmd = parse_command(&strings(&[
        "import", "wix",
        "--source", "export.csv",
        "--project-dir", "/wix",
        "--artifact-dir", "/wixart",
        "--email", "user@example.com",
        "--password", "pass123",
        "--credentials-file", "/wix-creds.json",
    ])).unwrap();
    if let Command::ImportWix { project_dir, source_path, artifact_dir, email, password, credentials_file, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/wix"));
        assert_eq!(source_path, Some(std::path::PathBuf::from("export.csv")));
        assert_eq!(artifact_dir, Some(std::path::PathBuf::from("/wixart")));
        assert_eq!(email, Some("user@example.com".to_string()));
        assert_eq!(password, Some("pass123".to_string()));
        assert_eq!(credentials_file, Some(std::path::PathBuf::from("/wix-creds.json")));
    } else {
        panic!("Expected ImportWix command");
    }
}

#[test]
fn parses_deploy_field_values() {
    let cmd = parse_command(&strings(&["deploy", "--project-dir", "/dep", "--target", "cloudflare"])).unwrap();
    if let Command::Deploy { project_dir, target, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/dep"));
        assert_eq!(target, Some("cloudflare".to_string()));
    } else {
        panic!("Expected Deploy command");
    }
}

#[test]
fn parses_migrate_field_values() {
    let cmd = parse_command(&strings(&["migrate", "--from", "rallly", "--to", "calcom"])).unwrap();
    if let Command::Migrate { from, to, dry_run, .. } = cmd {
        assert_eq!(from, "rallly");
        assert_eq!(to, "calcom");
        assert!(!dry_run);
    } else {
        panic!("Expected Migrate command");
    }
}

#[test]
fn parses_new_command_positional_project_dir() {
    let cmd = parse_command(&strings(&["new", "my-site"])).unwrap();
    if let Command::New { project_dir, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("my-site"));
    } else {
        panic!("Expected New command");
    }
}

#[test]
fn parses_dev_command_positional_project_dir() {
    let cmd = parse_command(&strings(&["dev", "/my/proj"])).unwrap();
    if let Command::Dev { project_dir, .. } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/my/proj"));
    } else {
        panic!("Expected Dev command");
    }
}

#[test]
fn parses_add_command_positional_project_dir() {
    let cmd = parse_command(&strings(&["add", "/my/proj", "--analytics", "umami"])).unwrap();
    if let Command::Add { project_dir, feature_args } = cmd {
        assert_eq!(project_dir, std::path::PathBuf::from("/my/proj"));
        assert_eq!(feature_args, vec!["--analytics".to_string(), "umami".to_string()]);
    } else {
        panic!("Expected Add command");
    }
}

#[test]
fn parses_list_tools_command() {
    let cmd = parse_command(&strings(&["list", "tools"])).unwrap();
    assert_eq!(cmd, Command::ListTools);
}

#[test]
fn parses_ls_tools_alias() {
    let cmd = parse_command(&strings(&["ls", "tools"])).unwrap();
    assert_eq!(cmd, Command::ListTools);
}

#[test]
fn parses_list_providers_command() {
    let cmd = parse_command(&strings(&["list", "providers"])).unwrap();
    assert_eq!(cmd, Command::ListProviders);
}

#[test]
fn parses_ls_providers_alias() {
    let cmd = parse_command(&strings(&["ls", "providers"])).unwrap();
    assert_eq!(cmd, Command::ListProviders);
}

#[test]
fn parses_telemetry_status() {
    let cmd = parse_command(&strings(&["telemetry", "status"])).unwrap();
    assert!(matches!(cmd, Command::Telemetry { action: telemetry::TelemetryAction::Status }));
}

#[test]
fn parse_add_features_analytics_umami() {
    let args = strings(&["--analytics", "umami"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.analytics, providers::AnalyticsProvider::Umami);
}

#[test]
fn parse_add_features_analytics_plausible() {
    let args = strings(&["--analytics", "plausible"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.analytics, providers::AnalyticsProvider::Plausible);
}

#[test]
fn parse_add_features_email_listmonk() {
    use features::EmailChoice;
    let args = strings(&["--email", "listmonk"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.email, EmailChoice::Listmonk);
}
