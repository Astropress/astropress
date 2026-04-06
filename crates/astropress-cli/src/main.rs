use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::{Command as ProcessCommand, ExitCode};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

fn main() -> ExitCode {
    let args = env::args().skip(1).collect::<Vec<_>>();
    match parse_command(&args) {
        Ok(Command::New {
            project_dir,
            use_local_package,
            provider,
            app_host,
            data_services,
        }) => match scaffold_new_project(&project_dir, use_local_package, provider, app_host, data_services) {
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
            artifact_dir,
            download_media,
            apply_local,
            resume,
        }) => match stage_wordpress_import(
            &project_dir,
            &source_path,
            artifact_dir.as_deref(),
            download_media,
            apply_local,
            resume,
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
        Ok(Command::Doctor { project_dir, strict }) => match inspect_project_health(&project_dir) {
            Ok(report) => {
                print_doctor_report(&report);
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

#[derive(Debug, PartialEq, Eq)]
enum Command {
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
        source_path: PathBuf,
        artifact_dir: Option<PathBuf>,
        download_media: bool,
        apply_local: bool,
        resume: bool,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PackageManager {
    Bun,
    Npm,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LocalProvider {
    Sqlite,
    Supabase,
    Runway,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AppHost {
    GithubPages,
    CloudflarePages,
    Vercel,
    Netlify,
    RenderStatic,
    RenderWeb,
    GitlabPages,
    FirebaseHosting,
    Runway,
    Custom,
}

impl AppHost {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "github-pages" => Ok(Self::GithubPages),
            "cloudflare-pages" => Ok(Self::CloudflarePages),
            "vercel" => Ok(Self::Vercel),
            "netlify" => Ok(Self::Netlify),
            "render-static" => Ok(Self::RenderStatic),
            "render-web" => Ok(Self::RenderWeb),
            "gitlab-pages" => Ok(Self::GitlabPages),
            "firebase-hosting" => Ok(Self::FirebaseHosting),
            "runway" => Ok(Self::Runway),
            "custom" => Ok(Self::Custom),
            other => Err(format!(
                "Unsupported app host `{other}`. Use github-pages, cloudflare-pages, vercel, netlify, render-static, render-web, gitlab-pages, firebase-hosting, runway, or custom."
            )),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::GithubPages => "github-pages",
            Self::CloudflarePages => "cloudflare-pages",
            Self::Vercel => "vercel",
            Self::Netlify => "netlify",
            Self::RenderStatic => "render-static",
            Self::RenderWeb => "render-web",
            Self::GitlabPages => "gitlab-pages",
            Self::FirebaseHosting => "firebase-hosting",
            Self::Runway => "runway",
            Self::Custom => "custom",
        }
    }

    fn deploy_target(self) -> &'static str {
        match self {
            Self::CloudflarePages => "cloudflare",
            _ => self.as_str(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DataServices {
    None,
    Cloudflare,
    Supabase,
    Firebase,
    Appwrite,
    Pocketbase,
    Neon,
    Nhost,
    Runway,
    Custom,
}

impl DataServices {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "none" => Ok(Self::None),
            "cloudflare" => Ok(Self::Cloudflare),
            "supabase" => Ok(Self::Supabase),
            "firebase" => Ok(Self::Firebase),
            "appwrite" => Ok(Self::Appwrite),
            "pocketbase" => Ok(Self::Pocketbase),
            "neon" => Ok(Self::Neon),
            "nhost" => Ok(Self::Nhost),
            "runway" => Ok(Self::Runway),
            "custom" => Ok(Self::Custom),
            other => Err(format!(
                "Unsupported data services `{other}`. Use none, cloudflare, supabase, firebase, appwrite, pocketbase, neon, nhost, runway, or custom."
            )),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Cloudflare => "cloudflare",
            Self::Supabase => "supabase",
            Self::Firebase => "firebase",
            Self::Appwrite => "appwrite",
            Self::Pocketbase => "pocketbase",
            Self::Neon => "neon",
            Self::Nhost => "nhost",
            Self::Runway => "runway",
            Self::Custom => "custom",
        }
    }

    fn default_local_provider(self) -> LocalProvider {
        match self {
            Self::Supabase => LocalProvider::Supabase,
            Self::Runway => LocalProvider::Runway,
            _ => LocalProvider::Sqlite,
        }
    }
}

fn deployment_support_level(app_host: &str, data_services: &str) -> &'static str {
    match (app_host, data_services) {
        ("github-pages", "none")
        | ("cloudflare-pages", "cloudflare")
        | ("vercel", "supabase")
        | ("netlify", "supabase")
        | ("render-web", "supabase")
        | ("runway", "runway") => "supported",
        ("github-pages", "supabase")
        | ("github-pages", "firebase")
        | ("render-web", "firebase")
        | ("render-web", "appwrite")
        | ("gitlab-pages", "supabase")
        | ("firebase-hosting", "supabase")
        | ("vercel", "firebase")
        | ("netlify", "firebase")
        | ("vercel", "appwrite")
        | ("netlify", "appwrite")
        | ("cloudflare-pages", "supabase")
        | ("cloudflare-pages", "firebase") => "preview",
        _ => "unsupported",
    }
}

impl LocalProvider {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "sqlite" => Ok(Self::Sqlite),
            "supabase" => Ok(Self::Supabase),
            "runway" => Ok(Self::Runway),
            other => Err(format!(
                "Unsupported local provider `{other}`. Use sqlite, supabase, or runway."
            )),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Sqlite => "sqlite",
            Self::Supabase => "supabase",
            Self::Runway => "runway",
        }
    }

    fn default_admin_db_relative_path(self) -> &'static str {
        match self {
            Self::Sqlite => ".data/admin.sqlite",
            Self::Supabase => ".data/supabase-admin.sqlite",
            Self::Runway => ".data/runway-admin.sqlite",
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct PackageManifest {
    name: String,
    #[serde(default)]
    private: bool,
    #[serde(rename = "type", default)]
    package_type: Option<String>,
    #[serde(default)]
    scripts: BTreeMap<String, String>,
    #[serde(default)]
    dependencies: BTreeMap<String, String>,
    #[serde(rename = "devDependencies", default)]
    dev_dependencies: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
struct WordPressImportManifest {
    source_file: String,
    imported_at_unix_ms: u128,
    inventory_file: String,
    plan_file: String,
    report_file: String,
    artifact_dir: String,
    content_file: String,
    media_file: String,
    comment_file: String,
    user_file: String,
    redirect_file: String,
    taxonomy_file: String,
    remediation_file: String,
    download_state_file: String,
    local_apply_report_file: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportEntityCounts {
    posts: usize,
    pages: usize,
    attachments: usize,
    redirects: usize,
    comments: usize,
    users: usize,
    categories: usize,
    tags: usize,
    skipped: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportInventory {
    detected_records: usize,
    detected_media: usize,
    detected_comments: usize,
    detected_users: usize,
    detected_shortcodes: usize,
    detected_builder_markers: usize,
    entity_counts: WordPressImportEntityCounts,
    unsupported_patterns: Vec<String>,
    remediation_candidates: Vec<String>,
    warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportPlan {
    artifact_dir: Option<String>,
    include_comments: bool,
    include_users: bool,
    include_media: bool,
    download_media: bool,
    apply_local: bool,
    permalink_strategy: String,
    resume_supported: bool,
    entity_counts: WordPressImportEntityCounts,
    review_required: bool,
    manual_tasks: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportArtifacts {
    artifact_dir: Option<String>,
    inventory_file: Option<String>,
    plan_file: Option<String>,
    content_file: Option<String>,
    media_file: Option<String>,
    comment_file: Option<String>,
    user_file: Option<String>,
    redirect_file: Option<String>,
    taxonomy_file: Option<String>,
    remediation_file: Option<String>,
    download_state_file: Option<String>,
    local_apply_report_file: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressLocalApplyReport {
    runtime: String,
    workspace_root: String,
    admin_db_path: String,
    applied_records: usize,
    applied_media: usize,
    applied_comments: usize,
    applied_users: usize,
    applied_redirects: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportFailedMedia {
    id: String,
    source_url: Option<String>,
    reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportResult {
    status: String,
    imported_records: usize,
    imported_media: usize,
    imported_comments: usize,
    imported_users: usize,
    imported_redirects: usize,
    downloaded_media: usize,
    failed_media: Vec<WordPressImportFailedMedia>,
    review_required: bool,
    manual_tasks: Vec<String>,
    inventory: WordPressImportInventory,
    plan: WordPressImportPlan,
    artifacts: Option<WordPressImportArtifacts>,
    local_apply: Option<WordPressLocalApplyReport>,
    warnings: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct SnapshotResult {
    target_dir: Option<String>,
    source_dir: Option<String>,
    file_count: usize,
}

#[derive(Debug, Deserialize)]
struct DeployResult {
    deployment_id: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProjectScaffold {
    provider: String,
    #[serde(rename = "appHost")]
    app_host: String,
    #[serde(rename = "dataServices")]
    _data_services: String,
    #[serde(rename = "recommendedDeployTarget")]
    recommended_deploy_target: String,
    #[serde(rename = "recommendationRationale")]
    recommendation_rationale: String,
    #[serde(rename = "supportLevel")]
    support_level: String,
    #[serde(rename = "contentServices")]
    content_services: String,
    #[serde(rename = "localEnv")]
    local_env: BTreeMap<String, String>,
    #[serde(rename = "envExample")]
    env_example: BTreeMap<String, String>,
    #[serde(rename = "packageScripts")]
    package_scripts: BTreeMap<String, String>,
    #[serde(rename = "ciFiles")]
    ci_files: BTreeMap<String, String>,
    #[serde(rename = "deployDoc")]
    deploy_doc: String,
    #[serde(rename = "requiredEnvKeys")]
    required_env_keys: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ProjectEnvContract {
    #[serde(rename = "localProvider")]
    local_provider: String,
    #[serde(rename = "hostedProvider")]
    hosted_provider: String,
    #[serde(rename = "deployTarget")]
    deploy_target: String,
    #[serde(rename = "appHost")]
    app_host: String,
    #[serde(rename = "dataServices")]
    data_services: String,
    #[serde(rename = "contentServices")]
    content_services: String,
    #[serde(rename = "serviceOrigin")]
    service_origin: Option<String>,
    #[serde(rename = "adminDbPath")]
    admin_db_path: String,
}

#[derive(Debug, Deserialize)]
struct ProjectRuntimePlan {
    mode: String,
    env: ProjectEnvContract,
    adapter: ProjectRuntimeAdapter,
}

#[derive(Debug, Deserialize)]
struct ProjectLaunchPlan {
    runtime: ProjectRuntimePlan,
    provider: String,
    #[serde(rename = "deployTarget")]
    deploy_target: String,
    #[serde(rename = "appHost")]
    app_host: String,
    #[serde(rename = "dataServices")]
    data_services: String,
    #[serde(rename = "adminDbPath")]
    admin_db_path: String,
    #[serde(rename = "requiresLocalSeed")]
    requires_local_seed: bool,
}

#[derive(Debug, Deserialize)]
struct ProjectRuntimeAdapter {
    capabilities: ProjectRuntimeCapabilities,
}

#[derive(Debug, Deserialize)]
struct ProjectRuntimeCapabilities {
    name: String,
}

#[derive(Debug, Deserialize)]
struct ContentServicesReport {
    #[serde(rename = "contentServices")]
    content_services: String,
    #[serde(rename = "supportLevel")]
    support_level: String,
    #[serde(rename = "serviceOrigin")]
    service_origin: Option<String>,
    #[serde(rename = "requiredEnvKeys")]
    required_env_keys: Vec<String>,
    #[serde(rename = "missingEnvKeys")]
    missing_env_keys: Vec<String>,
    #[serde(rename = "manifestFile")]
    manifest_file: Option<String>,
}

#[derive(Debug)]
struct DoctorReport {
    project_dir: PathBuf,
    env_contract: ProjectEnvContract,
    launch_plan: ProjectLaunchPlan,
    warnings: Vec<String>,
}

fn parse_command(args: &[String]) -> Result<Command, String> {
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
            Err("Unsupported import source. Only `astropress import wordpress` is available.".into())
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
    let mut artifact_dir = None;
    let mut download_media = false;
    let mut apply_local = false;
    let mut resume = false;
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
            "--artifact-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--artifact-dir`.".to_string())?;
                artifact_dir = Some(PathBuf::from(value));
            }
            "--download-media" => {
                download_media = true;
            }
            "--apply-local" => {
                apply_local = true;
            }
            "--resume" => {
                resume = true;
            }
            other => return Err(format!("Unsupported astropress import wordpress option: `{other}`.")),
        }
        index += 1;
    }

    let source_path = source_path.ok_or_else(|| {
        "Usage: `astropress import wordpress --source <path-to-export.xml> [--project-dir <dir>]`."
            .to_string()
    })?;

    Ok(Command::ImportWordPress {
        project_dir,
        source_path,
        artifact_dir,
        download_media,
        apply_local,
        resume,
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
            other => return Err(format!("Unsupported astropress sync export option: `{other}`.")),
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
            other => return Err(format!("Unsupported astropress sync import option: `{other}`.")),
        }
        index += 1;
    }

    Ok(Command::SyncImport {
        project_dir,
        input_dir: input_dir.ok_or_else(|| {
            "Usage: `astropress sync import --from <snapshot-dir> [--project-dir <dir>]`.".to_string()
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
            other => return Err(format!("Unsupported astropress services bootstrap option: `{other}`.")),
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
            other => return Err(format!("Unsupported astropress services verify option: `{other}`.")),
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

    Ok(Command::Deploy { project_dir, target, app_host })
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
            other => return Err(format!("Unsupported astropress config migrate option: `{other}`.")),
        }
        index += 1;
    }

    Ok(Command::ConfigMigrate { project_dir, dry_run })
}

fn print_help() {
    println!("astropress-cli");
    println!("Commands:");
    println!("  astropress new [project-dir] [--app-host <host>] [--content-services <services>] [--use-local-package|--use-published-package]");
    println!("  astropress dev [project-dir] [--app-host <host>] [--content-services <services>]");
    println!("  astropress import wordpress --source <export.xml> [--project-dir <dir>] [--artifact-dir <dir>] [--download-media] [--apply-local] [--resume]");
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

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .unwrap()
        .to_path_buf()
}

fn example_template_dir() -> PathBuf {
    repo_root().join("examples").join("github-pages")
}

fn sanitize_package_name(input: &str) -> String {
    let mut output = String::new();
    let mut last_dash = false;
    for character in input.chars().flat_map(|character| character.to_lowercase()) {
        if character.is_ascii_alphanumeric() {
            output.push(character);
            last_dash = false;
        } else if !last_dash {
            output.push('-');
            last_dash = true;
        }
    }
    output.trim_matches('-').to_string()
}

fn copy_template_dir(source: &Path, destination: &Path) -> Result<(), String> {
    for entry in fs::read_dir(source).map_err(io_error)? {
        let entry = entry.map_err(io_error)?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let file_type = entry.file_type().map_err(io_error)?;

        if source_path
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value == ".astro")
        {
            continue;
        }

        if file_type.is_dir() {
            fs::create_dir_all(&destination_path).map_err(io_error)?;
            copy_template_dir(&source_path, &destination_path)?;
        } else if file_type.is_file() {
            fs::copy(&source_path, &destination_path).map_err(io_error)?;
        }
    }

    Ok(())
}

fn read_package_manifest(project_dir: &Path) -> Result<PackageManifest, String> {
    let package_json = fs::read_to_string(project_dir.join("package.json")).map_err(io_error)?;
    serde_json::from_str::<PackageManifest>(&package_json).map_err(|error| error.to_string())
}

fn write_package_manifest(project_dir: &Path, manifest: &PackageManifest) -> Result<(), String> {
    let package_json = serde_json::to_string_pretty(manifest).map_err(|error| error.to_string())?;
    fs::write(project_dir.join("package.json"), format!("{package_json}\n")).map_err(io_error)
}

fn astropress_package_version() -> Result<String, String> {
    let package_manifest_path = repo_root()
        .join("packages")
        .join("astropress")
        .join("package.json");
    let package_json = fs::read_to_string(package_manifest_path).map_err(io_error)?;
    let package_manifest =
        serde_json::from_str::<serde_json::Value>(&package_json).map_err(|error| error.to_string())?;
    package_manifest
        .get("version")
        .and_then(|value| value.as_str())
        .map(ToString::to_string)
        .ok_or_else(|| "Astropress package version is missing from package.json.".to_string())
}

fn default_admin_db_relative_path(provider: LocalProvider) -> &'static str {
    provider.default_admin_db_relative_path()
}

fn ensure_local_provider_defaults(project_dir: &Path) -> Result<(), String> {
    let data_dir = project_dir.join(".data");
    fs::create_dir_all(&data_dir).map_err(io_error)?;

    let gitkeep_path = data_dir.join(".gitkeep");
    if !gitkeep_path.exists() {
        fs::write(&gitkeep_path, "").map_err(io_error)?;
    }
    Ok(())
}

fn write_text_file(project_dir: &Path, relative_path: &str, contents: &str) -> Result<(), String> {
    let destination = project_dir.join(relative_path);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(io_error)?;
    }
    fs::write(destination, contents).map_err(io_error)
}

fn format_env_map(values: &BTreeMap<String, String>) -> String {
    let mut output = String::new();
    for (key, value) in values {
        output.push_str(key);
        output.push('=');
        output.push_str(value);
        output.push('\n');
    }
    output
}

fn read_env_path(env_path: &Path) -> Result<BTreeMap<String, String>, String> {
    if !env_path.exists() {
        return Ok(BTreeMap::new());
    }

    let contents = fs::read_to_string(env_path).map_err(io_error)?;
    let mut values = BTreeMap::new();
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once('=') {
            values.insert(key.trim().to_string(), value.trim().to_string());
        }
    }

    Ok(values)
}

fn read_env_file(project_dir: &Path) -> Result<BTreeMap<String, String>, String> {
    read_env_path(&project_dir.join(".env"))
}

fn migrate_env_map(mut env_values: BTreeMap<String, String>) -> BTreeMap<String, String> {
    if !env_values.contains_key("ASTROPRESS_CONTENT_SERVICES") {
        if let Some(value) = env_values.get("ASTROPRESS_DATA_SERVICES").cloned() {
            env_values.insert("ASTROPRESS_CONTENT_SERVICES".into(), value);
        } else if let Some(value) = env_values.get("ASTROPRESS_BACKEND_PLATFORM").cloned() {
            env_values.insert("ASTROPRESS_CONTENT_SERVICES".into(), value);
        }
    }

    if !env_values.contains_key("ASTROPRESS_APP_HOST") {
        if let Some(value) = env_values.get("ASTROPRESS_DEPLOY_TARGET").cloned() {
            let app_host = match value.as_str() {
                "cloudflare" => "cloudflare-pages",
                "github-pages" | "vercel" | "netlify" | "render-static" | "render-web"
                | "gitlab-pages" | "firebase-hosting" | "runway" | "custom" => value.as_str(),
                _ => "",
            };
            if !app_host.is_empty() {
                env_values.insert("ASTROPRESS_APP_HOST".into(), app_host.to_string());
            }
        }
    }

    if !env_values.contains_key("ASTROPRESS_SERVICE_ORIGIN") {
        if let Some(url) = env_values.get("SUPABASE_URL").cloned() {
            env_values.insert(
                "ASTROPRESS_SERVICE_ORIGIN".into(),
                format!("{}/functions/v1/astropress", url.trim_end_matches('/')),
            );
        } else if let Some(project_id) = env_values.get("FIREBASE_PROJECT_ID").cloned() {
            env_values.insert(
                "ASTROPRESS_SERVICE_ORIGIN".into(),
                format!("https://{project_id}.firebaseapp.com/astropress-api"),
            );
        } else if let Some(endpoint) = env_values.get("APPWRITE_ENDPOINT").cloned() {
            env_values.insert(
                "ASTROPRESS_SERVICE_ORIGIN".into(),
                format!("{}/functions/astropress", endpoint.trim_end_matches('/')),
            );
        } else if let Some(project_id) = env_values.get("RUNWAY_PROJECT_ID").cloned() {
            env_values.insert(
                "ASTROPRESS_SERVICE_ORIGIN".into(),
                format!("https://runway.example/{project_id}/astropress-api"),
            );
        }
    }

    env_values.remove("ASTROPRESS_DATA_SERVICES");
    env_values.remove("ASTROPRESS_BACKEND_PLATFORM");
    env_values.remove("ASTROPRESS_HOSTED_PROVIDER");
    env_values.remove("ASTROPRESS_DEPLOY_TARGET");

    env_values
}

fn migrate_package_manifest_scripts(manifest: &mut PackageManifest) -> bool {
    let mut changed = false;
    for command in manifest.scripts.values_mut() {
        let updated = command
            .replace("--data-services", "--content-services")
            .replace("ASTROPRESS_DATA_SERVICES", "ASTROPRESS_CONTENT_SERVICES");
        if *command != updated {
            *command = updated;
            changed = true;
        }
    }
    changed
}

fn migrate_project_config(project_dir: &Path, dry_run: bool) -> Result<usize, String> {
    let mut changed = 0;
    for file_name in [".env", ".env.example"] {
        let path = project_dir.join(file_name);
        if !path.exists() {
            continue;
        }
        let original = read_env_path(&path)?;
        let migrated = migrate_env_map(original.clone());
        if migrated != original {
            changed += 1;
            if !dry_run {
                fs::write(path, format_env_map(&migrated)).map_err(io_error)?;
            }
        }
    }
    let package_json_path = project_dir.join("package.json");
    if package_json_path.exists() {
        let mut manifest = read_package_manifest(project_dir)?;
        if migrate_package_manifest_scripts(&mut manifest) {
            changed += 1;
            if !dry_run {
                write_package_manifest(project_dir, &manifest)?;
            }
        }
    }
    Ok(changed)
}

fn merge_env_overrides(
    mut env_values: BTreeMap<String, String>,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
    provider: Option<LocalProvider>,
) -> BTreeMap<String, String> {
    if let Some(app_host) = app_host {
        env_values.insert("ASTROPRESS_APP_HOST".into(), app_host.as_str().into());
        env_values.insert(
            "ASTROPRESS_DEPLOY_TARGET".into(),
            app_host.deploy_target().into(),
        );
    }
    if let Some(data_services) = data_services {
        env_values.insert(
            "ASTROPRESS_CONTENT_SERVICES".into(),
            data_services.as_str().into(),
        );
        env_values.insert(
            "ASTROPRESS_DATA_SERVICES".into(),
            data_services.as_str().into(),
        );
    }
    if let Some(provider) = provider {
        env_values.insert("ASTROPRESS_LOCAL_PROVIDER".into(), provider.as_str().into());
    }
    env_values
}

fn load_project_env_contract(project_dir: &Path) -> Result<ProjectEnvContract, String> {
    let env_module = package_module_import("project-env.js")?;
    let env_module_literal = serde_json::to_string(&env_module).map_err(|error| error.to_string())?;
    let env_values = read_env_file(project_dir)?;
    let env_values_json = serde_json::to_string(&env_values).map_err(|error| error.to_string())?;
    let script = format!(
        r#"import {{ resolveAstropressProjectEnvContract }} from {module};

const envValues = {env_values};
console.log(JSON.stringify(resolveAstropressProjectEnvContract(envValues)));
"#,
        module = env_module_literal,
        env_values = env_values_json,
    );

    let output = ProcessCommand::new("node")
        .args(["--input-type=module", "--eval", &script])
        .output()
        .map_err(io_error)?;

    if !output.status.success() {
        return Err(format!(
            "Failed to load Astropress project env contract: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    serde_json::from_slice::<ProjectEnvContract>(&output.stdout).map_err(|error| error.to_string())
}

fn load_project_runtime_plan(
    project_dir: &Path,
    provider: Option<LocalProvider>,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
) -> Result<ProjectRuntimePlan, String> {
    let runtime_module = package_module_import("project-runtime.js")?;
    let runtime_module_literal =
        serde_json::to_string(&runtime_module).map_err(|error| error.to_string())?;
    let env_values = merge_env_overrides(read_env_file(project_dir)?, app_host, data_services, provider);
    let env_values_json = serde_json::to_string(&env_values).map_err(|error| error.to_string())?;
    let local_json = serde_json::to_string(&serde_json::json!({
        "workspaceRoot": project_dir.display().to_string(),
        "dbPath": provider.map(|local_provider| {
            project_dir
                .join(default_admin_db_relative_path(local_provider))
                .display()
                .to_string()
        }),
        "provider": provider.map(LocalProvider::as_str),
    }))
    .map_err(|error| error.to_string())?;
    let script = format!(
        r#"import {{ createAstropressProjectRuntimePlan }} from {module};

const envValues = {env_values};
const localOptions = {local_options};
console.log(JSON.stringify(createAstropressProjectRuntimePlan({{
  env: envValues,
  local: localOptions,
}})));
"#,
        module = runtime_module_literal,
        env_values = env_values_json,
        local_options = local_json,
    );

    let output = ProcessCommand::new("node")
        .args(["--input-type=module", "--eval", &script])
        .output()
        .map_err(io_error)?;

    if !output.status.success() {
        return Err(format!(
            "Failed to load Astropress project runtime plan: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    serde_json::from_slice::<ProjectRuntimePlan>(&output.stdout).map_err(|error| error.to_string())
}

fn load_project_launch_plan(
    project_dir: &Path,
    provider: Option<LocalProvider>,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
) -> Result<ProjectLaunchPlan, String> {
    let launch_module = package_module_import("project-launch.js")?;
    let launch_module_literal =
        serde_json::to_string(&launch_module).map_err(|error| error.to_string())?;
    let env_values = merge_env_overrides(read_env_file(project_dir)?, app_host, data_services, provider);
    let env_values_json = serde_json::to_string(&env_values).map_err(|error| error.to_string())?;
    let local_json = serde_json::to_string(&serde_json::json!({
        "workspaceRoot": project_dir.display().to_string(),
        "dbPath": provider.map(|local_provider| {
            project_dir
                .join(default_admin_db_relative_path(local_provider))
                .display()
                .to_string()
        }),
        "provider": provider.map(LocalProvider::as_str),
    }))
    .map_err(|error| error.to_string())?;
    let script = format!(
        r#"import {{ createAstropressProjectLaunchPlan }} from {module};

const envValues = {env_values};
const localOptions = {local_options};
console.log(JSON.stringify(createAstropressProjectLaunchPlan({{
  env: envValues,
  local: localOptions,
}})));
"#,
        module = launch_module_literal,
        env_values = env_values_json,
        local_options = local_json,
    );

    let output = ProcessCommand::new("node")
        .args(["--input-type=module", "--eval", &script])
        .output()
        .map_err(io_error)?;

    if !output.status.success() {
        return Err(format!(
            "Failed to load Astropress project launch plan: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    serde_json::from_slice::<ProjectLaunchPlan>(&output.stdout).map_err(|error| error.to_string())
}

fn resolve_local_provider(project_dir: &Path, provider: Option<LocalProvider>) -> Result<LocalProvider, String> {
    if let Some(provider) = provider {
        return Ok(provider);
    }

    LocalProvider::parse(&load_project_launch_plan(project_dir, None, None, None)?.provider)
}

fn resolve_admin_db_path(project_dir: &Path, provider: LocalProvider) -> Result<String, String> {
    let launch_plan = load_project_launch_plan(project_dir, Some(provider), None, None)?;
    let contract = launch_plan.runtime.env;
    if contract.local_provider != provider.as_str() {
        return Ok(default_admin_db_relative_path(provider).to_string());
    }
    Ok(launch_plan.admin_db_path)
}

fn resolve_deploy_target(project_dir: &Path, target: Option<&str>) -> Result<String, String> {
    if let Some(target) = target {
        return Ok(target.to_string());
    }

    Ok(load_project_launch_plan(project_dir, None, None, None)?.deploy_target)
}

fn load_project_scaffold(
    provider: LocalProvider,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
) -> Result<ProjectScaffold, String> {
    let scaffold_module = package_module_import("project-scaffold.js")?;
    let scaffold_module_literal =
        serde_json::to_string(&scaffold_module).map_err(|error| error.to_string())?;
    let script = format!(
        r#"import {{ createAstropressProjectScaffold }} from {module};

const scaffold = createAstropressProjectScaffold({{
  legacyProvider: "{provider}",
  appHost: {app_host},
  dataServices: {data_services}
}});
console.log(JSON.stringify(scaffold));
"#,
        module = scaffold_module_literal,
        provider = provider.as_str(),
        app_host = serde_json::to_string(&app_host.map(AppHost::as_str)).map_err(|error| error.to_string())?,
        data_services = serde_json::to_string(&data_services.map(DataServices::as_str)).map_err(|error| error.to_string())?
    );

    let output = ProcessCommand::new("node")
        .args(["--input-type=module", "--eval", &script])
        .output()
        .map_err(io_error)?;

    if !output.status.success() {
        return Err(format!(
            "Failed to load Astropress scaffold defaults: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    serde_json::from_slice::<ProjectScaffold>(&output.stdout).map_err(|error| error.to_string())
}

fn run_content_services_operation(
    project_dir: &Path,
    export_name: &str,
) -> Result<ContentServicesReport, String> {
    let module = package_module_import("content-services-ops.js")?;
    let module_literal = serde_json::to_string(&module).map_err(|error| error.to_string())?;
    let env_values = read_env_file(project_dir)?;
    let env_values_json = serde_json::to_string(&env_values).map_err(|error| error.to_string())?;
    let workspace_root = serde_json::to_string(&project_dir.display().to_string()).map_err(|error| error.to_string())?;
    let script = format!(
        r#"import {{ {export_name} }} from {module};
const envValues = {env_values};
const result = await {export_name}({{
  workspaceRoot: {workspace_root},
  env: envValues,
}});
console.log(JSON.stringify(result));
"#,
        export_name = export_name,
        module = module_literal,
        env_values = env_values_json,
        workspace_root = workspace_root,
    );
    run_package_json_command(project_dir, detect_package_manager(project_dir), &script)
}

fn seed_local_sqlite_database(
    project_dir: &Path,
    package_manager: PackageManager,
    provider: LocalProvider,
    db_path: &str,
) -> Result<(), String> {
    let script = r#"import { createDefaultAstropressSqliteSeedToolkit } from "astropress/sqlite-bootstrap";

const toolkit = createDefaultAstropressSqliteSeedToolkit();
const dbPath = process.env.ADMIN_DB_PATH ?? toolkit.getDefaultAdminDbPath(process.cwd());
toolkit.seedDatabase({ dbPath, workspaceRoot: process.cwd() });
console.log(`Seeded Astropress SQLite runtime at ${dbPath}`);
"#;

    let mut command = match package_manager {
        PackageManager::Bun => {
            let mut command = ProcessCommand::new("bun");
            command.args(["--eval", script]);
            command
        }
        PackageManager::Npm => {
            let mut command = ProcessCommand::new("node");
            command.args(["--input-type=module", "--eval", script]);
            command
        }
    };
    let status = command
        .current_dir(project_dir)
        .env("ASTROPRESS_LOCAL_PROVIDER", provider.as_str())
        .env("ADMIN_DB_PATH", db_path)
        .status()
        .map_err(io_error)?;

    if status.success() {
        Ok(())
    } else {
        Err("Local Astropress SQLite bootstrap failed.".into())
    }
}

fn scaffold_new_project(
    project_dir: &Path,
    use_local_package: bool,
    provider: LocalProvider,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
) -> Result<(), String> {
    if project_dir.exists() {
        let mut entries = fs::read_dir(project_dir).map_err(io_error)?;
        if entries.next().transpose().map_err(io_error)?.is_some() {
            return Err(format!(
                "Refusing to scaffold into `{}` because the directory is not empty.",
                project_dir.display()
            ));
        }
    } else {
        fs::create_dir_all(project_dir).map_err(io_error)?;
    }

    let template_dir = example_template_dir();
    copy_template_dir(&template_dir, project_dir)?;

    let mut manifest = read_package_manifest(project_dir)?;
    let fallback_name = project_dir
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("astropress-site");
    manifest.name = sanitize_package_name(fallback_name);
    manifest.dependencies.insert(
        "astropress".into(),
        if use_local_package {
            format!("file:{}", repo_root().join("packages").join("astropress").display())
        } else {
            format!("^{}", astropress_package_version()?)
        },
    );
    let scaffold = load_project_scaffold(provider, app_host, data_services)?;
    for (script_name, command) in &scaffold.package_scripts {
        manifest.scripts.insert(script_name.clone(), command.clone());
    }
    write_package_manifest(project_dir, &manifest)?;
    ensure_local_provider_defaults(project_dir)?;
    fs::write(project_dir.join(".env"), format_env_map(&scaffold.local_env)).map_err(io_error)?;
    fs::write(project_dir.join(".env.example"), format_env_map(&scaffold.env_example))
        .map_err(io_error)?;
    write_text_file(project_dir, "DEPLOY.md", &scaffold.deploy_doc)?;
    for (relative_path, contents) in &scaffold.ci_files {
        write_text_file(project_dir, relative_path, contents)?;
    }

    fs::write(
        project_dir.join(".gitignore"),
        ".astro/\ndist/\nnode_modules/\n.astropress/\n.env\n",
    )
    .map_err(io_error)?;

    println!("Scaffolded Astropress project at {}", project_dir.display());
    println!("Local provider: {}", scaffold.provider);
    println!("App host: {}", scaffold.app_host);
    println!("Content services: {}", scaffold.content_services);
    println!("Recommended deploy target: {}", scaffold.recommended_deploy_target);
    println!("Support level: {}", scaffold.support_level);
    println!("Recommendation: {}", scaffold.recommendation_rationale);
    if !scaffold.required_env_keys.is_empty() {
        println!("Required secrets and variables:");
        for key in &scaffold.required_env_keys {
            println!("  - {key}");
        }
    }
    println!("Next steps:");
    println!("  cd {}", project_dir.display());
    println!("  bun install");
    println!("  astropress dev");
    Ok(())
}

fn detect_package_manager(project_dir: &Path) -> PackageManager {
    if project_dir.join("bun.lock").exists() || command_available("bun") {
        PackageManager::Bun
    } else {
        PackageManager::Npm
    }
}

fn command_available(command: &str) -> bool {
    ProcessCommand::new(command)
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn install_dependencies_if_needed(project_dir: &Path, package_manager: PackageManager) -> Result<(), String> {
    if project_dir.join("node_modules").exists() {
        return Ok(());
    }

    let status = match package_manager {
        PackageManager::Bun => ProcessCommand::new("bun")
            .arg("install")
            .current_dir(project_dir)
            .status()
            .map_err(io_error)?,
        PackageManager::Npm => ProcessCommand::new("npm")
            .arg("install")
            .current_dir(project_dir)
            .status()
            .map_err(io_error)?,
    };

    if status.success() {
        Ok(())
    } else {
        Err("Dependency installation failed.".into())
    }
}

fn run_package_json_command<T: for<'de> Deserialize<'de>>(
    project_dir: &Path,
    package_manager: PackageManager,
    script: &str,
) -> Result<T, String> {
    let output = match package_manager {
        PackageManager::Bun => ProcessCommand::new("bun")
            .args(["--eval", script])
            .current_dir(project_dir)
            .output()
            .map_err(io_error)?,
        PackageManager::Npm => ProcessCommand::new("node")
            .args(["--input-type=module", "--eval", script])
            .current_dir(project_dir)
            .output()
            .map_err(io_error)?,
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(if detail.is_empty() {
            "Astropress package command failed.".into()
        } else {
            detail
        });
    }

    let stdout = String::from_utf8(output.stdout).map_err(|error| error.to_string())?;
    serde_json::from_str(stdout.trim()).map_err(|error| error.to_string())
}

fn package_module_import(module_path: &str) -> Result<String, String> {
    let full_path = repo_root().join("packages").join("astropress").join("src").join(module_path);
    let canonical = full_path.canonicalize().map_err(io_error)?;
    Ok(format!("file://{}", canonical.display()))
}

fn run_script(project_dir: &Path, script_name: &str) -> Result<ExitCode, String> {
    let package_manager = detect_package_manager(project_dir);
    install_dependencies_if_needed(project_dir, package_manager)?;

    let status = match package_manager {
        PackageManager::Bun => ProcessCommand::new("bun")
            .args(["run", script_name])
            .current_dir(project_dir)
            .status()
            .map_err(io_error)?,
        PackageManager::Npm => ProcessCommand::new("npm")
            .args(["run", script_name])
            .current_dir(project_dir)
            .status()
            .map_err(io_error)?,
    };

    Ok(ExitCode::from(status.code().unwrap_or(1) as u8))
}

fn run_dev_server(
    project_dir: &Path,
    provider: Option<LocalProvider>,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
) -> Result<ExitCode, String> {
    let package_manager = detect_package_manager(project_dir);
    let launch_plan = load_project_launch_plan(project_dir, provider, app_host, data_services)?;
    let runtime_plan = launch_plan.runtime;
    if runtime_plan.mode != "local" {
        return Err(format!(
            "Astropress dev currently supports only local runtime mode, but this project resolved to `{}` with adapter `{}`.",
            runtime_plan.mode, runtime_plan.adapter.capabilities.name
        ));
    }
    let provider = LocalProvider::parse(&launch_plan.provider)?;
    let admin_db_path = launch_plan.admin_db_path;
    install_dependencies_if_needed(project_dir, package_manager)?;
    ensure_local_provider_defaults(project_dir)?;
    if launch_plan.requires_local_seed {
        seed_local_sqlite_database(project_dir, package_manager, provider, &admin_db_path)?;
    }

    let mut command = match package_manager {
        PackageManager::Bun => {
            let mut command = ProcessCommand::new("bun");
            command.args(["run", "dev"]);
            command
        }
        PackageManager::Npm => {
            let mut command = ProcessCommand::new("npm");
            command.args(["run", "dev"]);
            command
        }
    };
    let status = command
        .current_dir(project_dir)
        .env("ASTROPRESS_LOCAL_PROVIDER", provider.as_str())
        .envs(
            app_host
                .map(|host| [("ASTROPRESS_APP_HOST", host.as_str())])
                .into_iter()
                .flatten(),
        )
        .envs(
            data_services
                .map(|services| [
                    ("ASTROPRESS_CONTENT_SERVICES", services.as_str()),
                    ("ASTROPRESS_DATA_SERVICES", services.as_str()),
                ])
                .into_iter()
                .flatten(),
        )
        .env("ADMIN_DB_PATH", &admin_db_path)
        .status()
        .map_err(io_error)?;

    Ok(ExitCode::from(status.code().unwrap_or(1) as u8))
}

fn now_unix_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn basename_or(value: Option<String>, fallback: &str) -> String {
    value.as_deref()
        .map(PathBuf::from)
        .and_then(|path| path.file_name().and_then(|value| value.to_str()).map(ToString::to_string))
        .unwrap_or_else(|| fallback.to_string())
}

fn stage_wordpress_import(
    project_dir: &Path,
    source_path: &Path,
    artifact_dir: Option<&Path>,
    download_media: bool,
    apply_local: bool,
    resume: bool,
) -> Result<(), String> {
    if !source_path.is_file() {
        return Err(format!(
            "WordPress export file was not found: {}",
            source_path.display()
        ));
    }

    let import_dir = artifact_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| project_dir.join(".astropress").join("import"));
    fs::create_dir_all(&import_dir).map_err(io_error)?;

    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("xml");
    let staged_source = import_dir.join(format!("wordpress-source.{extension}"));
    fs::copy(source_path, &staged_source).map_err(io_error)?;

    let package_manager = detect_package_manager(project_dir);
    let importer_module = package_module_import("import/wordpress.js")?;
    let local_provider = resolve_local_provider(project_dir, None)?;
    let admin_db_path = resolve_admin_db_path(project_dir, local_provider)?;
    let resolved_admin_db_path = {
        let candidate = PathBuf::from(&admin_db_path);
        if candidate.is_absolute() {
            candidate
        } else {
            project_dir.join(candidate)
        }
    };
    let script = format!(
        r#"import {{ createAstropressWordPressImportSource }} from {};
const importer = createAstropressWordPressImportSource();
const inventory = await importer.inspectWordPress({{ exportFile: {} }});
const plan = await importer.planWordPressImport({{
  inventory,
  artifactDir: {},
  downloadMedia: {},
  applyLocal: {},
}});
const result = await ({} ? importer.resumeWordPressImport({{
  exportFile: {},
  artifactDir: {},
  downloadMedia: {},
  applyLocal: {},
  workspaceRoot: {},
  adminDbPath: {},
}}) : importer.importWordPress({{
  exportFile: {},
  artifactDir: {},
  downloadMedia: {},
  applyLocal: {},
  workspaceRoot: {},
  adminDbPath: {},
  plan,
}}));
console.log(JSON.stringify({{
  status: result.status,
  imported_records: result.importedRecords,
  imported_media: result.importedMedia,
  imported_comments: result.importedComments,
  imported_users: result.importedUsers,
  imported_redirects: result.importedRedirects,
  downloaded_media: result.downloadedMedia,
  failed_media: result.failedMedia.map((entry) => ({{
    id: entry.id,
    source_url: entry.sourceUrl ?? null,
    reason: entry.reason,
  }})),
  review_required: result.reviewRequired,
  manual_tasks: result.manualTasks,
  inventory: {{
    detected_records: inventory.detectedRecords,
    detected_media: inventory.detectedMedia,
    detected_comments: inventory.detectedComments,
    detected_users: inventory.detectedUsers,
    detected_shortcodes: inventory.detectedShortcodes,
    detected_builder_markers: inventory.detectedBuilderMarkers,
    entity_counts: {{
      posts: inventory.entityCounts.posts,
      pages: inventory.entityCounts.pages,
      attachments: inventory.entityCounts.attachments,
      redirects: inventory.entityCounts.redirects,
      comments: inventory.entityCounts.comments,
      users: inventory.entityCounts.users,
      categories: inventory.entityCounts.categories,
      tags: inventory.entityCounts.tags,
      skipped: inventory.entityCounts.skipped,
    }},
    unsupported_patterns: inventory.unsupportedPatterns,
    remediation_candidates: inventory.remediationCandidates,
    warnings: inventory.warnings,
  }},
  plan: {{
    artifact_dir: plan.artifactDir ?? null,
    include_comments: plan.includeComments,
    include_users: plan.includeUsers,
    include_media: plan.includeMedia,
    download_media: plan.downloadMedia,
    apply_local: plan.applyLocal,
    permalink_strategy: plan.permalinkStrategy,
    resume_supported: plan.resumeSupported,
    entity_counts: {{
      posts: plan.entityCounts.posts,
      pages: plan.entityCounts.pages,
      attachments: plan.entityCounts.attachments,
      redirects: plan.entityCounts.redirects,
      comments: plan.entityCounts.comments,
      users: plan.entityCounts.users,
      categories: plan.entityCounts.categories,
      tags: plan.entityCounts.tags,
      skipped: plan.entityCounts.skipped,
    }},
    review_required: plan.reviewRequired,
    manual_tasks: plan.manualTasks,
  }},
  artifacts: result.artifacts ? {{
    artifact_dir: result.artifacts.artifactDir ?? null,
    inventory_file: result.artifacts.inventoryFile ?? null,
    plan_file: result.artifacts.planFile ?? null,
    content_file: result.artifacts.contentFile ?? null,
    media_file: result.artifacts.mediaFile ?? null,
    comment_file: result.artifacts.commentFile ?? null,
    user_file: result.artifacts.userFile ?? null,
    redirect_file: result.artifacts.redirectFile ?? null,
    taxonomy_file: result.artifacts.taxonomyFile ?? null,
    remediation_file: result.artifacts.remediationFile ?? null,
    download_state_file: result.artifacts.downloadStateFile ?? null,
    local_apply_report_file: result.artifacts.localApplyReportFile ?? null,
  }} : null,
  local_apply: result.localApply ? {{
    runtime: result.localApply.runtime,
    workspace_root: result.localApply.workspaceRoot,
    admin_db_path: result.localApply.adminDbPath,
    applied_records: result.localApply.appliedRecords,
    applied_media: result.localApply.appliedMedia,
    applied_comments: result.localApply.appliedComments,
    applied_users: result.localApply.appliedUsers,
    applied_redirects: result.localApply.appliedRedirects,
  }} : null,
  warnings: result.warnings,
}}));"#,
        serde_json::to_string(&importer_module).map_err(|error| error.to_string())?,
        serde_json::to_string(&staged_source.display().to_string()).map_err(|error| error.to_string())?,
        serde_json::to_string(&import_dir.display().to_string()).map_err(|error| error.to_string())?,
        serde_json::to_string(&download_media).map_err(|error| error.to_string())?,
        serde_json::to_string(&apply_local).map_err(|error| error.to_string())?,
        serde_json::to_string(&resume).map_err(|error| error.to_string())?,
        serde_json::to_string(&staged_source.display().to_string()).map_err(|error| error.to_string())?,
        serde_json::to_string(&import_dir.display().to_string()).map_err(|error| error.to_string())?,
        serde_json::to_string(&download_media).map_err(|error| error.to_string())?,
        serde_json::to_string(&apply_local).map_err(|error| error.to_string())?,
        serde_json::to_string(&project_dir.display().to_string()).map_err(|error| error.to_string())?,
        serde_json::to_string(&resolved_admin_db_path.display().to_string()).map_err(|error| error.to_string())?,
        serde_json::to_string(&staged_source.display().to_string()).map_err(|error| error.to_string())?,
        serde_json::to_string(&import_dir.display().to_string()).map_err(|error| error.to_string())?,
        serde_json::to_string(&download_media).map_err(|error| error.to_string())?,
        serde_json::to_string(&apply_local).map_err(|error| error.to_string())?,
        serde_json::to_string(&project_dir.display().to_string()).map_err(|error| error.to_string())?,
        serde_json::to_string(&resolved_admin_db_path.display().to_string()).map_err(|error| error.to_string())?
    );
    let result: WordPressImportResult = run_package_json_command(project_dir, package_manager, &script)?;
    let report_json = serde_json::to_string_pretty(&result).map_err(|error| error.to_string())?;
    let report_file = import_dir.join("wordpress.report.json");
    fs::write(&report_file, format!("{report_json}\n")).map_err(io_error)?;

    let manifest = WordPressImportManifest {
        source_file: staged_source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("source.xml")
            .to_string(),
        imported_at_unix_ms: now_unix_ms(),
        inventory_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.inventory_file.clone()),
            "wordpress.inventory.json",
        ),
        plan_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.plan_file.clone()),
            "wordpress.plan.json",
        ),
        report_file: report_file
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("wordpress.report.json")
            .to_string(),
        artifact_dir: import_dir.display().to_string(),
        content_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.content_file.clone()),
            "content-records.json",
        ),
        media_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.media_file.clone()),
            "media-manifest.json",
        ),
        comment_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.comment_file.clone()),
            "comment-records.json",
        ),
        user_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.user_file.clone()),
            "user-records.json",
        ),
        redirect_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.redirect_file.clone()),
            "redirect-records.json",
        ),
        taxonomy_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.taxonomy_file.clone()),
            "taxonomy-records.json",
        ),
        remediation_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.remediation_file.clone()),
            "remediation-candidates.json",
        ),
        download_state_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.download_state_file.clone()),
            "download-state.json",
        ),
        local_apply_report_file: basename_or(
            result
                .artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.local_apply_report_file.clone()),
            "",
        ),
    };

    let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    fs::write(import_dir.join("manifest.json"), format!("{manifest_json}\n")).map_err(io_error)?;

    println!(
        "Staged WordPress import artifacts in {}",
        import_dir.display()
    );
    println!(
        "Imported {} records, {} media references, {} comments, {} users, and {} redirects from {}",
        result.imported_records,
        result.imported_media,
        result.imported_comments,
        result.imported_users,
        result.imported_redirects,
        source_path.display()
    );
    println!(
        "Execution status: {} (downloaded {} media files)",
        result.status, result.downloaded_media
    );
    println!(
        "Detected {} shortcodes and {} builder markers",
        result.inventory.detected_shortcodes, result.inventory.detected_builder_markers
    );
    if result.review_required {
        println!("Manual review is required for this import.");
    }
    if let Some(local_apply) = result.local_apply {
        println!(
            "Applied import into {} at {}",
            local_apply.runtime, local_apply.admin_db_path
        );
    }
    if !result.warnings.is_empty() {
        println!("Warnings:");
        for warning in result.warnings {
            println!("  - {warning}");
        }
    }
    Ok(())
}

fn export_project_snapshot(project_dir: &Path, output_dir: Option<&Path>) -> Result<(), String> {
    let snapshot_dir = output_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| project_dir.join(".astropress").join("sync").join("latest"));
    let package_manager = detect_package_manager(project_dir);
    let sync_module = package_module_import("sync/git.js")?;
    let script = format!(
        r#"import {{ createAstropressGitSyncAdapter }} from {};
const sync = createAstropressGitSyncAdapter({{ projectDir: process.cwd() }});
const result = await sync.exportSnapshot({});
console.log(JSON.stringify({{
  target_dir: result.targetDir,
  file_count: result.fileCount,
}}));"#,
        serde_json::to_string(&sync_module).map_err(|error| error.to_string())?,
        serde_json::to_string(&snapshot_dir.display().to_string()).map_err(|error| error.to_string())?
    );
    let result: SnapshotResult = run_package_json_command(project_dir, package_manager, &script)?;
    println!(
        "Exported Astropress snapshot to {} ({} files)",
        result
            .target_dir
            .as_deref()
            .unwrap_or_else(|| snapshot_dir.to_str().unwrap_or("unknown")),
        result.file_count
    );
    Ok(())
}

