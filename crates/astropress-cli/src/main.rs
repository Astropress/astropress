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
        }) => match scaffold_new_project(&project_dir, use_local_package, provider) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => fail(error),
        },
        Ok(Command::Dev {
            project_dir,
            provider,
        }) => match run_dev_server(&project_dir, provider) {
            Ok(code) => code,
            Err(error) => fail(error),
        },
        Ok(Command::ImportWordPress {
            project_dir,
            source_path,
        }) => match stage_wordpress_import(&project_dir, &source_path) {
            Ok(()) => ExitCode::SUCCESS,
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
        Ok(Command::Deploy {
            project_dir,
            target,
        }) => match deploy_project(&project_dir, target.as_deref()) {
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
    },
    Dev {
        project_dir: PathBuf,
        provider: Option<LocalProvider>,
    },
    ImportWordPress {
        project_dir: PathBuf,
        source_path: PathBuf,
    },
    SyncExport {
        project_dir: PathBuf,
        output_dir: Option<PathBuf>,
    },
    SyncImport {
        project_dir: PathBuf,
        input_dir: PathBuf,
    },
    Deploy {
        project_dir: PathBuf,
        target: Option<String>,
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
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportInventory {
    detected_records: usize,
    detected_media: usize,
    detected_comments: usize,
    detected_users: usize,
    warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportPlan {
    include_comments: bool,
    include_users: bool,
    include_media: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct WordPressImportResult {
    imported_records: usize,
    imported_media: usize,
    imported_comments: usize,
    imported_users: usize,
    inventory: WordPressImportInventory,
    plan: WordPressImportPlan,
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
    #[serde(rename = "recommendedDeployTarget")]
    recommended_deploy_target: String,
    #[serde(rename = "recommendationRationale")]
    recommendation_rationale: String,
    #[serde(rename = "localEnv")]
    local_env: BTreeMap<String, String>,
    #[serde(rename = "envExample")]
    env_example: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct ProjectEnvContract {
    #[serde(rename = "localProvider")]
    local_provider: String,
    #[serde(rename = "hostedProvider")]
    hosted_provider: String,
    #[serde(rename = "deployTarget")]
    deploy_target: String,
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

fn parse_command(args: &[String]) -> Result<Command, String> {
    match args {
        [] => Ok(Command::Help),
        [flag] if flag == "--help" || flag == "-h" || flag == "help" => Ok(Command::Help),
        [command, rest @ ..] if command == "new" => parse_new_command(rest),
        [command, rest @ ..] if command == "dev" => parse_dev_command(rest),
        [command, subcommand, rest @ ..] if command == "import" && subcommand == "wordpress" => {
            parse_import_wordpress_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "sync" && subcommand == "export" => {
            parse_sync_export_command(rest)
        }
        [command, subcommand, rest @ ..] if command == "sync" && subcommand == "import" => {
            parse_sync_import_command(rest)
        }
        [command, rest @ ..] if command == "deploy" => parse_deploy_command(rest),
        [command, ..] if command == "import" => {
            Err("Unsupported import source. Only `astropress import wordpress` is available.".into())
        }
        [command, ..] if command == "sync" => {
            Err("Unsupported sync subcommand. Use `astropress sync export` or `astropress sync import`.".into())
        }
        [command, ..] => Err(format!("Unsupported astropress command: `{command}`.")),
    }
}

fn parse_new_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = PathBuf::from("astropress-site");
    let mut use_local_package = true;
    let mut provider = LocalProvider::Sqlite;
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
    })
}

fn parse_dev_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut provider = None;
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
            value if value.starts_with("--") => {
                return Err(format!("Unsupported astropress dev option: `{value}`."));
            }
            value => {
                if positional_project_dir.is_some() {
                    return Err("Usage: `astropress dev [project-dir] [--provider sqlite|supabase|runway]`.".into());
                }
                positional_project_dir = Some(PathBuf::from(value));
            }
        }
        index += 1;
    }

    Ok(Command::Dev {
        project_dir: positional_project_dir.unwrap_or_else(|| std::mem::take(&mut project_dir)),
        provider,
    })
}

fn parse_import_wordpress_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut source_path: Option<PathBuf> = None;
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
    })
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

