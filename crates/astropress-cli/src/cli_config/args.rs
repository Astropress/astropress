use std::env;
use std::path::PathBuf;

use crate::providers::{AppHost, DataServices, LocalProvider};

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Command {
    New {
        project_dir: PathBuf,
        use_local_package: bool,
        provider: LocalProvider,
        app_host: Option<AppHost>,
        data_services: Option<DataServices>,
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
        crawl_pages: bool,
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
        crawl_pages: bool,
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
    Deploy {
        project_dir: PathBuf,
        target: Option<String>,
        app_host: Option<AppHost>,
    },
    Help,
}

pub(crate) fn parse_command(args: &[String]) -> Result<Command, String> {
    match args {
        [] => Ok(Command::Help),
        [flag] if flag == "--help" || flag == "-h" || flag == "help" => Ok(Command::Help),
        [command, rest @ ..] if command == "new" => parse_new_command(rest),
        [command, rest @ ..] if command == "dev" => parse_dev_command(rest),
        [command, rest @ ..] if command == "backup" => parse_backup_command(rest),
        [command, rest @ ..] if command == "restore" => parse_restore_command(rest),
        [command, rest @ ..] if command == "doctor" => parse_doctor_command(rest),
        [command, subcommand, rest @ ..] if command == "import" && subcommand == "wordpress" => {
            parse_import_wordpress_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "import" && subcommand == "wix" => {
            parse_import_wix_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "sync" && subcommand == "export" => {
            parse_sync_export_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "sync" && subcommand == "import" => {
            parse_sync_import_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "services" && subcommand == "bootstrap" => {
            parse_services_bootstrap_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "services" && subcommand == "verify" => {
            parse_services_verify_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "config" && subcommand == "migrate" => {
            parse_config_migrate_command(rest)
        }
        [command, rest @ ..] if command == "deploy" => parse_deploy_command(rest),
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
        [command, ..] => Err(format!("Unsupported astropress command: `{command}`.")),
    }
}

fn parse_new_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = PathBuf::from("astropress-site");
    let mut use_local_package = true;
    let mut provider = LocalProvider::Sqlite;
    let mut app_host = None;
    let mut data_services = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--use-published-package" => use_local_package = false,
            "--use-local-package" => use_local_package = true,
            "--provider" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--provider`.".to_string())?;
                provider = LocalProvider::parse(value)?;
            }
            "--app-host" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--app-host`.".to_string())?;
                app_host = Some(AppHost::parse(value)?);
            }
            "--data-services" | "--content-services" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--content-services`.".to_string())?;
                let selected = DataServices::parse(value)?;
                provider = selected.default_local_provider();
                data_services = Some(selected);
            }
            value if value.starts_with("--") => {
                return Err(format!("Unsupported astropress new option: `{value}`."));
            }
            value => {
                project_dir = PathBuf::from(value);
            }
        }
        index += 1;
    }

    Ok(Command::New {
        project_dir,
        use_local_package,
        provider,
        app_host,
        data_services,
    })
}

fn parse_dev_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut provider = None;
    let mut app_host = None;
    let mut data_services = None;
    let mut index = 0;
    let mut positional_project_dir = None;

    while index < args.len() {
        match args[index].as_str() {
            "--provider" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--provider`.".to_string())?;
                provider = Some(LocalProvider::parse(value)?);
            }
            "--app-host" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--app-host`.".to_string())?;
                app_host = Some(AppHost::parse(value)?);
            }
            "--data-services" | "--content-services" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--content-services`.".to_string())?;
                let selected = DataServices::parse(value)?;
                provider = Some(selected.default_local_provider());
                data_services = Some(selected);
            }
            value if value.starts_with("--") => {
                return Err(format!("Unsupported astropress dev option: `{value}`."));
            }
            value => {
                if positional_project_dir.is_some() {
                    return Err("Usage: `astropress dev [project-dir] [--provider sqlite|supabase|runway] [--app-host <host>] [--content-services <services>]`.".into());
                }
                positional_project_dir = Some(PathBuf::from(value));
            }
        }
        index += 1;
    }

    Ok(Command::Dev {
        project_dir: positional_project_dir.unwrap_or_else(|| std::mem::take(&mut project_dir)),
        provider,
        app_host,
        data_services,
    })
}

fn parse_import_wordpress_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut source_path: Option<PathBuf> = None;
    let mut url: Option<String> = None;
    let mut credentials_file: Option<PathBuf> = None;
    let mut username: Option<String> = None;
    let mut password: Option<String> = None;
    let mut artifact_dir = None;
    let mut download_media = false;
    let mut apply_local = false;
    let mut resume = false;
    let mut crawl_pages = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--source" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--source`.".to_string())?;
                source_path = Some(PathBuf::from(value));
            }
            "--url" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--url`.".to_string())?;
                url = Some(value.clone());
            }
            "--credentials-file" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--credentials-file`.".to_string())?;
                credentials_file = Some(PathBuf::from(value));
            }
            "--username" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--username`.".to_string())?;
                username = Some(value.clone());
            }
            "--password" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--password`.".to_string())?;
                password = Some(value.clone());
            }
            "--artifact-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--artifact-dir`.".to_string())?;
                artifact_dir = Some(PathBuf::from(value));
            }
            "--download-media" => download_media = true,
            "--apply-local" => apply_local = true,
            "--resume" => resume = true,
            "--crawl-pages" => crawl_pages = true,
            other => {
                return Err(format!(
                    "Unsupported astropress import wordpress option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    if source_path.is_none() && url.is_none() {
        return Err(
            "Usage: `astropress import wordpress --source <export.xml>` or `astropress import wordpress --url <https://mysite.com>`."
                .to_string(),
        );
    }
    if source_path.is_some() && url.is_some() {
        return Err("Cannot use both `--source` and `--url` at the same time.".to_string());
    }

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
        crawl_pages,
    })
}

