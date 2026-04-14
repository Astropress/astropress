use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::js_bridge::loaders::{
    load_project_env_contract, load_project_launch_plan, ProjectEnvContract, ProjectLaunchPlan,
};
use crate::cli_config::env::read_env_file;
use crate::providers::deployment_support_level;

fn get_env_value<'a>(
    env_values: &'a BTreeMap<String, String>,
    canonical_key: &str,
    legacy_keys: &[&str],
) -> Option<&'a str> {
    env_values
        .get(canonical_key)
        .map(String::as_str)
        .or_else(|| legacy_keys.iter().find_map(|key| env_values.get(*key).map(String::as_str)))
}

pub(crate) struct DoctorReport {
    pub(crate) project_dir: PathBuf,
    pub(crate) env_contract: ProjectEnvContract,
    pub(crate) launch_plan: ProjectLaunchPlan,
    pub(crate) warnings: Vec<String>,
}

pub(crate) fn inspect_project_health(project_dir: &Path) -> Result<DoctorReport, String> {
    // Capture filesystem state BEFORE invoking the JS bridge. Loading the launch plan
    // instantiates the local adapter, which may seed an admin SQLite file on disk.
    let data_dir = project_dir.join(".data");
    let data_dir_existed = data_dir.exists();

    let env_values = read_env_file(project_dir)?;
    let env_contract = load_project_env_contract(project_dir)?;
    let launch_plan = load_project_launch_plan(project_dir, None, None, None)?;
    let admin_db_path = project_dir.join(&launch_plan.admin_db_path);
    let admin_db_parent_existed = admin_db_path
        .parent()
        .map(|parent| parent.exists())
        .unwrap_or(true);

    let mut warnings = Vec::new();

    if env_values.is_empty() {
        warnings.push(
            "No .env file was found; Astropress is relying entirely on package defaults.".into(),
        );
    }

    if get_env_value(&env_values, "SESSION_SECRET", &["ASTROPRESS_SESSION_SECRET"])
        .is_none_or(|value| value.trim().is_empty())
    {
        warnings.push("SESSION_SECRET is missing or empty.".into());
    } else if get_env_value(&env_values, "SESSION_SECRET", &["ASTROPRESS_SESSION_SECRET"])
        .is_some_and(|value| value.trim().len() < 24)
    {
        warnings.push("SESSION_SECRET is present but shorter than 24 characters.".into());
    }

    if get_env_value(&env_values, "ADMIN_PASSWORD", &["ASTROPRESS_ADMIN_PASSWORD"])
        .is_none_or(|value| value.trim().is_empty())
    {
        warnings.push("ADMIN_PASSWORD is missing or empty.".into());
    } else if get_env_value(&env_values, "ADMIN_PASSWORD", &["ASTROPRESS_ADMIN_PASSWORD"])
        .is_some_and(|value| value.starts_with("local-admin-"))
    {
        warnings.push("ADMIN_PASSWORD still uses the scaffold-style local default.".into());
    }

    if get_env_value(&env_values, "EDITOR_PASSWORD", &["ASTROPRESS_EDITOR_PASSWORD"])
        .is_none_or(|value| value.trim().is_empty())
    {
        warnings.push("EDITOR_PASSWORD is missing or empty.".into());
    } else if get_env_value(&env_values, "EDITOR_PASSWORD", &["ASTROPRESS_EDITOR_PASSWORD"])
        .is_some_and(|value| value.starts_with("local-editor-"))
    {
        warnings.push("EDITOR_PASSWORD still uses the scaffold-style local default.".into());
    }

    if env_values
        .get("ADMIN_BOOTSTRAP_DISABLED")
        .is_none_or(|value| value.trim() != "1")
    {
        warnings.push(
            "ADMIN_BOOTSTRAP_DISABLED is not set to `1`; bootstrap passwords remain available."
                .into(),
        );
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

    if !env_values.contains_key("ASTROPRESS_CONTENT_SERVICES")
        && !env_values.contains_key("ASTROPRESS_DATA_SERVICES")
    {
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
        && env_contract.content_services != "appwrite"
    {
        warnings.push(format!(
            "Content Services are set to `{}`, but Astropress does not yet provide a first-party runtime adapter for that service layer.",
            env_contract.content_services
        ));
    }

    if (env_values.contains_key("FORMBRICKS_URL")
        || env_values.contains_key("FORMBRICKS_API_KEY")
        || env_values.contains_key("TYPEBOT_URL"))
        && !env_values.contains_key("FORMBRICKS_WEBHOOK_SECRET")
        && !env_values.contains_key("TYPEBOT_WEBHOOK_SECRET")
    {
        warnings.push(
            "FORMBRICKS_WEBHOOK_SECRET / TYPEBOT_WEBHOOK_SECRET is not set. \
             The testimonials ingest endpoint accepts any POST without it. Required before production."
                .into(),
        );
    }

    if launch_plan.runtime.mode == "local" {
        if !data_dir_existed {
            warnings.push(format!(
                "Local runtime expects a `.data` directory, but {} does not exist.",
                data_dir.display()
            ));
        }

        if !admin_db_parent_existed {
            if let Some(parent) = admin_db_path.parent() {
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

pub(crate) fn print_doctor_report_json(report: &DoctorReport) {
    let status = if report.warnings.is_empty() { "ok" } else { "warn" };
    let checks: Vec<serde_json::Value> = report
        .warnings
        .iter()
        .map(|w| {
            serde_json::json!({
                "name": "warning",
                "status": "warn",
                "message": w
            })
        })
        .collect();

    let output = serde_json::json!({
        "status": status,
        "project": report.project_dir.display().to_string(),
        "runtimeMode": report.launch_plan.runtime.mode,
        "appHost": report.launch_plan.app_host,
        "contentServices": report.launch_plan.data_services,
        "pairSupport": deployment_support_level(&report.launch_plan.app_host, &report.launch_plan.data_services),
        "checks": checks
    });

    println!("{}", serde_json::to_string_pretty(&output).unwrap_or_else(|_| "{}".to_string()));
}

pub(crate) fn print_doctor_report(report: &DoctorReport) {
    println!("Astropress doctor report");
    println!("Project: {}", report.project_dir.display());
    println!("Runtime mode: {}", report.launch_plan.runtime.mode);
    println!(
        "Runtime adapter: {}",
        report.launch_plan.runtime.adapter.capabilities.name
    );
    println!("App host: {}", report.launch_plan.app_host);
    println!("Content services: {}", report.launch_plan.data_services);
    println!(
        "Pair support: {}",
        deployment_support_level(
            &report.launch_plan.app_host,
            &report.launch_plan.data_services
        )
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
