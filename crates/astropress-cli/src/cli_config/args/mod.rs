use std::path::PathBuf;

use crate::providers::{
    AbTestingProvider, AnalyticsProvider, AppHost, DataServices, HeatmapProvider, LocalProvider,
};

mod dev_deploy;
mod help;
mod import;
mod misc;
mod new;
mod ops;

pub(crate) use help::print_help;

use misc::{parse_add_command, parse_migrate_command};

/// How the page crawler should operate after a live-site import.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub(crate) enum CrawlMode {
    /// No crawl.
    None,
    /// Fast fetch-based crawl (default `--crawl-pages`).
    Fetch,
    /// Full browser crawl via Playwright (`--crawl-pages=playwright`).
    Browser,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Command {
    New {
        project_dir: PathBuf,
        use_local_package: bool,
        provider: LocalProvider,
        app_host: Option<AppHost>,
        data_services: Option<DataServices>,
        analytics: Option<AnalyticsProvider>,
        ab_testing: Option<AbTestingProvider>,
        heatmap: Option<HeatmapProvider>,
        enable_api: bool,
        yes_defaults: bool,
    },
    Completions {
        shell: String,
    },
    Dev {
        project_dir: PathBuf,
        provider: Option<LocalProvider>,
        app_host: Option<AppHost>,
        data_services: Option<DataServices>,
    },
    ImportWordPress {
        project_dir: PathBuf,
        /// Local export file. Mutually exclusive with `url`.
        source_path: Option<PathBuf>,
        /// Live site URL — triggers headless browser fetch. Mutually exclusive with `source_path`.
        url: Option<String>,
        credentials_file: Option<PathBuf>,
        username: Option<String>,
        password: Option<String>,
        artifact_dir: Option<PathBuf>,
        download_media: bool,
        apply_local: bool,
        resume: bool,
        crawl_mode: CrawlMode,
    },
    ImportWix {
        project_dir: PathBuf,
        /// Local export CSV. Mutually exclusive with `url`.
        source_path: Option<PathBuf>,
        /// Live site URL — triggers headless browser fetch. Mutually exclusive with `source_path`.
        url: Option<String>,
        credentials_file: Option<PathBuf>,
        email: Option<String>,
        password: Option<String>,
        artifact_dir: Option<PathBuf>,
        download_media: bool,
        apply_local: bool,
        resume: bool,
        crawl_mode: CrawlMode,
    },
    Backup {
        project_dir: PathBuf,
        output_dir: Option<PathBuf>,
    },
    Restore {
        project_dir: PathBuf,
        input_dir: PathBuf,
    },
    Doctor {
        project_dir: PathBuf,
        strict: bool,
        json: bool,
    },
    SyncExport {
        project_dir: PathBuf,
        output_dir: Option<PathBuf>,
    },
    SyncImport {
        project_dir: PathBuf,
        input_dir: PathBuf,
    },
    ServicesBootstrap {
        project_dir: PathBuf,
    },
    ServicesVerify {
        project_dir: PathBuf,
    },
    ConfigMigrate {
        project_dir: PathBuf,
        dry_run: bool,
    },
    DbMigrate {
        project_dir: PathBuf,
        migrations_dir: Option<String>,
        dry_run: bool,
        /// Deployment target: "local" (SQLite, default) or "d1" (Cloudflare D1 via wrangler).
        target: String,
    },
    DbRollback {
        project_dir: PathBuf,
        dry_run: bool,
        /// Deployment target: "local" (SQLite, default) or "d1" (Cloudflare D1 via wrangler).
        target: String,
    },
    Deploy {
        project_dir: PathBuf,
        target: Option<String>,
        app_host: Option<AppHost>,
    },
    UpgradeCheck {
        project_dir: PathBuf,
    },
    UpgradeApply {
        project_dir: PathBuf,
    },
    Add {
        project_dir: PathBuf,
        /// Raw `--flag value` pairs after the optional dir positional.
        feature_args: Vec<String>,
    },
    Migrate {
        project_dir: PathBuf,
        from: String,
        to: String,
        dry_run: bool,
    },
    ListTools,
    ListProviders,
    Help,
}