fn import_project_snapshot(project_dir: &Path, input_dir: &Path) -> Result<(), String> {
    if !input_dir.exists() {
        return Err(format!("Snapshot directory was not found: {}", input_dir.display()));
    }
    let package_manager = detect_package_manager(project_dir);
    let sync_module = package_module_import("sync/git.js")?;
    let script = format!(
        r#"import {{ createAstropressGitSyncAdapter }} from {};
const sync = createAstropressGitSyncAdapter({{ projectDir: process.cwd() }});
const result = await sync.importSnapshot({});
console.log(JSON.stringify({{
  source_dir: result.sourceDir,
  file_count: result.fileCount,
}}));"#,
        serde_json::to_string(&sync_module).map_err(|error| error.to_string())?,
        serde_json::to_string(&input_dir.display().to_string()).map_err(|error| error.to_string())?
    );
    let result: SnapshotResult = run_package_json_command(project_dir, package_manager, &script)?;
    println!(
        "Imported Astropress snapshot from {} into {} ({} files)",
        result
            .source_dir
            .as_deref()
            .unwrap_or_else(|| input_dir.to_str().unwrap_or("unknown")),
        project_dir.display(),
        result.file_count
    );
    Ok(())
}

fn inspect_project_health(project_dir: &Path) -> Result<DoctorReport, String> {
    let env_values = read_env_file(project_dir)?;
    let env_contract = load_project_env_contract(project_dir)?;
    let launch_plan = load_project_launch_plan(project_dir, None, None, None)?;
    let mut warnings = Vec::new();

    if env_values.is_empty() {
        warnings.push("No .env file was found; Astropress is relying entirely on package defaults.".into());
    }

    if env_values
        .get("SESSION_SECRET")
        .is_none_or(|value| value.trim().is_empty())
    {
        warnings.push("SESSION_SECRET is missing or empty.".into());
    } else if env_values
        .get("SESSION_SECRET")
        .is_some_and(|value| value.trim().len() < 24)
    {
        warnings.push("SESSION_SECRET is present but shorter than 24 characters.".into());
    }

    if env_values
        .get("ADMIN_PASSWORD")
        .is_none_or(|value| value.trim().is_empty())
    {
        warnings.push("ADMIN_PASSWORD is missing or empty.".into());
    } else if env_values
        .get("ADMIN_PASSWORD")
        .is_some_and(|value| value.starts_with("local-admin-"))
    {
        warnings.push("ADMIN_PASSWORD still uses the scaffold-style local default.".into());
    }

    if env_values
        .get("EDITOR_PASSWORD")
        .is_none_or(|value| value.trim().is_empty())
    {
        warnings.push("EDITOR_PASSWORD is missing or empty.".into());
    } else if env_values
        .get("EDITOR_PASSWORD")
        .is_some_and(|value| value.starts_with("local-editor-"))
    {
        warnings.push("EDITOR_PASSWORD still uses the scaffold-style local default.".into());
    }

    if env_values
        .get("ADMIN_BOOTSTRAP_DISABLED")
        .is_none_or(|value| value.trim() != "1")
    {
        warnings.push("ADMIN_BOOTSTRAP_DISABLED is not set to `1`; bootstrap passwords remain available.".into());
    }

    if launch_plan.runtime.mode != "local"
        && env_values
            .get("TURNSTILE_SECRET_KEY")
            .is_none_or(|value| value.trim().is_empty())
    {
        warnings.push("TURNSTILE_SECRET_KEY is missing for a hosted runtime plan.".into());
    }

    if !env_values.contains_key("ASTROPRESS_APP_HOST") {
        warnings.push(
            "ASTROPRESS_APP_HOST is not set; this project is still relying on legacy deploy-target/provider inference.".into(),
        );
    }

    if !env_values.contains_key("ASTROPRESS_CONTENT_SERVICES") && !env_values.contains_key("ASTROPRESS_DATA_SERVICES") {
        warnings.push(
            "ASTROPRESS_CONTENT_SERVICES is not set; this project is still relying on legacy provider inference.".into(),
        );
    }

    for (legacy_key, replacement) in [
        ("ASTROPRESS_DATA_SERVICES", "ASTROPRESS_CONTENT_SERVICES"),
        ("ASTROPRESS_BACKEND_PLATFORM", "ASTROPRESS_CONTENT_SERVICES"),
        ("ASTROPRESS_HOSTED_PROVIDER", "ASTROPRESS_CONTENT_SERVICES"),
        ("ASTROPRESS_DEPLOY_TARGET", "ASTROPRESS_APP_HOST"),
    ] {
        if env_values.contains_key(legacy_key) {
            warnings.push(format!(
                "{legacy_key} is deprecated. Migrate this project to `{replacement}` with `astropress config migrate`."
            ));
        }
    }

    if env_contract.content_services != "none"
        && env_contract
            .service_origin
            .as_ref()
            .is_none_or(|value| value.trim().is_empty())
    {
        warnings.push(format!(
            "ASTROPRESS_SERVICE_ORIGIN is missing for Content Services `{}`.",
            env_contract.content_services
        ));
    }

    match deployment_support_level(&env_contract.app_host, &env_contract.data_services) {
        "preview" => warnings.push(format!(
            "The selected App Host + Content Services pair ({} + {}) is currently documented as preview.",
            env_contract.app_host, env_contract.data_services
        )),
        "unsupported" => warnings.push(format!(
            "The selected App Host + Content Services pair ({} + {}) is not a first-party supported Astropress combination yet.",
            env_contract.app_host, env_contract.data_services
        )),
        _ => {}
    }

    if env_contract.content_services != "none"
        && env_contract.content_services != "cloudflare"
        && env_contract.content_services != "supabase"
        && env_contract.content_services != "runway"
        && env_contract.content_services != "firebase"
        && env_contract.content_services != "appwrite"
    {
        warnings.push(format!(
            "Content Services are set to `{}`, but Astropress does not yet provide a first-party runtime adapter for that service layer.",
            env_contract.content_services
        ));
    }

    if launch_plan.runtime.mode == "local" {
        let data_dir = project_dir.join(".data");
        if !data_dir.exists() {
            warnings.push(format!(
                "Local runtime expects a `.data` directory, but {} does not exist.",
                data_dir.display()
            ));
        }

        let admin_db_path = project_dir.join(&launch_plan.admin_db_path);
        if let Some(parent) = admin_db_path.parent() {
            if !parent.exists() {
                warnings.push(format!(
                    "The admin database directory {} does not exist yet.",
                    parent.display()
                ));
            }
        }
    }

    Ok(DoctorReport {
        project_dir: project_dir.to_path_buf(),
        env_contract,
        launch_plan,
        warnings,
    })
}

