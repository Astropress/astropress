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

#[test]
fn parse_add_features_commerce_medusa() {
    use features::CommerceChoice;
    let args = strings(&["--commerce", "medusa"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.commerce, CommerceChoice::Medusa);
}

#[test]
fn parse_add_features_commerce_vendure() {
    use features::CommerceChoice;
    let args = strings(&["--commerce", "vendure"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.commerce, CommerceChoice::Vendure);
}

#[test]
fn parse_add_features_search_meilisearch() {
    use features::SearchChoice;
    let args = strings(&["--search", "meilisearch"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.search, SearchChoice::Meilisearch);
}

#[test]
fn parse_add_features_search_pagefind() {
    use features::SearchChoice;
    let args = strings(&["--search", "pagefind"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.search, SearchChoice::Pagefind);
}

#[test]
fn parse_add_features_forum_flarum() {
    use features::ForumChoice;
    let args = strings(&["--forum", "flarum"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.forum, ForumChoice::Flarum);
}

#[test]
fn parse_add_features_forum_discourse() {
    use features::ForumChoice;
    let args = strings(&["--forum", "discourse"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.forum, ForumChoice::Discourse);
}

#[test]
fn parse_add_features_chat_tiledesk() {
    use features::ChatChoice;
    let args = strings(&["--chat", "tiledesk"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.chat, ChatChoice::Tiledesk);
}

#[test]
fn parse_add_features_notify_ntfy() {
    use features::NotifyChoice;
    let args = strings(&["--notify", "ntfy"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.notify, NotifyChoice::Ntfy);
}

#[test]
fn parse_add_features_notify_gotify() {
    use features::NotifyChoice;
    let args = strings(&["--notify", "gotify"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.notify, NotifyChoice::Gotify);
}

#[test]
fn parse_add_features_schedule_rallly() {
    use features::ScheduleChoice;
    let args = strings(&["--schedule", "rallly"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.schedule, ScheduleChoice::Rallly);
}

#[test]
fn parse_add_features_schedule_calcom() {
    use features::ScheduleChoice;
    let args = strings(&["--schedule", "calcom"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.schedule, ScheduleChoice::CalCom);
}

#[test]
fn parse_add_features_video_peertube() {
    use features::VideoChoice;
    let args = strings(&["--video", "peertube"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.video, VideoChoice::PeerTube);
}

#[test]
fn parse_add_features_podcast_castopod() {
    use features::PodcastChoice;
    let args = strings(&["--podcast", "castopod"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.podcast, PodcastChoice::Castopod);
}

#[test]
fn parse_add_features_events_hievents() {
    use features::EventChoice;
    let args = strings(&["--events", "hievents"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.events, EventChoice::HiEvents);
}

#[test]
fn parse_add_features_events_pretix() {
    use features::EventChoice;
    let args = strings(&["--events", "pretix"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.events, EventChoice::Pretix);
}

#[test]
fn parse_add_features_sso_authentik() {
    use features::SsoChoice;
    let args = strings(&["--sso", "authentik"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.sso, SsoChoice::Authentik);
}

#[test]
fn parse_add_features_sso_zitadel() {
    use features::SsoChoice;
    let args = strings(&["--sso", "zitadel"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.sso, SsoChoice::Zitadel);
}

#[test]
fn parse_add_features_social_postiz() {
    use features::SocialChoice;
    let args = strings(&["--social", "postiz"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.social, SocialChoice::Postiz);
}

#[test]
fn parse_add_features_social_mixpost() {
    use features::SocialChoice;
    let args = strings(&["--social", "mixpost"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.social, SocialChoice::Mixpost);
}

#[test]
fn parse_add_features_cms_keystatic() {
    use features::CmsChoice;
    let args = strings(&["--cms", "keystatic"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.cms, CmsChoice::Keystatic);
}

#[test]
fn parse_add_features_cms_payload() {
    use features::CmsChoice;
    let args = strings(&["--cms", "payload"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.cms, CmsChoice::Payload);
}

#[test]
fn parse_add_features_community_giscus() {
    use features::CommunityChoice;
    let args = strings(&["--community", "giscus"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.community, CommunityChoice::Giscus);
}

#[test]
fn parse_add_features_community_remark42() {
    use features::CommunityChoice;
    let args = strings(&["--community", "remark42"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.community, CommunityChoice::Remark42);
}

#[test]
fn parse_add_features_courses_frappe_lms() {
    use features::CourseChoice;
    let args = strings(&["--courses", "frappe-lms"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.courses, CourseChoice::FrappeLms);
}

#[test]
fn parse_add_features_forms_formbricks() {
    use features::FormsChoice;
    let args = strings(&["--forms", "formbricks"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.forms, FormsChoice::Formbricks);
}

#[test]
fn parse_add_features_forms_typebot() {
    use features::FormsChoice;
    let args = strings(&["--forms", "typebot"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.forms, FormsChoice::Typebot);
}

#[test]
fn parse_add_features_transactional_email_resend() {
    use features::TransactionalEmailChoice;
    let args = strings(&["--transactional-email", "resend"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.transactional_email, TransactionalEmailChoice::Resend);
}

#[test]
fn parse_add_features_transactional_email_smtp() {
    use features::TransactionalEmailChoice;
    let args = strings(&["--transactional-email", "smtp"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.transactional_email, TransactionalEmailChoice::Smtp);
}

#[test]
fn parse_add_features_status_uptime_kuma() {
    use features::StatusChoice;
    let args = strings(&["--status", "uptime-kuma"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.status, StatusChoice::UptimeKuma);
}

#[test]
fn parse_add_features_knowledge_base_bookstack() {
    use features::KnowledgeBaseChoice;
    let args = strings(&["--knowledge-base", "bookstack"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.knowledge_base, KnowledgeBaseChoice::BookStack);
}

#[test]
fn parse_add_features_crm_twenty() {
    use features::CrmChoice;
    let args = strings(&["--crm", "twenty"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.crm, CrmChoice::Twenty);
}

#[test]
fn parse_add_features_docs_starlight() {
    use features::DocsChoice;
    let args = strings(&["--docs", "starlight"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.docs, DocsChoice::Starlight);
}

#[test]
fn parse_add_features_docs_vitepress() {
    use features::DocsChoice;
    let args = strings(&["--docs", "vitepress"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.docs, DocsChoice::VitePress);
}

#[test]
fn parse_add_features_docs_mdbook() {
    use features::DocsChoice;
    let args = strings(&["--docs", "mdbook"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.docs, DocsChoice::MdBook);
}

#[test]
fn parse_add_features_heatmap_posthog() {
    let args = strings(&["--heatmap", "posthog"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.heatmap, providers::HeatmapProvider::PostHog);
}

#[test]
fn parse_add_features_ab_testing_growthbook() {
    let args = strings(&["--ab-testing", "growthbook"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.ab_testing, providers::AbTestingProvider::GrowthBook);
}

#[test]
fn parse_add_features_ab_testing_unleash() {
    let args = strings(&["--ab-testing", "unleash"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.ab_testing, providers::AbTestingProvider::Unleash);
}

#[test]
fn parse_add_features_payments_hyperswitch() {
    use features::PaymentChoice;
    let args = strings(&["--payments", "hyperswitch"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.payments, PaymentChoice::HyperSwitch);
}

#[test]
fn parse_add_features_polar_donation() {
    let args = strings(&["--polar", "true"]);
    let f = parse_add_features(&args).unwrap();
    assert!(f.donations.polar);
}

#[test]
fn parse_add_features_give_lively_donation() {
    let args = strings(&["--give-lively", "1"]);
    let f = parse_add_features(&args).unwrap();
    assert!(f.donations.give_lively);
}

#[test]
fn parse_add_features_liberapay_donation() {
    let args = strings(&["--liberapay", "yes"]);
    let f = parse_add_features(&args).unwrap();
    assert!(f.donations.liberapay);
}

#[test]
fn parse_add_features_pledge_crypto_donation() {
    let args = strings(&["--pledge-crypto", "true"]);
    let f = parse_add_features(&args).unwrap();
    assert!(f.donations.pledge_crypto);
}

#[test]
fn help_aliases_all_return_help() {
    assert_eq!(parse_command(&strings(&["-h"])), Ok(Command::Help));
    assert_eq!(parse_command(&strings(&["help"])), Ok(Command::Help));
}

#[test]
fn import_unknown_subcommand_error_mentions_import_sources() {
    let err = parse_command(&strings(&["import", "unknown"])).unwrap_err();
    assert!(err.contains("import wordpress"), "error should mention import wordpress: {err}");
}

#[test]
fn sync_unknown_subcommand_error_mentions_sync_export() {
    let err = parse_command(&strings(&["sync", "unknown"])).unwrap_err();
    assert!(err.contains("sync export"), "error should mention sync export: {err}");
}

#[test]
fn db_unknown_subcommand_error_mentions_db_migrate() {
    let err = parse_command(&strings(&["db", "unknown"])).unwrap_err();
    assert!(err.contains("db migrate"), "error should mention db migrate: {err}");
}

#[test]
fn list_unknown_subcommand_error_mentions_list_tools() {
    let err = parse_command(&strings(&["list", "unknown"])).unwrap_err();
    assert!(err.contains("list tools"), "error should mention list tools: {err}");
}

#[test]
fn services_unknown_subcommand_error_mentions_services() {
    let err = parse_command(&strings(&["services", "unknown"])).unwrap_err();
    // Must match the services fallback arm, not the wildcard ("Unsupported astropress command: `services`")
    assert!(err.contains("services bootstrap"), "error should mention services bootstrap: {err}");
}

#[test]
fn config_unknown_subcommand_error_mentions_config() {
    let err = parse_command(&strings(&["config", "unknown"])).unwrap_err();
    // Must match the config fallback arm, not the wildcard ("Unsupported astropress command: `config`")
    assert!(err.contains("config migrate"), "error should mention config migrate: {err}");
}

#[test]
fn non_list_command_with_providers_arg_is_not_list_providers() {
    // If the `(command == "list" || command == "ls") && subcommand == "providers"` guard
    // were changed to `||`, arbitrary commands with "providers" as 2nd arg would match.
    let err = parse_command(&strings(&["db", "providers"])).unwrap_err();
    assert!(err.contains("db"), "should be a db error: {err}");
}

#[test]
fn wants_version_detects_double_dash_version() {
    assert!(crate::wants_version(&strings(&["--version"])));
}

#[test]
fn wants_version_detects_short_v_flag() {
    assert!(crate::wants_version(&strings(&["-V"])));
}

#[test]
fn wants_version_false_for_other_args() {
    assert!(!crate::wants_version(&strings(&["new", "foo"])));
    assert!(!crate::wants_version(&strings(&[])));
}

#[test]
fn wants_version_false_requires_exact_match() {
    // Mutation `replace == with !=` would make --version mean "NOT --version"
    assert!(!crate::wants_version(&strings(&["--version-check"])));
}

#[test]
fn strip_tui_flags_removes_plain_flag() {
    let (plain, args) = crate::strip_tui_flags(strings(&["new", "--plain", "foo"]));
    assert!(plain);
    assert_eq!(args, strings(&["new", "foo"]));
}

#[test]
fn strip_tui_flags_removes_no_tui_flag() {
    let (plain, args) = crate::strip_tui_flags(strings(&["dev", "--no-tui"]));
    assert!(plain);
    assert_eq!(args, strings(&["dev"]));
}

#[test]
fn strip_tui_flags_plain_false_when_absent() {
    let (plain, args) = crate::strip_tui_flags(strings(&["new", "foo"]));
    assert!(!plain);
    assert_eq!(args, strings(&["new", "foo"]));
}

#[test]
fn strip_tui_flags_both_flags_removed() {
    // If && were replaced with || in the filter, only one flag would be removed.
    let (_, args) = crate::strip_tui_flags(strings(&["--plain", "--no-tui", "dev"]));
    assert_eq!(args, strings(&["dev"]));
}

#[test]
fn doctor_strict_exit_code_fails_when_strict_and_warnings() {
    let code = crate::doctor_strict_exit_code(true, &["a warning".to_string()]);
    assert_eq!(code, std::process::ExitCode::from(1));
}

#[test]
fn doctor_strict_exit_code_succeeds_when_no_warnings() {
    let code = crate::doctor_strict_exit_code(true, &[]);
    assert_eq!(code, std::process::ExitCode::SUCCESS);
}

#[test]
fn doctor_strict_exit_code_succeeds_when_not_strict() {
    let code = crate::doctor_strict_exit_code(false, &["a warning".to_string()]);
    assert_eq!(code, std::process::ExitCode::SUCCESS);
}

#[test]
fn services_verify_exit_code_fails_for_missing_config() {
    let code = crate::services_verify_exit_code("missing-config");
    assert_eq!(code, std::process::ExitCode::from(1));
}

#[test]
fn services_verify_exit_code_succeeds_for_other_levels() {
    assert_eq!(crate::services_verify_exit_code("configured"), std::process::ExitCode::SUCCESS);
    assert_eq!(crate::services_verify_exit_code("partial"), std::process::ExitCode::SUCCESS);
}