fn parse_deploy_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut target = None;
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
            other => return Err(format!("Unsupported astropress deploy option: `{other}`.")),
        }
        index += 1;
    }

    Ok(Command::Deploy { project_dir, target })
}

fn print_help() {
    println!("astropress-cli");
    println!("Commands:");
    println!("  astropress new [project-dir] [--provider sqlite|supabase|runway] [--use-local-package|--use-published-package]");
    println!("  astropress dev [project-dir] [--provider sqlite|supabase|runway]");
    println!("  astropress import wordpress --source <export.xml> [--project-dir <dir>]");
    println!("  astropress sync export [--project-dir <dir>] [--out <snapshot-dir>]");
    println!("  astropress sync import --from <snapshot-dir> [--project-dir <dir>]");
    println!("  astropress deploy [--project-dir <dir>] [--target github-pages|cloudflare|supabase|runway]");
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

fn read_env_file(project_dir: &Path) -> Result<BTreeMap<String, String>, String> {
    let env_path = project_dir.join(".env");
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
) -> Result<ProjectRuntimePlan, String> {
    let runtime_module = package_module_import("project-runtime.js")?;
    let runtime_module_literal =
        serde_json::to_string(&runtime_module).map_err(|error| error.to_string())?;
    let env_values = read_env_file(project_dir)?;
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
) -> Result<ProjectLaunchPlan, String> {
    let launch_module = package_module_import("project-launch.js")?;
    let launch_module_literal =
        serde_json::to_string(&launch_module).map_err(|error| error.to_string())?;
    let env_values = read_env_file(project_dir)?;
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

    LocalProvider::parse(&load_project_launch_plan(project_dir, None)?.provider)
}

fn resolve_admin_db_path(project_dir: &Path, provider: LocalProvider) -> Result<String, String> {
    let launch_plan = load_project_launch_plan(project_dir, Some(provider))?;
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

    Ok(load_project_launch_plan(project_dir, None)?.deploy_target)
}

fn load_project_scaffold(provider: LocalProvider) -> Result<ProjectScaffold, String> {
    let scaffold_module = package_module_import("project-scaffold.js")?;
    let scaffold_module_literal =
        serde_json::to_string(&scaffold_module).map_err(|error| error.to_string())?;
    let script = format!(
        r#"import {{ createAstropressProjectScaffold }} from {module};

const scaffold = createAstropressProjectScaffold("{provider}");
console.log(JSON.stringify(scaffold));
"#,
        module = scaffold_module_literal,
        provider = provider.as_str()
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
    write_package_manifest(project_dir, &manifest)?;
    ensure_local_provider_defaults(project_dir)?;
    let scaffold = load_project_scaffold(provider)?;
    fs::write(project_dir.join(".env"), format_env_map(&scaffold.local_env)).map_err(io_error)?;
    fs::write(project_dir.join(".env.example"), format_env_map(&scaffold.env_example))
        .map_err(io_error)?;

    fs::write(
        project_dir.join(".gitignore"),
        ".astro/\ndist/\nnode_modules/\n.astropress/\n",
    )
    .map_err(io_error)?;

    println!("Scaffolded Astropress project at {}", project_dir.display());
    println!("Local provider: {}", scaffold.provider);
    println!(
        "Recommended deploy target: {}",
        scaffold.recommended_deploy_target
    );
    println!("Recommendation: {}", scaffold.recommendation_rationale);
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

fn run_dev_server(project_dir: &Path, provider: Option<LocalProvider>) -> Result<ExitCode, String> {
    let package_manager = detect_package_manager(project_dir);
    let launch_plan = load_project_launch_plan(project_dir, provider)?;
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

fn stage_wordpress_import(project_dir: &Path, source_path: &Path) -> Result<(), String> {
    if !source_path.is_file() {
        return Err(format!(
            "WordPress export file was not found: {}",
            source_path.display()
        ));
    }

    let import_dir = project_dir.join(".astropress").join("import");
    fs::create_dir_all(&import_dir).map_err(io_error)?;

    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("xml");
    let staged_source = import_dir.join(format!("wordpress-source.{extension}"));
    fs::copy(source_path, &staged_source).map_err(io_error)?;

    let package_manager = detect_package_manager(project_dir);
    let importer_module = package_module_import("import/wordpress.js")?;
    let script = format!(
        r#"import {{ createAstropressWordPressImportSource }} from {};
const importer = createAstropressWordPressImportSource();
const inventory = await importer.inspectWordPress({{ exportFile: {} }});
const result = await importer.importWordPress({{ exportFile: {} }});
console.log(JSON.stringify({{
  imported_records: result.importedRecords,
  imported_media: result.importedMedia,
  imported_comments: result.importedComments,
  imported_users: result.importedUsers,
  inventory: {{
    detected_records: inventory.detectedRecords,
    detected_media: inventory.detectedMedia,
    detected_comments: inventory.detectedComments,
    detected_users: inventory.detectedUsers,
    warnings: inventory.warnings,
  }},
  plan: {{
    include_comments: result.plan.includeComments,
    include_users: result.plan.includeUsers,
    include_media: result.plan.includeMedia,
  }},
  warnings: result.warnings,
}}));"#,
        serde_json::to_string(&importer_module).map_err(|error| error.to_string())?,
        serde_json::to_string(&staged_source.display().to_string()).map_err(|error| error.to_string())?,
        serde_json::to_string(&staged_source.display().to_string()).map_err(|error| error.to_string())?
    );
    let result: WordPressImportResult = run_package_json_command(project_dir, package_manager, &script)?;

    let inventory_json =
        serde_json::to_string_pretty(&result.inventory).map_err(|error| error.to_string())?;
    let plan_json = serde_json::to_string_pretty(&result.plan).map_err(|error| error.to_string())?;
    let report_json =
        serde_json::to_string_pretty(&result).map_err(|error| error.to_string())?;
    let inventory_file = import_dir.join("wordpress.inventory.json");
    let plan_file = import_dir.join("wordpress.plan.json");
    let report_file = import_dir.join("wordpress.report.json");
    fs::write(&inventory_file, format!("{inventory_json}\n")).map_err(io_error)?;
    fs::write(&plan_file, format!("{plan_json}\n")).map_err(io_error)?;
    fs::write(&report_file, format!("{report_json}\n")).map_err(io_error)?;

    let manifest = WordPressImportManifest {
        source_file: staged_source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("source.xml")
            .to_string(),
        imported_at_unix_ms: now_unix_ms(),
        inventory_file: inventory_file
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("wordpress.inventory.json")
            .to_string(),
        plan_file: plan_file
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("wordpress.plan.json")
            .to_string(),
        report_file: report_file
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("wordpress.report.json")
            .to_string(),
    };

    let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    fs::write(import_dir.join("manifest.json"), format!("{manifest_json}\n")).map_err(io_error)?;

    println!(
        "Staged WordPress import artifacts in {}",
        import_dir.display()
    );
    println!(
        "Imported {} records, {} media references, {} comments, and {} users from {}",
        result.imported_records,
        result.imported_media,
        result.imported_comments,
        result.imported_users,
        source_path.display()
    );
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
            "Unsupported deploy target `{other}`. Use github-pages, cloudflare, supabase, or runway."
        )),
    }
}

fn deploy_project(project_dir: &Path, target: Option<&str>) -> Result<ExitCode, String> {
    let manifest = read_package_manifest(project_dir)?;
    let selected_target = resolve_deploy_target(project_dir, target)?;
    let script = deploy_script_for_target(&manifest, Some(&selected_target))?;
    let build_exit = run_script(project_dir, script)?;
    if build_exit != ExitCode::SUCCESS {
        return Ok(build_exit);
    }

    if selected_target == "github-pages" {
        let package_manager = detect_package_manager(project_dir);
        let deploy_module = package_module_import("deploy/github-pages.js")?;
        let deploy_script = format!(
            r#"import {{ createAstropressGitHubPagesDeployTarget }} from {};
const target = createAstropressGitHubPagesDeployTarget();
const result = await target.deploy({{
  buildDir: new URL("./dist", `file://${{process.cwd()}}/`).pathname,
  projectName: process.cwd().split(/[/\\]/).filter(Boolean).at(-1) ?? "astropress-site",
}});
console.log(JSON.stringify({{
  deployment_id: result.deploymentId ?? null,
  url: result.url ?? null,
}}));"#,
            serde_json::to_string(&deploy_module).map_err(|error| error.to_string())?
        );
        let result: DeployResult = run_package_json_command(project_dir, package_manager, &deploy_script)?;
        if let Some(url) = result.url {
            println!("Deployed GitHub Pages build to {url}");
        } else if let Some(deployment_id) = result.deployment_id {
            println!("Prepared GitHub Pages deployment {deployment_id}");
        }
    }

    Ok(ExitCode::SUCCESS)
}

fn io_error(error: io::Error) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::{
        command_available, default_admin_db_relative_path, deploy_script_for_target,
        ensure_local_provider_defaults, export_project_snapshot, import_project_snapshot, load_project_env_contract,
        load_project_runtime_plan, parse_command, read_env_file, resolve_admin_db_path, resolve_local_provider,
        resolve_deploy_target, sanitize_package_name, scaffold_new_project, stage_wordpress_import, Command,
        LocalProvider, PackageManifest,
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
            parse_command(&strings(&["new", "demo", "--provider", "supabase"])),
            Ok(Command::New {
                provider: LocalProvider::Supabase,
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
            parse_command(&strings(&["deploy", "--target", "cloudflare"])),
            Ok(Command::Deploy { .. })
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
        scaffold_new_project(&project_dir, true, LocalProvider::Supabase).unwrap();

        let package_json = fs::read_to_string(project_dir.join("package.json")).unwrap();
        assert!(package_json.contains("\"name\": \"demo\""));
        assert!(package_json.contains("\"astropress\": \"file:"));
        let env_contents = fs::read_to_string(project_dir.join(".env")).unwrap();
        assert!(env_contents.contains("ASTROPRESS_LOCAL_PROVIDER=supabase"));
        assert!(env_contents.contains(&format!(
            "ADMIN_DB_PATH={}",
            default_admin_db_relative_path(LocalProvider::Supabase)
        )));
        assert!(env_contents.contains("ADMIN_PASSWORD=fleet-test-admin-password"));
        assert!(env_contents.contains("EDITOR_PASSWORD=fleet-test-editor-password"));
        let env_example = fs::read_to_string(project_dir.join(".env.example")).unwrap();
        assert!(env_example.contains("SUPABASE_URL=https://your-project.supabase.co"));
        assert!(env_example.contains("SUPABASE_ANON_KEY=replace-me"));
        assert!(env_example.contains("SUPABASE_SERVICE_ROLE_KEY=replace-me"));
        assert!(project_dir.join(".data/.gitkeep").exists());
        assert!(project_dir.join("src/pages/index.astro").exists());
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
        assert_eq!(project_env.hosted_provider, "supabase");
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
    fn project_runtime_plan_exposes_local_runtime_selection() {
        let root = temp_dir("project-runtime");
        fs::write(
            root.join(".env"),
            "ASTROPRESS_RUNTIME_MODE=local\nASTROPRESS_LOCAL_PROVIDER=supabase\nADMIN_DB_PATH=.data/local-supabase.sqlite\n",
        )
        .unwrap();

        let plan = load_project_runtime_plan(&root, None).unwrap();
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

        assert_eq!(resolve_deploy_target(&root, None).unwrap(), "supabase");
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

        stage_wordpress_import(&project_dir, &source).unwrap();
        assert!(project_dir.join(".astropress/import/wordpress-source.xml").exists());
        let manifest = fs::read_to_string(project_dir.join(".astropress/import/manifest.json")).unwrap();
        assert!(manifest.contains("\"inventory_file\": \"wordpress.inventory.json\""));
        assert!(manifest.contains("\"report_file\": \"wordpress.report.json\""));
        let report = fs::read_to_string(project_dir.join(".astropress/import/wordpress.report.json")).unwrap();
        assert!(report.contains("\"imported_records\": 0"));
        assert!(report.contains("\"imported_media\": 0"));
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
}
