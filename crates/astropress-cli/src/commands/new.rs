use std::fs;
use std::path::Path;

use crate::commands::services::bootstrap_content_services;
use crate::providers::{AppHost, DataServices, LocalProvider};
use crate::cli_config::env::{format_env_map, read_env_file, read_package_manifest, write_package_manifest};
use crate::js_bridge::loaders::load_project_scaffold;

/// Writes all scaffold files into project_dir. Does not run install or bootstrap.
pub(crate) fn scaffold_new_project(
    project_dir: &Path,
    use_local_package: bool,
    provider: LocalProvider,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
) -> Result<(), String> {
    if project_dir.exists() {
        let mut entries = fs::read_dir(project_dir).map_err(crate::io_error)?;
        if entries.next().transpose().map_err(crate::io_error)?.is_some() {
            return Err(format!(
                "Refusing to scaffold into `{}` because the directory is not empty.",
                project_dir.display()
            ));
        }
    } else {
        fs::create_dir_all(project_dir).map_err(crate::io_error)?;
    }

    crate::write_embedded_template(project_dir)?;

    let mut manifest = read_package_manifest(project_dir)?;
    let fallback_name = project_dir
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("astropress-site");
    manifest.name = crate::sanitize_package_name(fallback_name);
    manifest.dependencies.insert(
        "astropress".into(),
        if use_local_package {
            format!(
                "file:{}",
                crate::repo_root()
                    .join("packages")
                    .join("astropress")
                    .display()
            )
        } else {
            format!("^{}", astropress_package_version()?)
        },
    );
    let scaffold = load_project_scaffold(provider, app_host, data_services)?;
    for (script_name, command) in &scaffold.package_scripts {
        manifest.scripts.insert(script_name.clone(), command.clone());
    }
    write_package_manifest(project_dir, &manifest)?;
    crate::ensure_local_provider_defaults(project_dir)?;
    fs::write(project_dir.join(".env"), format_env_map(&scaffold.local_env))
        .map_err(crate::io_error)?;
    fs::write(
        project_dir.join(".env.example"),
        format_env_map(&scaffold.env_example),
    )
    .map_err(crate::io_error)?;
    crate::write_text_file(project_dir, "DEPLOY.md", &scaffold.deploy_doc)?;
    for (relative_path, contents) in &scaffold.ci_files {
        crate::write_text_file(project_dir, relative_path, contents)?;
    }

    fs::write(
        project_dir.join(".gitignore"),
        ".astro/\ndist/\nnode_modules/\n.astropress/\n.env\n",
    )
    .map_err(crate::io_error)?;

    println!(
        "\nScaffolded Astropress project at {}",
        project_dir.display()
    );
    println!("App host: {}", scaffold.app_host);
    println!("Content services: {}", scaffold.content_services);

    Ok(())
}

/// Runs bun install, services bootstrap, and prints the credential box.
/// Called after scaffold_new_project in the CLI entry point.
pub(crate) fn run_post_scaffold_setup(project_dir: &Path) -> Result<(), String> {
    println!("\nInstalling dependencies...");
    std::process::Command::new("bun")
        .arg("install")
        .current_dir(project_dir)
        .status()
        .map_err(crate::io_error)?;

    println!("\nBootstrapping content services...");
    bootstrap_content_services(project_dir)?;

    let env = read_env_file(project_dir).unwrap_or_default();
    let admin_pass = env.get("ADMIN_PASSWORD").cloned().unwrap_or_default();
    let editor_pass = env.get("EDITOR_PASSWORD").cloned().unwrap_or_default();

    println!();
    println!("┌──────────────────────────────────────────────────────┐");
    println!("│              Astropress is ready!                    │");
    println!("├──────────────────────────────────────────────────────┤");
    println!("│  Admin URL:     http://localhost:4321/wp-admin       │");
    println!("│  Admin email:   admin@example.com                    │");
    println!("│  Admin pass:    {:<38}│", admin_pass);
    println!("│  Editor email:  editor@example.com                   │");
    println!("│  Editor pass:   {:<38}│", editor_pass);
    println!("├──────────────────────────────────────────────────────┤");
    println!("│  These are also saved in your project's .env file    │");
    println!("└──────────────────────────────────────────────────────┘");
    println!();
    println!("Run:  cd {} && astropress dev", project_dir.display());

    Ok(())
}

fn astropress_package_version() -> Result<String, String> {
    // Version is baked in at compile time. Keep Cargo.toml in sync with
    // packages/astropress/package.json when cutting releases.
    Ok(env!("CARGO_PKG_VERSION").to_string())
}
