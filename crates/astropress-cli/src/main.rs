#![deny(warnings)]

use std::process::ExitCode;

mod cli_config;
mod commands;
mod features;
mod js_bridge;
mod providers;
mod scaffold;
mod telemetry;
mod tui;
mod utils;

// Re-export utilities at the crate root so all existing `crate::*` call sites
// throughout submodules continue to compile without modification.
pub(crate) use utils::{
    default_admin_db_relative_path, ensure_local_provider_defaults, find_astropress_src,
    io_error, repo_root, sanitize_package_name, write_text_file,
};
pub(crate) use scaffold::write_embedded_template;

use cli_config::args::{parse_command, print_help, Command};
use commands::backup_restore::{export_project_snapshot, import_project_snapshot};
use commands::config::migrate_project_config;
use commands::db::run_db_migrations;
use commands::deploy::deploy_project;
use commands::dev::run_dev_server;
use commands::doctor::{inspect_project_health, print_doctor_report, print_doctor_report_json};
use commands::import_wordpress::stage_wordpress_import;
use commands::import_wix::stage_wix_import;
use commands::new::{scaffold_new_project, run_post_scaffold_setup};
use commands::services::{bootstrap_content_services, print_content_services_report, verify_content_services};

fn main() -> ExitCode {
    let raw_args = std::env::args().skip(1).collect::<Vec<_>>();

    // Strip global --plain / --no-tui before subcommand parsing.
    let plain = raw_args.iter().any(|a| a == "--plain" || a == "--no-tui");
    tui::set_plain(plain);
    let args: Vec<String> = raw_args
        .into_iter()
        .filter(|a| a != "--plain" && a != "--no-tui")
        .collect();

    match parse_command(&args) {
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
        }) => match scaffold_new_project(&project_dir, use_local_package, provider, app_host, data_services, analytics, ab_testing, heatmap, enable_api)
            .and_then(|()| run_post_scaffold_setup(&project_dir))
        {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => fail(error),
        },
        Ok(Command::Dev {
            project_dir,
            provider,
            app_host,
            data_services,
        }) => match run_dev_server(&project_dir, provider, app_host, data_services) {
            Ok(code) => code,
            Err(error) => fail(error),
        },
        Ok(Command::ImportWordPress {
            project_dir,
            source_path,
            url,
            credentials_file,
            username,
            password,
            artifact_dir,
            download_media,
            apply_local,
            resume,
            crawl_mode,
        }) => match stage_wordpress_import(
            &project_dir,
            source_path.as_deref(),
            url.as_deref(),
            credentials_file.as_deref(),
            username.as_deref(),
            password.as_deref(),
            artifact_dir.as_deref(),
            download_media,
            apply_local,
            resume,
            crawl_mode,
        ) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => fail(error),
        },
        Ok(Command::ImportWix {
            project_dir,
            source_path,
            url,
            credentials_file,
            email,
            password,
            artifact_dir,
            download_media,
            apply_local,
            resume,
            crawl_mode,
        }) => match stage_wix_import(
            &project_dir,
            source_path.as_deref(),
            url.as_deref(),
            credentials_file.as_deref(),
            email.as_deref(),
            password.as_deref(),
            artifact_dir.as_deref(),
            download_media,
            apply_local,
            resume,
            crawl_mode,
        ) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => fail(error),
        },
        Ok(Command::Backup {
            project_dir,
            output_dir,
        }) => match export_project_snapshot(&project_dir, output_dir.as_deref()) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => fail(error),
        },
        Ok(Command::Restore {
            project_dir,
            input_dir,
        }) => match import_project_snapshot(&project_dir, &input_dir) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => fail(error),
        },
        Ok(Command::Doctor { project_dir, strict, json }) => match inspect_project_health(&project_dir) {
            Ok(report) => {
                if json {
                    print_doctor_report_json(&report);
                } else {
                    print_doctor_report(&report);
                }
                if strict && !report.warnings.is_empty() {
                    ExitCode::from(1)
                } else {
                    ExitCode::SUCCESS
                }
            }
            Err(error) => fail(error),
        },
        Ok(Command::SyncExport {
            project_dir,
            output_dir,
        }) => match export_project_snapshot(&project_dir, output_dir.as_deref()) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => fail(error),
        },
        Ok(Command::SyncImport {
            project_dir,
            input_dir,
        }) => match import_project_snapshot(&project_dir, &input_dir) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => fail(error),
        },
        Ok(Command::ServicesBootstrap { project_dir }) => {
            match bootstrap_content_services(&project_dir) {
                Ok(()) => ExitCode::SUCCESS,
                Err(error) => fail(error),
            }
        }
        Ok(Command::ServicesVerify { project_dir }) => {
            match verify_content_services(&project_dir) {
                Ok(report) => {
                    print_content_services_report(&report);
                    if report.support_level == "missing-config" {
                        ExitCode::from(1)
                    } else {
                        ExitCode::SUCCESS
                    }
                }
                Err(error) => fail(error),
            }
        }
        Ok(Command::DbMigrate { project_dir, migrations_dir, dry_run }) => {
            match run_db_migrations(&project_dir, migrations_dir.as_deref(), dry_run) {
                Ok(()) => ExitCode::SUCCESS,
                Err(error) => fail(error),
            }
        }
        Ok(Command::ConfigMigrate { project_dir, dry_run }) => {
            match migrate_project_config(&project_dir, dry_run) {
                Ok(changed) => {
                    if dry_run {
                        println!(
                            "{} config file(s) would be updated. Re-run without --dry-run to write changes.",
                            changed
                        );
                    } else {
                        println!("Updated {} config file(s).", changed);
                    }
                    ExitCode::SUCCESS
                }
                Err(error) => fail(error),
            }
        }
        Ok(Command::Deploy {
            project_dir,
            target,
            app_host,
        }) => match deploy_project(&project_dir, target.as_deref(), app_host) {
            Ok(code) => code,
            Err(error) => fail(error),
        },
        Ok(Command::Help) => {
            print_help();
            ExitCode::SUCCESS
        }
        Err(message) => {
            eprintln!("{message}");
            eprintln!();
            print_help();
            ExitCode::from(2)
        }
    }
}

