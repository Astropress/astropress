//! Later wizard steps (A/B testing, heatmaps, REST API).
//! Extracted from `new_wizard_more.rs` to keep that file under 300 lines.

use crate::providers::{AbTestingProvider, HeatmapProvider};

pub(super) struct LateFeatures {
    pub ab_testing: AbTestingProvider,
    pub heatmap: HeatmapProvider,
    pub enable_api: bool,
}

pub(super) fn prompt_late_features() -> LateFeatures {
    use dialoguer::{Confirm, Select, theme::ColorfulTheme};
    let t = &ColorfulTheme::default();

    // ── A/B testing / feature flags ───────────────────────────────────────
    let ab_testing = if Confirm::with_theme(t)
        .with_prompt("Add A/B testing / feature flags?")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("A/B testing provider").items([
            "GrowthBook  — MIT; feature flags + experiments; use when you want data-driven\n\
             \x20            rollouts without a full analytics platform",
            "Unleash     — Apache 2.0; enterprise feature toggles; use when you need audit\n\
             \x20            trails and role-based flag access  ⚠ cloud is expensive; self-host free",
            "Flagsmith   — BSD-3-Clause; feature flags + remote config + A/B testing;\n\
             \x20            use when you want simple flag management with a clean UI",
            "Custom      — I'll wire it myself",
        ]).default(0).interact().unwrap_or(0) {
            1 => AbTestingProvider::Unleash,   // ~ skip
            2 => AbTestingProvider::Flagsmith, // ~ skip
            3 => AbTestingProvider::Custom,    // ~ skip
            _ => AbTestingProvider::GrowthBook, // ~ skip
        }
    } else { AbTestingProvider::None };

    // ── session replay / heatmaps ─────────────────────────────────────────
    // Note: if Matomo was chosen for analytics, its built-in plugins already cover
    // heatmaps and session replay — skip this prompt or choose Custom and wire nothing.
    // Default to PostHog (index 0) when PostHog was already chosen for analytics — same script.
    let heatmap_default: usize = 0;
    let heatmap = if Confirm::with_theme(t)
        .with_prompt("Add session replay / heatmaps?  (skip if you chose Matomo — it includes these via built-in plugins)")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("Session replay provider").items([
            "PostHog   — MIT; session replay + heatmaps built-in; choose this if PostHog was\n\
             \x20          selected for analytics — same script, no extra deploy",
            "Custom    — I'll wire it myself  (or Matomo plugins are already configured)",
        ]).default(heatmap_default).interact().unwrap_or(heatmap_default) {
            1 => HeatmapProvider::Custom, // ~ skip
            _ => HeatmapProvider::PostHog, // ~ skip
        }
    } else { HeatmapProvider::None };

    // ── REST API ──────────────────────────────────────────────────────────
    let enable_api = Confirm::with_theme(t)
        .with_prompt("Enable the REST API?  (Bearer-token auth at /ap-api/v1/*)")
        .default(false).interact().unwrap_or(false);


    LateFeatures { ab_testing, heatmap, enable_api }
}