fn bootstrap_content_services(project_dir: &Path) -> Result<(), String> {
    let report = run_content_services_operation(project_dir, "bootstrapAstropressContentServices")?;
    print_content_services_report(&report);
    Ok(())
}

fn verify_content_services(project_dir: &Path) -> Result<ContentServicesReport, String> {
    run_content_services_operation(project_dir, "verifyAstropressContentServices")
}

fn print_content_services_report(report: &ContentServicesReport) {
    println!("Astropress content services report");
    println!("Content services: {}", report.content_services);
    println!("Status: {}", report.support_level);
    println!(
        "Service origin: {}",
        report.service_origin.as_deref().unwrap_or("not set")
    );
    if let Some(manifest_file) = &report.manifest_file {
        println!("Manifest: {manifest_file}");
    }
    if !report.required_env_keys.is_empty() {
        println!("Required keys:");
        for key in &report.required_env_keys {
            println!("  - {key}");
        }
    }
    if !report.missing_env_keys.is_empty() {
        println!("Missing keys:");
        for key in &report.missing_env_keys {
            println!("  - {key}");
        }
    }
}

fn print_doctor_report(report: &DoctorReport) {
    println!("Astropress doctor report");
    println!("Project: {}", report.project_dir.display());
    println!("Runtime mode: {}", report.launch_plan.runtime.mode);
    println!("Runtime adapter: {}", report.launch_plan.runtime.adapter.capabilities.name);
    println!("App host: {}", report.launch_plan.app_host);
    println!("Content services: {}", report.launch_plan.data_services);
    println!(
        "Pair support: {}",
        deployment_support_level(&report.launch_plan.app_host, &report.launch_plan.data_services)
    );
    println!("Local provider: {}", report.env_contract.local_provider);
    println!("Hosted provider: {}", report.env_contract.hosted_provider);
    println!(
        "Service origin: {}",
        report
            .env_contract
            .service_origin
            .as_deref()
            .unwrap_or("not set")
    );
    println!("Deploy target: {}", report.launch_plan.deploy_target);
    println!("Admin DB path: {}", report.launch_plan.admin_db_path);

    if report.warnings.is_empty() {
        println!("Warnings: none");
        return;
    }

    println!("Warnings:");
    for warning in &report.warnings {
        println!("  - {warning}");
    }
}

