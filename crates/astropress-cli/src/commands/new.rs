use std::fs;
use std::path::Path;

use crate::commands::services::bootstrap_content_services;
use crate::providers::{AppHost, DataServices, LocalProvider};
use crate::cli_config::env::{format_env_map, read_env_file, read_package_manifest, write_package_manifest};
use crate::js_bridge::loaders::load_project_scaffold;

// ---------------------------------------------------------------------------
// Service selection choices (stored in .env stubs when a service is chosen)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CmsChoice {
    BuiltIn,
    Keystatic,
    Directus,
    Payload,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CommerceChoice {
    None,
    Medusa,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CommunityChoice {
    Giscus,
    Remark42,
    None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EmailChoice {
    None,
    Listmonk,
}

/// Prompt the user for optional service integrations.
/// Returns env stubs to write into the project `.env` / `.env.example`.
fn prompt_service_choices() -> ServiceSelections {
    if crate::tui::is_plain() {
        return ServiceSelections::defaults();
    }

    use dialoguer::{Select, theme::ColorfulTheme};

    let cms = {
        let items = &[
            "Keep AstroPress built-in (Cloudflare D1 / SQLite / Supabase) — recommended",
            "Keystatic — git-backed, zero server, free on Cloudflare Pages",
            "Directus — best REST/GraphQL API (Cloudflare Workers adapter available)",
            "Payload — TypeScript, local-first (needs Node/Bun server)",
        ];
        let idx = Select::with_theme(&ColorfulTheme::default())
            .with_prompt("Choose a CMS")
            .items(items)
            .default(0)
            .interact()
            .unwrap_or(0);
        match idx {
            1 => CmsChoice::Keystatic,
            2 => CmsChoice::Directus,
            3 => CmsChoice::Payload,
            _ => CmsChoice::BuiltIn,
        }
    };

    let commerce = {
        let items = &[
            "No storefront",
            "Medusa — full headless commerce, MIT (Fly.io/Railway/Render free)",
        ];
        let idx = Select::with_theme(&ColorfulTheme::default())
            .with_prompt("Add a storefront?")
            .items(items)
            .default(0)
            .interact()
            .unwrap_or(0);
        if idx == 1 { CommerceChoice::Medusa } else { CommerceChoice::None }
    };

    let community = {
        let items = &[
            "Giscus — GitHub Discussions, zero server, free (default)",
            "Remark42 — self-hosted comments (Fly.io free)",
            "No comments",
        ];
        let idx = Select::with_theme(&ColorfulTheme::default())
            .with_prompt("Add comments / community?")
            .items(items)
            .default(0)
            .interact()
            .unwrap_or(0);
        match idx {
            1 => CommunityChoice::Remark42,
            2 => CommunityChoice::None,
            _ => CommunityChoice::Giscus,
        }
    };

    let email = {
        let items = &[
            "No email / newsletter",
            "Listmonk — self-hosted campaigns + subscriber lists, MIT (Fly.io free)",
        ];
        let idx = Select::with_theme(&ColorfulTheme::default())
            .with_prompt("Add email / newsletter?")
            .items(items)
            .default(0)
            .interact()
            .unwrap_or(0);
        if idx == 1 { EmailChoice::Listmonk } else { EmailChoice::None }
    };

    ServiceSelections { cms, commerce, community, email }
}

struct ServiceSelections {
    cms: CmsChoice,
    commerce: CommerceChoice,
    community: CommunityChoice,
    email: EmailChoice,
}

impl ServiceSelections {
    fn defaults() -> Self {
        ServiceSelections {
            cms: CmsChoice::BuiltIn,
            commerce: CommerceChoice::None,
            community: CommunityChoice::Giscus,
            email: EmailChoice::None,
        }
    }

    /// Lines to append to `.env.example` describing chosen optional services.
    fn env_example_stubs(&self) -> String {
        let mut lines = Vec::new();
        match self.cms {
            CmsChoice::Keystatic => lines.push("# Keystatic CMS — configure in keystatic.config.ts"),
            CmsChoice::Directus => {
                lines.push("# Directus CMS");
                lines.push("DIRECTUS_URL=http://localhost:8055");
                lines.push("DIRECTUS_TOKEN=replace-me");
            }
            CmsChoice::Payload => {
                lines.push("# Payload CMS");
                lines.push("PAYLOAD_URL=http://localhost:3000");
                lines.push("PAYLOAD_SECRET=replace-me");
            }
            CmsChoice::BuiltIn => {}
        }
        if self.commerce == CommerceChoice::Medusa {
            lines.push("# Medusa headless commerce");
            lines.push("MEDUSA_BACKEND_URL=http://localhost:9000");
        }
        if self.community == CommunityChoice::Remark42 {
            lines.push("# Remark42 comments");
            lines.push("REMARK42_URL=http://localhost:8080");
            lines.push("REMARK42_SITE_ID=remark");
        }
        if self.email == EmailChoice::Listmonk {
            lines.push("# Listmonk email / newsletter");
            lines.push("LISTMONK_URL=http://localhost:9001");
            lines.push("LISTMONK_USERNAME=listmonk");
            lines.push("LISTMONK_PASSWORD=replace-me");
        }
        if lines.is_empty() {
            String::new()
        } else {
            format!("\n# Optional service integrations\n{}\n", lines.join("\n"))
        }
    }
}

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
    // Interactive service selection (skipped in plain mode — uses defaults).
    let services = prompt_service_choices();
    let service_stubs = services.env_example_stubs();

    crate::write_text_file(project_dir, "DEPLOY.md", &scaffold.deploy_doc)?;
    for (relative_path, contents) in &scaffold.ci_files {
        crate::write_text_file(project_dir, relative_path, contents)?;
    }

    // Append service env stubs to .env.example if any services were chosen.
    if !service_stubs.is_empty() {
        let example_path = project_dir.join(".env.example");
        let existing = fs::read_to_string(&example_path).unwrap_or_default();
        fs::write(example_path, format!("{}{}", existing.trim_end_matches('\n'), service_stubs))
            .map_err(crate::io_error)?;
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
    println!("│  Admin URL:     http://localhost:4321/ap-admin       │");
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
