//! `astropress add` — append optional integrations to an existing project.
//!
//! Usage: `astropress add [dir] --<feature> <value> [--<feature> <value>...]`
//!
//! Appends env stubs to `.env.example` and writes any config file stubs
//! needed by the chosen integration. Safe to run multiple times (appends,
//! does not overwrite existing vars).

use std::path::Path;

use crate::feature_stubs::{feature_config_stubs, feature_env_stubs};
use crate::service_docs::build_services_doc;
use crate::features::AllFeatures;
use crate::providers::{AbTestingProvider, AnalyticsProvider, HeatmapProvider};
use crate::utils::write_text_file;

#[path = "add_parse.rs"]
mod add_parse;
pub(crate) use add_parse::parse_add_features;

// ── env stubs for providers not covered by feature_env_stubs ─────────────────

/// Returns env stubs for analytics / A/B testing / heatmap providers.
/// These live in the JS scaffold during `new` but must be emitted
/// by the CLI directly for `add` (no JS bridge needed).
fn provider_env_stubs(
    analytics: AnalyticsProvider,
    ab_testing: AbTestingProvider,
    heatmap: HeatmapProvider,
) -> String {
    let mut lines: Vec<&str> = Vec::new();
    match analytics {
        AnalyticsProvider::Umami => lines.extend(&[
            "# Umami (privacy-first analytics — MIT; Railway / Fly.io free)",
            "PUBLIC_UMAMI_WEBSITE_ID=replace-with-your-umami-website-id",
            "PUBLIC_UMAMI_SCRIPT_URL=https://analytics.umami.is/script.js",
        ]),
        AnalyticsProvider::Plausible => lines.extend(&[
            "# Plausible (privacy-first analytics — AGPL; cloud $9/mo or self-host free)",
            "PUBLIC_PLAUSIBLE_DOMAIN=replace-with-your-domain.com",
            "PUBLIC_PLAUSIBLE_SCRIPT_URL=https://plausible.io/js/script.js",
        ]),
        AnalyticsProvider::Matomo => lines.extend(&[
            "# Matomo (full GA replacement — GPL; cloud $23/mo or self-host free)",
            "PUBLIC_MATOMO_URL=https://your-matomo-instance.example.com",
            "PUBLIC_MATOMO_SITE_ID=1",
        ]),
        AnalyticsProvider::PostHog => lines.extend(&[
            "# PostHog (analytics + feature flags + session replay — MIT; generous free tier)",
            "PUBLIC_POSTHOG_KEY=replace-with-your-posthog-api-key",
            "PUBLIC_POSTHOG_HOST=https://app.posthog.com",
        ]),
        AnalyticsProvider::Custom => lines.push("# Analytics: configure manually"),
        AnalyticsProvider::None => {}
    }
    match ab_testing {
        AbTestingProvider::GrowthBook => lines.extend(&[
            "# GrowthBook (feature flags + A/B testing — MIT; generous free cloud tier)",
            "GROWTHBOOK_API_HOST=https://cdn.growthbook.io",
            "GROWTHBOOK_CLIENT_KEY=replace-with-your-growthbook-client-key",
        ]),
        AbTestingProvider::Unleash => lines.extend(&[
            "# Unleash (enterprise feature toggles — Apache 2.0; self-host free)",
            "UNLEASH_URL=https://your-unleash-instance.example.com/api",
            "UNLEASH_CLIENT_KEY=replace-with-your-unleash-client-key",
        ]),
        AbTestingProvider::Flagsmith => lines.extend(&[
            "# Flagsmith (feature flags + A/B testing — BSD-3-Clause; self-hosted or cloud)",
            "FLAGSMITH_API_URL=https://flags.yourdomain.com/api/v1/",
            "FLAGSMITH_ENVIRONMENT_KEY=replace-with-your-flagsmith-environment-key",
        ]),
        AbTestingProvider::Custom => lines.push("# A/B testing: configure manually"),
        AbTestingProvider::None => {}
    }
    match heatmap {
        HeatmapProvider::PostHog => {
            // Only emit PostHog vars here if analytics wasn't already PostHog
            if analytics != AnalyticsProvider::PostHog {
                lines.extend(&[
                    "# PostHog (session replay + heatmaps — MIT; generous free tier)",
                    "PUBLIC_POSTHOG_KEY=replace-with-your-posthog-api-key",
                    "PUBLIC_POSTHOG_HOST=https://app.posthog.com",
                ]);
            }
        }
        HeatmapProvider::Custom => lines.push("# Session replay / heatmaps: configure manually"),
        HeatmapProvider::None => {}
    }
    if lines.is_empty() {
        String::new()
    } else {
        format!("\n# Optional integrations\n{}\n", lines.join("\n"))
    }
}

// ── main entry point ──────────────────────────────────────────────────────────

/// Apply one or more integration additions to an existing project directory.
pub(crate) fn add_integrations(project_dir: &Path, features: AllFeatures) -> Result<(), String> {
    if !project_dir.exists() {
        return Err(format!(
            "Project directory `{}` does not exist. Run `astropress new` first.",
            project_dir.display()
        ));
    }

    let feature_stubs = feature_env_stubs(&features);
    let provider_stubs = provider_env_stubs(features.analytics, features.ab_testing, features.heatmap);
    let all_env_stubs = format!("{feature_stubs}{provider_stubs}");
    let config_stubs = feature_config_stubs(&features);

    if all_env_stubs.trim().is_empty() && config_stubs.is_empty() {
        println!("Nothing to add — no recognised integration flags were provided.");
        return Ok(());
    }

    // Append env stubs to .env.example
    if !all_env_stubs.trim().is_empty() {
        let env_example_path = project_dir.join(".env.example");
        let existing = if env_example_path.exists() {
            std::fs::read_to_string(&env_example_path)
                .map_err(|e| format!("Could not read .env.example: {e}"))?
        } else {
            String::new()
        };
        let trimmed = existing.trim_end_matches('\n');
        let updated = format!("{trimmed}{all_env_stubs}");
        std::fs::write(&env_example_path, updated)
            .map_err(|e| format!("Could not write .env.example: {e}"))?;
        println!("Updated .env.example with new environment variables.");
    }

    // Write config file stubs
    for (rel_path, content) in &config_stubs {
        write_text_file(project_dir, rel_path, content)?;
        println!("Wrote {rel_path}");
    }

    // Write or update SERVICES.md
    if let Some(services_doc) = build_services_doc(&features) {
        let services_path = project_dir.join("SERVICES.md");
        std::fs::write(&services_path, services_doc)
            .map_err(|e| format!("Could not write SERVICES.md: {e}"))?;
        println!("Wrote SERVICES.md");
    }

    Ok(())
}

#[cfg(test)]
#[path = "add_tests.rs"]
mod tests;