fn parse_import_wix_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut source_path: Option<PathBuf> = None;
    let mut url: Option<String> = None;
    let mut credentials_file: Option<PathBuf> = None;
    let mut email: Option<String> = None;
    let mut password: Option<String> = None;
    let mut artifact_dir = None;
    let mut download_media = false;
    let mut apply_local = false;
    let mut resume = false;
    let mut crawl_pages = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--source" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--source`.".to_string())?;
                source_path = Some(PathBuf::from(value));
            }
            "--url" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--url`.".to_string())?;
                url = Some(value.clone());
            }
            "--credentials-file" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--credentials-file`.".to_string())?;
                credentials_file = Some(PathBuf::from(value));
            }
            "--email" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--email`.".to_string())?;
                email = Some(value.clone());
            }
            "--password" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--password`.".to_string())?;
                password = Some(value.clone());
            }
            "--artifact-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--artifact-dir`.".to_string())?;
                artifact_dir = Some(PathBuf::from(value));
            }
            "--download-media" => download_media = true,
            "--apply-local" => apply_local = true,
            "--resume" => resume = true,
            "--crawl-pages" => crawl_pages = true,
            other => {
                return Err(format!(
                    "Unsupported astropress import wix option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    if source_path.is_none() && url.is_none() {
        return Err(
            "Usage: `astropress import wix --source <export.csv>` or `astropress import wix --url <https://username.wixsite.com/mysite>`."
                .to_string(),
        );
    }
    if source_path.is_some() && url.is_some() {
        return Err("Cannot use both `--source` and `--url` at the same time.".to_string());
    }

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
        crawl_pages,
    })
}

fn parse_backup_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut output_dir = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--out" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--out`.".to_string())?;
                output_dir = Some(PathBuf::from(value));
            }
            other => return Err(format!("Unsupported astropress backup option: `{other}`.")),
        }
        index += 1;
    }

    Ok(Command::Backup {
        project_dir,
        output_dir,
    })
}

fn parse_restore_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut input_dir = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--from" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--from`.".to_string())?;
                input_dir = Some(PathBuf::from(value));
            }
            other => return Err(format!("Unsupported astropress restore option: `{other}`.")),
        }
        index += 1;
    }

    Ok(Command::Restore {
        project_dir,
        input_dir: input_dir.ok_or_else(|| {
            "Usage: `astropress restore --from <snapshot-dir> [--project-dir <dir>]`.".to_string()
        })?,
    })
}