fn fail(message: String) -> ExitCode {
    eprintln!("{message}");
    ExitCode::from(1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use cli_config::args::{parse_command, Command};
    use cli_config::env::{read_env_file, PackageManifest};
    use commands::backup_restore::{export_project_snapshot, import_project_snapshot};
    use commands::config::migrate_project_config;
    use commands::deploy::deploy_script_for_target;
    use commands::doctor::inspect_project_health;
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
            parse_command(&strings(&["dev", "--app-host", "netlify", "--data-services", "firebase"])),
            Ok(Command::Dev {
                app_host: Some(AppHost::Netlify),
                data_services: Some(DataServices::Firebase),
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

        let db_error = parse_command(&strings(&["db", "rollback"])).unwrap_err();
        assert!(db_error.contains("Unsupported db subcommand"));
    }

    #[test]
    fn rejects_unknown_commands() {
        let error = parse_command(&strings(&["explode"])).unwrap_err();
        assert!(error.contains("Unsupported astropress command"));
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
        scaffold_new_project(&project_dir, true, LocalProvider::Supabase, Some(AppHost::Vercel), Some(DataServices::Supabase), None, None, None, false).unwrap();

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

    #[test]
    fn doctor_reports_missing_local_runtime_warnings() {
        let root = temp_dir("doctor");
        fs::write(
            root.join(".env"),
            [
                "ASTROPRESS_RUNTIME_MODE=local",
                "ASTROPRESS_LOCAL_PROVIDER=sqlite",
                "ADMIN_DB_PATH=.data/admin.sqlite",
            ]
            .join("\n"),
        )
        .unwrap();

        let report = inspect_project_health(&root).unwrap();
        assert_eq!(report.launch_plan.runtime.mode, "local");
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("SESSION_SECRET")));
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("ADMIN_PASSWORD")));
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("EDITOR_PASSWORD")));
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("`.data` directory")));
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("ADMIN_BOOTSTRAP_DISABLED")));
    }

    #[test]
    fn doctor_flags_weak_or_scaffolded_secrets() {
        let root = temp_dir("doctor-secrets");
        fs::create_dir_all(root.join(".data")).unwrap();
        fs::write(
            root.join(".env"),
            [
                "ASTROPRESS_RUNTIME_MODE=local",
                "ASTROPRESS_LOCAL_PROVIDER=sqlite",
                "ADMIN_DB_PATH=.data/admin.sqlite",
                "SESSION_SECRET=short-secret",
                "ADMIN_PASSWORD=local-admin-demo",
                "EDITOR_PASSWORD=local-editor-demo",
                "ADMIN_BOOTSTRAP_DISABLED=0",
            ]
            .join("\n"),
        )
        .unwrap();

        let report = inspect_project_health(&root).unwrap();
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("shorter than 24 characters")));
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("scaffold-style local default")));
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("bootstrap passwords remain available")));
    }
}
