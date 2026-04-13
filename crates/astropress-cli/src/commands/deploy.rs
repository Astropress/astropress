use std::path::Path;
use std::process::ExitCode;

use serde::Deserialize;

use crate::providers::AppHost;
use crate::cli_config::env::{read_package_manifest, PackageManifest};
use crate::js_bridge::loaders::{package_module_import, resolve_deploy_target};
use crate::js_bridge::runner::{detect_package_manager, run_package_json_command, run_script};

#[derive(Debug, Deserialize)]
pub(crate) struct DeployResult {
    pub(crate) deployment_id: Option<String>,
    pub(crate) url: Option<String>,
}

pub(crate) fn deploy_script_for_target(
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
        "fly-io" => {
            if manifest.scripts.contains_key("deploy:fly-io") {
                Ok("deploy:fly-io")
            } else if manifest.scripts.contains_key("build") {
                Ok("build")
            } else {
                Err("The project does not define a Fly.io deploy or build script.".into())
            }
        }
        "coolify" => {
            if manifest.scripts.contains_key("deploy:coolify") {
                Ok("deploy:coolify")
            } else if manifest.scripts.contains_key("build") {
                Ok("build")
            } else {
                Err("The project does not define a Coolify deploy or build script.".into())
            }
        }
        "digitalocean" => {
            if manifest.scripts.contains_key("deploy:digitalocean") {
                Ok("deploy:digitalocean")
            } else if manifest.scripts.contains_key("build") {
                Ok("build")
            } else {
                Err("The project does not define a DigitalOcean deploy or build script.".into())
            }
        }
        "railway" => {
            if manifest.scripts.contains_key("deploy:railway") {
                Ok("deploy:railway")
            } else if manifest.scripts.contains_key("build") {
                Ok("build")
            } else {
                Err("The project does not define a Railway deploy or build script.".into())
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
            "Unsupported deploy target `{other}`. Use github-pages, cloudflare, vercel, netlify, render-static, render-web, gitlab-pages, fly-io, coolify, digitalocean, railway, runway, or custom."
        )),
    }
}

pub(crate) fn deploy_project(
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
        "github-pages" => (
            "deploy/github-pages.js",
            "createAstropressGitHubPagesDeployTarget",
        ),
        "cloudflare" => (
            "deploy/cloudflare-pages.js",
            "createAstropressCloudflarePagesDeployTarget",
        ),
        "vercel" => ("deploy/vercel.js", "createAstropressVercelDeployTarget"),
        "netlify" => ("deploy/netlify.js", "createAstropressNetlifyDeployTarget"),
        "render-static" | "render-web" => {
            ("deploy/render.js", "createAstropressRenderDeployTarget")
        }
        "gitlab-pages" => (
            "deploy/gitlab-pages.js",
            "createAstropressGitLabPagesDeployTarget",
        ),
        "runway" | "custom" => ("deploy/custom.js", "createAstropressCustomDeployTarget"),
        _ => ("deploy/custom.js", "createAstropressCustomDeployTarget"),
    };
    let deploy_module = package_module_import(module_path, Some(project_dir))?;
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
    let result: DeployResult =
        run_package_json_command(project_dir, package_manager, &deploy_script)?;
    if let Some(url) = result.url {
        println!("Prepared `{selected_target}` deployment at {url}");
    } else if let Some(deployment_id) = result.deployment_id {
        println!("Prepared `{selected_target}` deployment {deployment_id}");
    }

    Ok(ExitCode::SUCCESS)
}
