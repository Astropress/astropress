//! CLI argument-parsing tests. Extracted from `mod.rs` to keep that file
//! under the 600-line arch-lint cap.

use super::*;

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