fn deploy_script_for_target(
    manifest: &PackageManifest,
    explicit_target: Option<&str>,
) -> Result<&'static str, String> {
    let target = explicit_target.unwrap_or("github-pages");
    match target {
        "github-pages" => {
            if manifest.scripts.contains_key("build") {
                Ok("build")
            } else {
                Err("The project does not define a `build` script.".into())
            }
        }
        "vercel" => {
            if manifest.scripts.contains_key("deploy:vercel") {
                Ok("deploy:vercel")
            } else if manifest.scripts.contains_key("build") {
                Ok("build")
            } else {
                Err("The project does not define a Vercel deploy or build script.".into())
            }
        }
        "netlify" => {
            if manifest.scripts.contains_key("deploy:netlify") {
                Ok("deploy:netlify")
            } else if manifest.scripts.contains_key("build") {
                Ok("build")
            } else {
                Err("The project does not define a Netlify deploy or build script.".into())
            }
        }
        "render-static" => {
            if manifest.scripts.contains_key("deploy:render-static") {
                Ok("deploy:render-static")
            } else if manifest.scripts.contains_key("build") {
                Ok("build")
            } else {
                Err("The project does not define a Render Static deploy or build script.".into())
            }
        }
        "render-web" => {
            if manifest.scripts.contains_key("deploy:render-web") {
                Ok("deploy:render-web")
            } else if manifest.scripts.contains_key("build") {
                Ok("build")
            } else {
                Err("The project does not define a Render Web deploy or build script.".into())
            }
        }
        "gitlab-pages" => {
            if manifest.scripts.contains_key("deploy:gitlab-pages") {
                Ok("deploy:gitlab-pages")
            } else if manifest.scripts.contains_key("build") {
                Ok("build")
            } else {
                Err("The project does not define a GitLab Pages deploy or build script.".into())
            }
        }
        "firebase-hosting" => {
            if manifest.scripts.contains_key("deploy:firebase-hosting") {
                Ok("deploy:firebase-hosting")
            } else if manifest.scripts.contains_key("build") {
                Ok("build")
            } else {
                Err("The project does not define a Firebase Hosting deploy or build script.".into())
            }
        }
        "custom" => {
            if manifest.scripts.contains_key("deploy:custom") {
                Ok("deploy:custom")
            } else if manifest.scripts.contains_key("build") {
                Ok("build")
            } else {
                Err("The project does not define a `build` script.".into())
            }
        }
        "cloudflare" => {
            if manifest.scripts.contains_key("build:cloudflare-production") {
                Ok("build:cloudflare-production")
            } else if manifest.scripts.contains_key("build:cloudflare-repro") {
                Ok("build:cloudflare-repro")
            } else {
                Err("The project does not define a Cloudflare build script.".into())
            }
        }
        "supabase" => {
            if manifest.scripts.contains_key("deploy:supabase") {
                Ok("deploy:supabase")
            } else {
                Err("The project does not define a `deploy:supabase` script.".into())
            }
        }
        "runway" => {
            if manifest.scripts.contains_key("deploy:runway") {
                Ok("deploy:runway")
            } else {
                Err("The project does not define a `deploy:runway` script.".into())
            }
        }
        other => Err(format!(
            "Unsupported deploy target `{other}`. Use github-pages, cloudflare, vercel, netlify, render-static, render-web, gitlab-pages, firebase-hosting, runway, or custom."
        )),
    }
}