fn parse_doctor_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut strict = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--strict" => {
                strict = true;
            }
            other => return Err(format!("Unsupported astropress doctor option: `{other}`.")),
        }
        index += 1;
    }

    Ok(Command::Doctor { project_dir, strict })
}

fn parse_sync_export_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut output_dir = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--out" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--out`.".to_string())?;
                output_dir = Some(PathBuf::from(value));
            }
            other => {
                return Err(format!(
                    "Unsupported astropress sync export option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    Ok(Command::SyncExport {
        project_dir,
        output_dir,
    })
}

fn parse_sync_import_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut input_dir = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--from" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--from`.".to_string())?;
                input_dir = Some(PathBuf::from(value));
            }
            other => {
                return Err(format!(
                    "Unsupported astropress sync import option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    Ok(Command::SyncImport {
        project_dir,
        input_dir: input_dir.ok_or_else(|| {
            "Usage: `astropress sync import --from <snapshot-dir> [--project-dir <dir>]`."
                .to_string()
        })?,
    })
}

fn parse_services_bootstrap_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            other => {
                return Err(format!(
                    "Unsupported astropress services bootstrap option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    Ok(Command::ServicesBootstrap { project_dir })
}

fn parse_services_verify_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            other => {
                return Err(format!(
                    "Unsupported astropress services verify option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    Ok(Command::ServicesVerify { project_dir })
}

fn parse_deploy_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut target = None;
    let mut app_host = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--target" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--target`.".to_string())?;
                target = Some(value.clone());
            }
            "--app-host" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--app-host`.".to_string())?;
                let selected = AppHost::parse(value)?;
                target = Some(selected.deploy_target().to_string());
                app_host = Some(selected);
            }
            other => return Err(format!("Unsupported astropress deploy option: `{other}`.")),
        }
        index += 1;
    }

    Ok(Command::Deploy {
        project_dir,
        target,
        app_host,
    })
}

fn parse_config_migrate_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut dry_run = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--dry-run" => {
                dry_run = true;
            }
            other => {
                return Err(format!(
                    "Unsupported astropress config migrate option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    Ok(Command::ConfigMigrate { project_dir, dry_run })
}

pub(crate) fn print_help() {
    println!("astropress-cli");
    println!("Commands:");
    println!("  astropress new [project-dir] [--app-host <host>] [--content-services <services>] [--use-local-package|--use-published-package]");
    println!("  astropress dev [project-dir] [--app-host <host>] [--content-services <services>]");
    println!("  astropress import wordpress --source <export.xml> [--project-dir <dir>] [--artifact-dir <dir>] [--download-media] [--apply-local] [--resume]");
    println!("  astropress import wordpress --url <https://mysite.com> [--credentials-file <file>] [--username <u>] [--password <p>] [--crawl-pages] [--project-dir <dir>] [--artifact-dir <dir>] [--download-media] [--apply-local]");
    println!("  astropress import wix --source <export.csv> [--project-dir <dir>] [--artifact-dir <dir>] [--download-media] [--apply-local] [--resume]");
    println!("  astropress import wix --url <https://username.wixsite.com/mysite> [--credentials-file <file>] [--email <e>] [--password <p>] [--crawl-pages] [--project-dir <dir>] [--artifact-dir <dir>] [--download-media] [--apply-local]");
    println!("  astropress backup [--project-dir <dir>] [--out <snapshot-dir>]");
    println!("  astropress restore --from <snapshot-dir> [--project-dir <dir>]");
    println!("  astropress doctor [--project-dir <dir>] [--strict]");
    println!("  astropress services bootstrap [--project-dir <dir>]");
    println!("  astropress services verify [--project-dir <dir>]");
    println!("  astropress config migrate [--project-dir <dir>] [--dry-run]");
    println!("  astropress sync export [--project-dir <dir>] [--out <snapshot-dir>]");
    println!("  astropress sync import --from <snapshot-dir> [--project-dir <dir>]");
    println!("  astropress deploy [--project-dir <dir>] [--app-host <host>] [--target github-pages|cloudflare|vercel|netlify|render-static|render-web|gitlab-pages|firebase-hosting|runway|custom]");
}
