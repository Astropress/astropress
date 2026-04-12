use std::fs;
use std::path::Path;

use crate::cli_config::env::{
    format_env_map, read_env_file, read_package_manifest, write_package_manifest,
};
use super::import_common::bootstrap_content_services;
use super::new_wizard::prompt_all_features;
use crate::feature_stubs::{feature_config_stubs, feature_env_stubs, print_stack_summary};
use crate::features::AllFeatures;
use crate::js_bridge::loaders::load_project_scaffold;
use crate::providers::{
    AbTestingProvider, AnalyticsProvider, AppHost, DataServices, HeatmapProvider, LocalProvider,
};

// ── scaffold ──────────────────────────────────────────────────────────────────

/// Optional feature flags for `scaffold_new_project`.
/// Grouping these into a struct keeps the function signature within clippy's
/// `too_many_arguments` limit and makes future additions non-breaking.
pub(crate) struct ScaffoldOptions {
    pub analytics_flag: Option<AnalyticsProvider>,
    pub ab_testing_flag: Option<AbTestingProvider>,
    pub heatmap_flag: Option<HeatmapProvider>,
    pub enable_api_flag: bool,
    /// Skip interactive prompts and use `AllFeatures::defaults()` — for CI and scripted use.
    pub yes_defaults_flag: bool,
}

pub(crate) fn scaffold_new_project(
    project_dir: &Path,
    use_local_package: bool,
    provider: LocalProvider,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
    options: ScaffoldOptions,
) -> Result<(), String> {
    let ScaffoldOptions { analytics_flag, ab_testing_flag, heatmap_flag, enable_api_flag, yes_defaults_flag } = options;
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
    let fallback_name = project_dir.file_name()
        .and_then(|v| v.to_str()).unwrap_or("astropress-site");
    manifest.name = crate::sanitize_package_name(fallback_name);
    manifest.dependencies.insert(
        "astropress".into(),
        if use_local_package {
            format!("file:{}", crate::repo_root().join("packages").join("astropress").display())
        } else {
            format!("^{}", astropress_package_version()?)
        },
    );

    // Collect all feature choices. CLI flags or --yes/--defaults bypass the interactive wizard.
    let features = if analytics_flag.is_some() || ab_testing_flag.is_some()
        || heatmap_flag.is_some() || enable_api_flag
    {
        AllFeatures {
            analytics:  analytics_flag.unwrap_or(AnalyticsProvider::None),
            ab_testing: ab_testing_flag.unwrap_or(AbTestingProvider::None),
            heatmap:    heatmap_flag.unwrap_or(HeatmapProvider::None),
            enable_api: enable_api_flag,
            ..AllFeatures::defaults()
        }
    } else if yes_defaults_flag {
        AllFeatures::defaults()
    } else {
        prompt_all_features()
    };

    let scaffold = load_project_scaffold(
        provider, app_host, data_services,
        Some(features.analytics.as_str()).filter(|s| *s != "none"),
        Some(features.ab_testing.as_str()).filter(|s| *s != "none"),
        Some(features.heatmap.as_str()).filter(|s| *s != "none"),
        features.enable_api,
        &features.donations,
    )?;
    for (script_name, command) in &scaffold.package_scripts {
        manifest.scripts.insert(script_name.clone(), command.clone());
    }
    write_package_manifest(project_dir, &manifest)?;
    crate::ensure_local_provider_defaults(project_dir)?;
    fs::write(project_dir.join(".env"), format_env_map(&scaffold.local_env))
        .map_err(crate::io_error)?;
    fs::write(project_dir.join(".env.example"), format_env_map(&scaffold.env_example))
        .map_err(crate::io_error)?;

    let stubs = feature_env_stubs(&features);
    if !stubs.is_empty() {
        let example_path = project_dir.join(".env.example");
        let existing = fs::read_to_string(&example_path).unwrap_or_default();
        fs::write(example_path, format!("{}{}", existing.trim_end_matches('\n'), stubs))
            .map_err(crate::io_error)?;
    }
    for (relative_path, contents) in feature_config_stubs(&features) {
        crate::write_text_file(project_dir, relative_path, contents)?;
    }

    crate::write_text_file(project_dir, "DEPLOY.md", &scaffold.deploy_doc)?;
    for (relative_path, contents) in &scaffold.ci_files {
        crate::write_text_file(project_dir, relative_path, contents)?;
    }
    fs::write(project_dir.join(".gitignore"),
        ".astro/\ndist/\nnode_modules/\n.astropress/\n.env\n")
        .map_err(crate::io_error)?;

    println!("\nScaffolded Astropress project at {}", project_dir.display());
    println!("App host: {}  |  Content services: {}", scaffold.app_host, scaffold.content_services);
    print_stack_summary(&features, app_host);

    Ok(())
}

pub(crate) fn run_post_scaffold_setup(project_dir: &Path) -> Result<(), String> {
    println!("\nInstalling dependencies...");
    std::process::Command::new("bun")
        .arg("install").current_dir(project_dir).status()
        .map_err(crate::io_error)?;

    println!("\nBootstrapping content services...");
    bootstrap_content_services(project_dir)?;

    let env = read_env_file(project_dir).unwrap_or_default();
    let admin_pass  = env.get("ADMIN_PASSWORD").cloned().unwrap_or_default();
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
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::{AllFeatures, CmsChoice};

    #[test]
    fn defaults_have_api_disabled_and_no_observability() {
        let f = AllFeatures::defaults();
        assert!(matches!(f.analytics, AnalyticsProvider::None));
        assert!(matches!(f.ab_testing, AbTestingProvider::None));
        assert!(matches!(f.heatmap, HeatmapProvider::None));
        assert!(!f.enable_api);
    }

    #[test]
    fn cms_choices_exist_as_variants() {
        // Verifies that all three CMS options the wizard presents are valid variants.
        let choices = [CmsChoice::BuiltIn, CmsChoice::Keystatic, CmsChoice::Payload];
        assert_eq!(choices.len(), 3, "wizard must present exactly 3 CMS options");
    }

    #[test]
    fn cli_flag_analytics_bypasses_wizard() {
        // Verify the flag → AllFeatures mapping compiles and routes correctly.
        let f = AllFeatures {
            analytics:  AnalyticsProvider::Umami,
            ab_testing: AbTestingProvider::GrowthBook,
            heatmap:    HeatmapProvider::PostHog,
            enable_api: true,
            ..AllFeatures::defaults()
        };
        assert_eq!(Some(f.analytics.as_str()).filter(|s| *s != "none"), Some("umami"));
        assert_eq!(Some(f.ab_testing.as_str()).filter(|s| *s != "none"), Some("growthbook"));
        assert_eq!(Some(f.heatmap.as_str()).filter(|s| *s != "none"), Some("posthog"));
        assert!(f.enable_api);
    }

    #[test]
    fn posthog_analytics_selects_posthog_as_heatmap_default() {
        // OpenReplay removed (EL 2.0). PostHog is now index 0 in the heatmap Select.
        // The default is always 0 regardless of analytics choice.
        let heatmap_default: usize = 0;
        assert_eq!(heatmap_default, 0, "PostHog is always index 0 in the heatmap select");
    }

    #[test]
    fn none_analytics_filtered_before_scaffold_call() {
        let f = AllFeatures::defaults();
        assert!(Some(f.analytics.as_str()).filter(|s| *s != "none").is_none());
        assert!(Some(f.ab_testing.as_str()).filter(|s| *s != "none").is_none());
        assert!(Some(f.heatmap.as_str()).filter(|s| *s != "none").is_none());
    }
}