fn deploy_project(
    project_dir: &Path,
    target: Option<&str>,
    app_host: Option<AppHost>,
) -> Result<ExitCode, String> {
    let manifest = read_package_manifest(project_dir)?;
    if manifest.scripts.contains_key("doctor:strict") {
        let doctor_exit = run_script(project_dir, "doctor:strict")?;
        if doctor_exit != ExitCode::SUCCESS {
            return Ok(doctor_exit);
        }
    }
    let selected_target = if let Some(app_host) = app_host {
        app_host.deploy_target().to_string()
    } else {
        resolve_deploy_target(project_dir, target)?
    };
    let script = deploy_script_for_target(&manifest, Some(&selected_target))?;
    let build_exit = run_script(project_dir, script)?;
    if build_exit != ExitCode::SUCCESS {
        return Ok(build_exit);
    }

    let package_manager = detect_package_manager(project_dir);
    let (module_path, export_name) = match selected_target.as_str() {
        "github-pages" => ("deploy/github-pages.js", "createAstropressGitHubPagesDeployTarget"),
        "cloudflare" => ("deploy/cloudflare-pages.js", "createAstropressCloudflarePagesDeployTarget"),
        "vercel" => ("deploy/vercel.js", "createAstropressVercelDeployTarget"),
        "netlify" => ("deploy/netlify.js", "createAstropressNetlifyDeployTarget"),
        "render-static" | "render-web" => ("deploy/render.js", "createAstropressRenderDeployTarget"),
        "gitlab-pages" => ("deploy/gitlab-pages.js", "createAstropressGitLabPagesDeployTarget"),
        "firebase-hosting" => ("deploy/firebase-hosting.js", "createAstropressFirebaseHostingDeployTarget"),
        "runway" | "custom" => ("deploy/custom.js", "createAstropressCustomDeployTarget"),
        _ => ("deploy/custom.js", "createAstropressCustomDeployTarget"),
    };
    let deploy_module = package_module_import(module_path)?;
    let deploy_script = format!(
        r#"import {{ {export_name} }} from {module};
const target = {export_name}({{
  kind: {kind},
  provider: {provider},
}});
const result = await target.deploy({{
  buildDir: new URL("./dist", `file://${{process.cwd()}}/`).pathname,
  projectName: process.cwd().split(/[/\\]/).filter(Boolean).at(-1) ?? "astropress-site",
}});
console.log(JSON.stringify({{
  deployment_id: result.deploymentId ?? null,
  url: result.url ?? null,
}}));"#,
        export_name = export_name,
        module = serde_json::to_string(&deploy_module).map_err(|error| error.to_string())?,
        kind = serde_json::to_string(&selected_target).map_err(|error| error.to_string())?,
        provider = serde_json::to_string(&selected_target).map_err(|error| error.to_string())?,
    );
    let result: DeployResult = run_package_json_command(project_dir, package_manager, &deploy_script)?;
    if let Some(url) = result.url {
        println!("Prepared `{selected_target}` deployment at {url}");
    } else if let Some(deployment_id) = result.deployment_id {
        println!("Prepared `{selected_target}` deployment {deployment_id}");
    }

    Ok(ExitCode::SUCCESS)
}

fn io_error(error: io::Error) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::{
        AppHost, DataServices,
        command_available, default_admin_db_relative_path, deploy_script_for_target,
        bootstrap_content_services, ensure_local_provider_defaults, export_project_snapshot, import_project_snapshot, inspect_project_health,
        load_project_env_contract, load_project_runtime_plan, migrate_project_config, parse_command, read_env_file,
        resolve_admin_db_path, resolve_local_provider, resolve_deploy_target, sanitize_package_name,
        scaffold_new_project, stage_wordpress_import, verify_content_services, Command, LocalProvider, PackageManifest,
    };
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
        scaffold_new_project(&project_dir, true, LocalProvider::Supabase, None, None).unwrap();

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
        assert!(env_contents.contains("ADMIN_PASSWORD=local-admin-"));
        assert!(env_contents.contains("EDITOR_PASSWORD=local-editor-"));
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

        stage_wordpress_import(&project_dir, &source, None, true, false, false).unwrap();
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
