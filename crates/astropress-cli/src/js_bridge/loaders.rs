use std::collections::BTreeMap;
use std::path::Path;
use std::process::Command as ProcessCommand;

use serde::{Deserialize, Serialize};
use url::Url;

use crate::providers::{AppHost, DataServices, LocalProvider};
use crate::cli_config::env::{merge_env_overrides, read_env_file};
use crate::js_bridge::runner::{detect_package_manager, run_package_json_command};
use crate::features::DonationChoices;

#[derive(Debug, Deserialize)]
pub(crate) struct ProjectScaffold {
    #[serde(rename = "appHost")]
    pub(crate) app_host: String,
    #[serde(rename = "contentServices")]
    pub(crate) content_services: String,
    #[serde(rename = "localEnv")]
    pub(crate) local_env: BTreeMap<String, String>,
    #[serde(rename = "envExample")]
    pub(crate) env_example: BTreeMap<String, String>,
    #[serde(rename = "packageScripts")]
    pub(crate) package_scripts: BTreeMap<String, String>,
    #[serde(rename = "ciFiles")]
    pub(crate) ci_files: BTreeMap<String, String>,
    #[serde(rename = "deployDoc")]
    pub(crate) deploy_doc: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ProjectEnvContract {
    #[serde(rename = "localProvider")]
    pub(crate) local_provider: String,
    #[serde(rename = "hostedProvider")]
    pub(crate) hosted_provider: String,
    #[serde(rename = "deployTarget")]
    #[allow(dead_code)] // read in integration tests
    pub(crate) deploy_target: String,
    #[serde(rename = "appHost")]
    pub(crate) app_host: String,
    #[serde(rename = "dataServices")]
    pub(crate) data_services: String,
    #[serde(rename = "contentServices")]
    pub(crate) content_services: String,
    #[serde(rename = "serviceOrigin")]
    pub(crate) service_origin: Option<String>,
    #[serde(rename = "adminDbPath")]
    #[allow(dead_code)] // read in integration tests
    pub(crate) admin_db_path: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ProjectRuntimeAdapter {
    pub(crate) capabilities: ProjectRuntimeCapabilities,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ProjectRuntimeCapabilities {
    pub(crate) name: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ProjectRuntimePlan {
    pub(crate) mode: String,
    pub(crate) env: ProjectEnvContract,
    pub(crate) adapter: ProjectRuntimeAdapter,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ProjectLaunchPlan {
    pub(crate) runtime: ProjectRuntimePlan,
    pub(crate) provider: String,
    #[serde(rename = "deployTarget")]
    pub(crate) deploy_target: String,
    #[serde(rename = "appHost")]
    pub(crate) app_host: String,
    #[serde(rename = "dataServices")]
    pub(crate) data_services: String,
    #[serde(rename = "adminDbPath")]
    pub(crate) admin_db_path: String,
    #[serde(rename = "requiresLocalSeed")]
    pub(crate) requires_local_seed: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub(crate) struct ContentServicesReport {
    #[serde(rename = "contentServices")]
    pub(crate) content_services: String,
    #[serde(rename = "supportLevel")]
    pub(crate) support_level: String,
    #[serde(rename = "serviceOrigin")]
    pub(crate) service_origin: Option<String>,
    #[serde(rename = "requiredEnvKeys")]
    pub(crate) required_env_keys: Vec<String>,
    #[serde(rename = "missingEnvKeys")]
    pub(crate) missing_env_keys: Vec<String>,
    #[serde(rename = "manifestFile")]
    pub(crate) manifest_file: Option<String>,
}

fn file_url_from_path(path: &Path) -> Result<String, String> {
    #[cfg(windows)]
    let normalized_path = {
        let raw = path.to_string_lossy();
        let normalized = raw
            .strip_prefix(r"\\?\UNC\")
            .map(|value| format!(r"\\{value}"))
            .or_else(|| raw.strip_prefix(r"\\?\").map(ToOwned::to_owned))
            .unwrap_or_else(|| raw.into_owned());
        std::path::PathBuf::from(normalized)
    };

    #[cfg(not(windows))]
    let normalized_path = path.to_path_buf();

    Url::from_file_path(&normalized_path)
        .map(|url| url.into())
        .map_err(|()| format!("Cannot convert path into a file URL: {}", normalized_path.display()))
}

pub(crate) fn package_module_import(module_path: &str, project_dir: Option<&Path>) -> Result<String, String> { // ~ skip
    let src_root = crate::find_astropress_src(project_dir)
        .ok_or_else(|| "Cannot locate astropress package. Run `bun install` in your project directory.".to_string())?;
    let full_path = src_root.join(module_path);
    let canonical = full_path.canonicalize().map_err(crate::io_error)?;
    file_url_from_path(&canonical)
}

pub(crate) fn load_project_env_contract(project_dir: &Path) -> Result<ProjectEnvContract, String> { // ~ skip
    let env_module = package_module_import("project-env.js", Some(project_dir))?;
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
        .map_err(crate::io_error)?;

    if !output.status.success() {
        return Err(format!(
            "Failed to load Astropress project env contract: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    serde_json::from_slice::<ProjectEnvContract>(&output.stdout).map_err(|error| error.to_string())
}

#[allow(dead_code)] // called only from integration tests
pub(crate) fn load_project_runtime_plan(
    project_dir: &Path,
    provider: Option<LocalProvider>,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
) -> Result<ProjectRuntimePlan, String> { // ~ skip
    let runtime_module = package_module_import("project-runtime.js", Some(project_dir))?;
    let runtime_module_literal =
        serde_json::to_string(&runtime_module).map_err(|error| error.to_string())?;
    let env_values = merge_env_overrides(read_env_file(project_dir)?, app_host, data_services, provider);
    let env_values_json = serde_json::to_string(&env_values).map_err(|error| error.to_string())?;
    let local_json = serde_json::to_string(&serde_json::json!({
        "workspaceRoot": project_dir.display().to_string(),
        "dbPath": provider.map(|local_provider| {
            project_dir
                .join(crate::default_admin_db_relative_path(local_provider))
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
        .map_err(crate::io_error)?;

    if !output.status.success() {
        return Err(format!(
            "Failed to load Astropress project runtime plan: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    serde_json::from_slice::<ProjectRuntimePlan>(&output.stdout).map_err(|error| error.to_string())
}

pub(crate) fn load_project_launch_plan(
    project_dir: &Path,
    provider: Option<LocalProvider>,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
) -> Result<ProjectLaunchPlan, String> { // ~ skip
    let launch_module = package_module_import("project-launch.js", Some(project_dir))?;
    let launch_module_literal =
        serde_json::to_string(&launch_module).map_err(|error| error.to_string())?;
    let env_values = merge_env_overrides(read_env_file(project_dir)?, app_host, data_services, provider);
    let env_values_json = serde_json::to_string(&env_values).map_err(|error| error.to_string())?;
    let local_json = serde_json::to_string(&serde_json::json!({
        "workspaceRoot": project_dir.display().to_string(),
        "dbPath": provider.map(|local_provider| {
            project_dir
                .join(crate::default_admin_db_relative_path(local_provider))
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
        .map_err(crate::io_error)?;

    if !output.status.success() {
        return Err(format!(
            "Failed to load Astropress project launch plan: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    serde_json::from_slice::<ProjectLaunchPlan>(&output.stdout).map_err(|error| error.to_string())
}

pub(crate) fn resolve_local_provider(
    project_dir: &Path,
    provider: Option<LocalProvider>,
) -> Result<LocalProvider, String> { // ~ skip
    if let Some(provider) = provider {
        return Ok(provider);
    }

    LocalProvider::parse(&load_project_launch_plan(project_dir, None, None, None)?.provider)
}

pub(crate) fn resolve_admin_db_path(
    project_dir: &Path,
    provider: LocalProvider,
) -> Result<String, String> { // ~ skip
    let launch_plan = load_project_launch_plan(project_dir, Some(provider), None, None)?;
    let contract = launch_plan.runtime.env;
    if contract.local_provider != provider.as_str() {
        return Ok(crate::default_admin_db_relative_path(provider).to_string());
    }
    Ok(launch_plan.admin_db_path)
}

pub(crate) fn resolve_deploy_target(
    project_dir: &Path,
    target: Option<&str>,
) -> Result<String, String> { // ~ skip
    if let Some(target) = target {
        return Ok(target.to_string());
    }

    Ok(load_project_launch_plan(project_dir, None, None, None)?.deploy_target)
}

#[allow(clippy::too_many_arguments)]
#[mutants::skip]
pub(crate) fn load_project_scaffold(
    provider: LocalProvider,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
    analytics: Option<&str>,
    ab_testing: Option<&str>,
    heatmap: Option<&str>,
    enable_api: bool,
    donations: &DonationChoices,
) -> Result<ProjectScaffold, String> { // ~ skip
    let scaffold_module = package_module_import("project-scaffold.js", None)?;
    let scaffold_module_literal =
        serde_json::to_string(&scaffold_module).map_err(|error| error.to_string())?;

    // Build a donations object for the JS bridge — only include fields for
    // the widget-based providers (give_lively, liberapay, pledge_crypto).
    // Polar stays Rust-only (env stubs only; no JS scaffold changes needed).
    let has_widget_donations = donations.give_lively || donations.liberapay || donations.pledge_crypto; // ~ skip
    let donations_json = if has_widget_donations {
        let mut m = serde_json::Map::new();
        if donations.give_lively  { m.insert("giveLively".into(),   true.into()); }
        if donations.liberapay    { m.insert("liberapay".into(),    true.into()); }
        if donations.pledge_crypto { m.insert("pledgeCrypto".into(), true.into()); }
        serde_json::to_string(&serde_json::Value::Object(m)).map_err(|e| e.to_string())?
    } else {
        "undefined".to_string()
    };

    let script = format!(
        r#"import {{ createAstropressProjectScaffold }} from {module};

const scaffold = createAstropressProjectScaffold({{
  legacyProvider: "{provider}",
  appHost: {app_host},
  dataServices: {data_services},
  analytics: {analytics},
  abTesting: {ab_testing},
  heatmap: {heatmap},
  enableApi: {enable_api},
  donations: {donations}
}});
console.log(JSON.stringify(scaffold));
"#,
        module = scaffold_module_literal,
        provider = provider.as_str(),
        app_host = serde_json::to_string(&app_host.map(AppHost::as_str))
            .map_err(|error| error.to_string())?,
        data_services = serde_json::to_string(&data_services.map(DataServices::as_str))
            .map_err(|error| error.to_string())?,
        analytics = serde_json::to_string(&analytics).map_err(|e| e.to_string())?,
        ab_testing = serde_json::to_string(&ab_testing).map_err(|e| e.to_string())?,
        heatmap = serde_json::to_string(&heatmap).map_err(|e| e.to_string())?,
        enable_api = enable_api,
        donations = donations_json,
    );

    let output = ProcessCommand::new("node")
        .args(["--input-type=module", "--eval", &script])
        .output()
        .map_err(crate::io_error)?;

    if !output.status.success() {
        return Err(format!(
            "Failed to load Astropress scaffold defaults: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    serde_json::from_slice::<ProjectScaffold>(&output.stdout).map_err(|error| error.to_string())
}

#[derive(Debug, Deserialize)]
pub(crate) struct DbMigrateReport {
    #[serde(rename = "dbPath")]
    pub(crate) db_path: String,
    #[serde(rename = "migrationsDir")]
    pub(crate) migrations_dir: String,
    pub(crate) applied: Vec<String>,
    pub(crate) skipped: Vec<String>,
    #[serde(rename = "dryRun")]
    #[allow(dead_code)]
    pub(crate) dry_run: bool,
}

pub(crate) fn run_db_migrations_operation(
    project_dir: &Path,
    db_path: &str,
    migrations_dir: &str,
    dry_run: bool,
) -> Result<DbMigrateReport, String> { // ~ skip
    let module = package_module_import("db-migrate-ops.js", Some(project_dir))?;
    let module_literal = serde_json::to_string(&module).map_err(|error| error.to_string())?;
    let db_path_json = serde_json::to_string(db_path).map_err(|error| error.to_string())?;
    let migrations_dir_json = serde_json::to_string(migrations_dir).map_err(|error| error.to_string())?;
    let script = format!(
        r#"import {{ runAstropressDbMigrationsForCli }} from {module};
const result = runAstropressDbMigrationsForCli({{
  dbPath: {db_path},
  migrationsDir: {migrations_dir},
  dryRun: {dry_run},
}});
console.log(JSON.stringify(result));
"#,
        module = module_literal,
        db_path = db_path_json,
        migrations_dir = migrations_dir_json,
        dry_run = dry_run,
    );
    run_package_json_command(project_dir, detect_package_manager(project_dir), &script)
}

#[derive(Debug, Deserialize)]
pub(crate) struct DbRollbackReport {
    #[serde(rename = "dbPath")]
    pub(crate) db_path: String,
    #[serde(rename = "migrationName")]
    pub(crate) migration_name: Option<String>,
    pub(crate) status: String,
    #[serde(rename = "dryRun")]
    pub(crate) _dry_run: bool,
}

pub(crate) fn run_db_rollback_operation(
    project_dir: &Path,
    db_path: &str,
    dry_run: bool,
) -> Result<DbRollbackReport, String> { // ~ skip
    let module = package_module_import("db-migrate-ops.js", Some(project_dir))?;
    let module_literal = serde_json::to_string(&module).map_err(|error| error.to_string())?;
    let db_path_json = serde_json::to_string(db_path).map_err(|error| error.to_string())?;
    let script = format!(
        r#"import {{ rollbackAstropressLastMigration }} from {module};
const result = rollbackAstropressLastMigration({{
  dbPath: {db_path},
  dryRun: {dry_run},
}});
console.log(JSON.stringify(result));
"#,
        module = module_literal,
        db_path = db_path_json,
        dry_run = dry_run,
    );
    run_package_json_command(project_dir, detect_package_manager(project_dir), &script)
}

pub(crate) fn run_content_services_operation(
    project_dir: &Path,
    export_name: &str,
) -> Result<ContentServicesReport, String> { // ~ skip
    let module = package_module_import("content-services-ops.js", Some(project_dir))?;
    let module_literal = serde_json::to_string(&module).map_err(|error| error.to_string())?;
    let env_values = read_env_file(project_dir)?;
    let env_values_json = serde_json::to_string(&env_values).map_err(|error| error.to_string())?;
    let workspace_root = serde_json::to_string(&project_dir.display().to_string())
        .map_err(|error| error.to_string())?;
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

#[derive(Debug, Deserialize)]
pub(crate) struct AuthRevokeReport {
    #[serde(rename = "sessionsRevoked")]
    pub(crate) sessions_revoked: u32,
    #[serde(rename = "tokensRevoked")]
    pub(crate) tokens_revoked: u32,
}

pub(crate) fn run_auth_emergency_revoke_operation(
    project_dir: &Path,
    db_path: &str,
    scope: &str,
    user_email: Option<&str>,
) -> Result<AuthRevokeReport, String> {
    let module = package_module_import("auth-emergency-revoke-ops.js", Some(project_dir))?;
    let module_literal = serde_json::to_string(&module).map_err(|error| error.to_string())?;
    let db_path_json = serde_json::to_string(db_path).map_err(|error| error.to_string())?;
    let scope_json = serde_json::to_string(scope).map_err(|error| error.to_string())?;
    let user_email_json = match user_email {
        Some(email) => serde_json::to_string(email).map_err(|error| error.to_string())?,
        None => "undefined".to_string(),
    };
    let script = format!(
        r#"import {{ runAuthEmergencyRevokeForCli }} from {module};
const result = runAuthEmergencyRevokeForCli({{
  dbPath: {db_path},
  scope: {scope},
  userEmail: {user_email},
}});
console.log(JSON.stringify(result));
"#,
        module = module_literal,
        db_path = db_path_json,
        scope = scope_json,
        user_email = user_email_json,
    );
    run_package_json_command(project_dir, detect_package_manager(project_dir), &script)
}
