#![deny(warnings)]

use std::process::ExitCode;

mod cli_config;
mod commands;
mod docs_stubs;
mod feature_stubs;
mod features;
mod js_bridge;
mod providers;
mod scaffold;
mod service_docs;
mod stack_summary;
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
use commands::completions::print_completions;
use commands::backup_restore::{export_project_snapshot, import_project_snapshot};
use commands::config::migrate_project_config;
use commands::db::{run_db_migrations, rollback_db_migration};
use commands::deploy::deploy_project;
use commands::dev::run_dev_server;
use commands::doctor::{inspect_project_health, print_doctor_report, print_doctor_report_json};
use commands::import_wordpress::stage_wordpress_import;
use commands::import_wix::stage_wix_import;
use commands::add::{add_integrations, parse_add_features};
use commands::list::{list_providers, list_tools};
use commands::migrate::{run_migrate, MigrateOptions};
use commands::new::{scaffold_new_project, run_post_scaffold_setup};
use telemetry::run_telemetry_command;
use commands::auth::run_emergency_revoke;
use commands::services::{bootstrap_content_services, print_content_services_report, verify_content_services};
use commands::upgrade::{apply_upgrade, check_upgrade_compatibility, print_upgrade_check_report};

fn doctor_strict_exit_code(strict: bool, warnings: &[String]) -> ExitCode {
    if strict && !warnings.is_empty() { ExitCode::from(1) } else { ExitCode::SUCCESS }
}

fn services_verify_exit_code(support_level: &str) -> ExitCode {
    if support_level == "missing-config" { ExitCode::from(1) } else { ExitCode::SUCCESS }
}

fn wants_version(raw_args: &[String]) -> bool {
    raw_args.iter().any(|a| a == "--version" || a == "-V")
}

fn strip_tui_flags(raw_args: Vec<String>) -> (bool, Vec<String>) {
    let plain = raw_args.iter().any(|a| a == "--plain" || a == "--no-tui");
    let args = raw_args.into_iter().filter(|a| a != "--plain" && a != "--no-tui").collect();
    (plain, args)
}

fn main() -> ExitCode {
    let raw_args = std::env::args().skip(1).collect::<Vec<_>>();

    // Handle --version / -V before any other parsing.
    if wants_version(&raw_args) {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return ExitCode::SUCCESS;
    }

    // Strip global --plain / --no-tui before subcommand parsing.
    let (plain, args) = strip_tui_flags(raw_args);
    tui::set_plain(plain);

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
            yes_defaults,
        }) => match scaffold_new_project(&project_dir, use_local_package, provider, app_host, data_services, commands::new::ScaffoldOptions { analytics_flag: analytics, ab_testing_flag: ab_testing, heatmap_flag: heatmap, enable_api_flag: enable_api, yes_defaults_flag: yes_defaults })
            .and_then(|features| run_post_scaffold_setup(&project_dir, &features, app_host, data_services))
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
                doctor_strict_exit_code(strict, &report.warnings)
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
                    services_verify_exit_code(&report.support_level)
                }
                Err(error) => fail(error),
            }
        }
        Ok(Command::DbMigrate { project_dir, migrations_dir, dry_run, target }) => {
            match run_db_migrations(&project_dir, migrations_dir.as_deref(), dry_run, &target) {
                Ok(()) => ExitCode::SUCCESS,
                Err(error) => fail(error),
            }
        }
        Ok(Command::DbRollback { project_dir, dry_run, target }) => {
            match rollback_db_migration(&project_dir, dry_run, &target) {
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
        Ok(Command::UpgradeCheck { project_dir }) => {
            match check_upgrade_compatibility(&project_dir) {
                Ok(report) => {
                    print_upgrade_check_report(&report, &project_dir);
                    ExitCode::SUCCESS
                }
                Err(error) => fail(error),
            }
        }
        Ok(Command::UpgradeApply { project_dir }) => match apply_upgrade(&project_dir) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => fail(error),
        },
        Ok(Command::Deploy {
            project_dir,
            target,
            app_host,
        }) => match deploy_project(&project_dir, target.as_deref(), app_host) {
            Ok(code) => code,
            Err(error) => fail(error),
        },
        Ok(Command::Completions { shell }) => match print_completions(&shell) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => fail(error),
        },
        Ok(Command::Add { project_dir, feature_args }) => {
            match parse_add_features(&feature_args)
                .and_then(|features| add_integrations(&project_dir, features))
            {
                Ok(()) => ExitCode::SUCCESS,
                Err(error) => fail(error),
            }
        }
        Ok(Command::Migrate { project_dir, from, to, dry_run }) => {
            match run_migrate(&MigrateOptions { project_dir, from, to, dry_run }) {
                Ok(()) => ExitCode::SUCCESS,
                Err(error) => fail(error),
            }
        }
        Ok(Command::AuthEmergencyRevoke { project_dir, scope, user_email }) => {
            match run_emergency_revoke(&project_dir, scope, user_email.as_deref()) {
                Ok(()) => ExitCode::SUCCESS,
                Err(error) => fail(error),
            }
        }
        Ok(Command::Telemetry { action }) => {
            run_telemetry_command(action);
            ExitCode::SUCCESS
        }
        Ok(Command::ListTools) => {
            list_tools();
            ExitCode::SUCCESS
        }
        Ok(Command::ListProviders) => {
            list_providers();
            ExitCode::SUCCESS
        }
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

fn fail(message: String) -> ExitCode { // ~ skip
    eprintln!("{message}");
    ExitCode::from(1)
}

#[cfg(test)]
mod tests;