pub(crate) fn parse_command(args: &[String]) -> Result<Command, String> {
    match args {
        [] => Ok(Command::Help),
        [flag] if flag == "--help" || flag == "-h" || flag == "help" => Ok(Command::Help),
        [command, rest @ ..] if command == "new" || command == "init" => new::parse_new_command(rest),
        [command, rest @ ..] if command == "dev" => dev_deploy::parse_dev_command(rest),
        [command, rest @ ..] if command == "backup" => ops::parse_backup_command(rest),
        [command, rest @ ..] if command == "restore" => ops::parse_restore_command(rest),
        [command, rest @ ..] if command == "doctor" => ops::parse_doctor_command(rest),
        [command, subcommand, rest @ ..] if command == "import" && subcommand == "wordpress" => {
            import::parse_import_wordpress_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "import" && subcommand == "wix" => {
            import::parse_import_wix_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "sync" && subcommand == "export" => {
            ops::parse_sync_export_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "sync" && subcommand == "import" => {
            ops::parse_sync_import_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "services" && subcommand == "bootstrap" => {
            ops::parse_services_bootstrap_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "services" && subcommand == "verify" => {
            ops::parse_services_verify_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "config" && subcommand == "migrate" => {
            ops::parse_config_migrate_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "db" && subcommand == "migrate" => {
            ops::parse_db_migrate_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "db" && subcommand == "rollback" => {
            ops::parse_db_rollback_command(rest)
        }
        [command, rest @ ..] if command == "deploy" => dev_deploy::parse_deploy_command(rest),
        [command, subcommand, rest @ ..] if command == "upgrade" && subcommand == "--check" => {
            ops::parse_upgrade_check_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "upgrade" && subcommand == "--apply" => {
            ops::parse_upgrade_apply_command(rest)
        }
        [command, rest @ ..] if command == "upgrade" => ops::parse_upgrade_check_command(rest),
        [command, ..] if command == "import" => {
            Err("Unsupported import source. Use `astropress import wordpress` or `astropress import wix`.".into())
        }
        [command, ..] if command == "sync" => {
            Err("Unsupported sync subcommand. Use `astropress sync export` or `astropress sync import`.".into())
        }
        [command, ..] if command == "services" => {
            Err("Unsupported services subcommand. Use `astropress services bootstrap` or `astropress services verify`.".into())
        }
        [command, ..] if command == "config" => {
            Err("Unsupported config subcommand. Use `astropress config migrate`.".into())
        }
        [command, ..] if command == "db" => {
            Err("Unsupported db subcommand. Use `astropress db migrate` or `astropress db rollback`.".into())
        }
        [command, rest @ ..] if command == "completions" => {
            let shell = rest.first().cloned().unwrap_or_default();
            if shell.is_empty() {
                Err("Usage: `astropress completions <bash|zsh|fish|powershell>`.".into())
            } else {
                Ok(Command::Completions { shell })
            }
        }
        [command, rest @ ..] if command == "add" => parse_add_command(rest),
        [command, rest @ ..] if command == "migrate" => parse_migrate_command(rest),
        [command, subcommand, rest @ ..] if (command == "list" || command == "ls") && subcommand == "tools" => {
            if let Some(unknown) = rest.first() {
                Err(format!("Unsupported astropress list tools option: `{unknown}`."))
            } else {
                Ok(Command::ListTools)
            }
        }
        [command, subcommand, rest @ ..] if (command == "list" || command == "ls") && subcommand == "providers" => {
            if let Some(unknown) = rest.first() {
                Err(format!("Unsupported astropress list providers option: `{unknown}`."))
            } else {
                Ok(Command::ListProviders)
            }
        }
        [command, ..] if command == "list" || command == "ls" => {
            Err("Unsupported list subcommand. Use `astropress list tools` or `astropress list providers`.".into())
        }
        [command, ..] => Err(format!("Unsupported astropress command: `{command}`.")),
    }
}
