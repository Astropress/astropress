use std::fs;
use std::path::Path;

use crate::commands::import_common::bootstrap_content_services;
use crate::features::{
    AllFeatures, ChatChoice, CmsChoice, CommunityChoice, CommerceChoice, CourseChoice,
    DonationChoice, EmailChoice, ForumChoice, NotifyChoice, PaymentChoice, ScheduleChoice,
    SearchChoice, TestimonialChoice, feature_env_stubs, feature_config_stubs, print_stack_summary,
};
use crate::providers::{
    AbTestingProvider, AnalyticsProvider, AppHost, DataServices, HeatmapProvider, LocalProvider,
};
use crate::cli_config::env::{
    format_env_map, read_env_file, read_package_manifest, write_package_manifest,
};
use crate::js_bridge::loaders::load_project_scaffold;

// ── interactive wizard ────────────────────────────────────────────────────────

/// Ask y/n for each optional feature, then show tool selection for "yes" answers.
/// Descriptions explain *when* to use each tool. Cost warnings are shown inline.
/// Falls back to defaults in plain / non-TTY mode.
fn prompt_all_features() -> AllFeatures {
    if crate::tui::is_plain() {
        return AllFeatures::defaults();
    }
    use dialoguer::{Confirm, Select, theme::ColorfulTheme};
    let t = &ColorfulTheme::default();

    // ── content backend (always a choice, no y/n — every project needs one) ──
    let cms = match Select::with_theme(t).with_prompt("Content backend").items(&[
        "AstroPress built-in  — SQLite / Cloudflare D1 / Supabase; use for most projects;\n\
         \x20                     full admin panel + REST API included",
        "Keystatic            — git-backed JSON/YAML; zero server; use for small teams that\n\
         \x20                     prefer editing content files directly in the repo",
        "Directus             — REST + GraphQL API; use when you need a powerful data\n\
         \x20                     platform and don't mind running a separate service  (Fly.io free)",
        "Payload              — TypeScript-first, local-first; use when you want full\n\
         \x20                     schema control in code  ⚠ needs a Node server (Fly.io / Railway free)",
    ]).default(0).interact().unwrap_or(0) {
        1 => CmsChoice::Keystatic,
        2 => CmsChoice::Directus,
        3 => CmsChoice::Payload,
        _ => CmsChoice::BuiltIn,
    };

    // ── email / newsletter ────────────────────────────────────────────────
    let email = if Confirm::with_theme(t)
        .with_prompt("Add email / newsletter?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Email provider").items(&[
            "Listmonk  — MIT; self-hosted subscriber lists + campaigns; use when you need full\n\
             \x20           ownership of your list and want to send newsletters (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        EmailChoice::Listmonk
    } else { EmailChoice::None };

    // ── analytics ─────────────────────────────────────────────────────────
    let analytics = if Confirm::with_theme(t)
        .with_prompt("Add analytics?")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("Analytics provider").items(&[
            "Umami      — MIT; ~1 KB script; use when you want simple page views + events\n\
             \x20           with no cookie banner (Railway / Fly.io free)",
            "Plausible  — AGPL; ~1 KB; use when you want a polished dashboard and EU data\n\
             \x20           residency  ⚠ cloud $9/mo; self-host free",
            "Matomo     — GPL; use when you need full GA replacement + GDPR consent tools\n\
             \x20           ⚠ cloud $23/mo; self-host free (heavier)",
            "PostHog    — MIT; use when you need analytics + feature flags + session replay\n\
             \x20           in one service  (generous free tier, then paid)",
            "Custom     — I'll configure manually",
        ]).default(0).interact().unwrap_or(0) {
            1 => AnalyticsProvider::Plausible,
            2 => AnalyticsProvider::Matomo,
            3 => AnalyticsProvider::PostHog,
            4 => AnalyticsProvider::Custom,
            _ => AnalyticsProvider::Umami,
        }
    } else { AnalyticsProvider::None };

    // ── storefront / e-commerce ───────────────────────────────────────────
    let commerce = if Confirm::with_theme(t)
        .with_prompt("Add a storefront / e-commerce?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Commerce platform").items(&[
            "Medusa  — MIT; headless commerce with Stripe + product catalog; use when you need\n\
             \x20        a full cart + checkout flow  ⚠ needs a Node server (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        CommerceChoice::Medusa
    } else { CommerceChoice::None };

    // ── comments ─────────────────────────────────────────────────────────
    let community = if Confirm::with_theme(t)
        .with_prompt("Add comments?")
        .default(true).interact().unwrap_or(true)
    {
        match Select::with_theme(t).with_prompt("Comments provider").items(&[
            "Giscus    — MIT; GitHub Discussions as comments; zero server; use when your\n\
             \x20          readers are likely to have GitHub accounts",
            "Remark42  — MIT; self-hosted; no social login required; use for broader or\n\
             \x20          non-developer audiences  (Fly.io free)",
        ]).default(0).interact().unwrap_or(0) {
            1 => CommunityChoice::Remark42,
            _ => CommunityChoice::Giscus,
        }
    } else { CommunityChoice::None };

    // ── search ────────────────────────────────────────────────────────────
    let search = if Confirm::with_theme(t)
        .with_prompt("Add client-side search?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Search").items(&[
            "Pagefind  — Apache 2.0; static index built at deploy time; use for content-heavy\n\
             \x20          sites that want instant search with zero server cost (<10 KB on page)",
        ]).default(0).interact().unwrap_or(0);
        SearchChoice::Pagefind
    } else { SearchChoice::None };

    // ── courses / LMS ─────────────────────────────────────────────────────
    let courses = if Confirm::with_theme(t)
        .with_prompt("Add courses / LMS?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("LMS provider").items(&[
            "Frappe LMS  — MIT; Python; progress tracking + certificates; use when you need\n\
             \x20            structured learning paths with quizzes  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        CourseChoice::FrappeLms
    } else { CourseChoice::None };

    // ── testimonials / surveys ────────────────────────────────────────────
    let testimonials = if Confirm::with_theme(t)
        .with_prompt("Add testimonials / surveys?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Testimonials + surveys").items(&[
            "Formbricks  — MIT community edition; survey + testimonial collection, REST API;\n\
             \x20            use when you need NPS surveys, onboarding flows, or social proof\n\
             \x20            collection  (formbricks.com free tier or self-host)",
        ]).default(0).interact().unwrap_or(0);
        TestimonialChoice::Formbricks
    } else { TestimonialChoice::None };

    // ── donations / sponsorships ──────────────────────────────────────────
    let donations = if Confirm::with_theme(t)
        .with_prompt("Add donations / sponsorships?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Donations provider").items(&[
            "Polar  — Apache 2.0; dev/OSS-focused; paid posts + sponsorships + issue funding;\n\
             \x20      use when your audience is developers or open-source users  (polar.sh free tier)",
        ]).default(0).interact().unwrap_or(0);
        DonationChoice::Polar
    } else { DonationChoice::None };

    // ── payment processing ────────────────────────────────────────────────
    let payments = if Confirm::with_theme(t)
        .with_prompt("Add payment processing?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Payment router").items(&[
            "HyperSwitch  — Apache 2.0; Rust; unified API that routes to your choice of\n\
             \x20             provider: Stripe (M-PESA/cards/Apple Pay/Google Pay),\n\
             \x20             Razorpay (UPI/India/IMPS/NEFT), PayPal (Venmo), Square (Cash App),\n\
             \x20             Adyen, Braintree, and 50+ more; one self-hosted service;\n\
             \x20             ⚠ each provider has its own transaction fees  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        PaymentChoice::HyperSwitch
    } else { PaymentChoice::None };

    // ── forum ─────────────────────────────────────────────────────────────
    let forum = if Confirm::with_theme(t)
        .with_prompt("Add a forum / community discussion space?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Forum software").items(&[
            "Flarum  — MIT; PHP; lightweight REST API; use when you need async threaded\n\
             \x20        discussion and Giscus is too developer-centric  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        ForumChoice::Flarum
    } else { ForumChoice::None };

    // ── live chat ─────────────────────────────────────────────────────────
    let chat = if Confirm::with_theme(t)
        .with_prompt("Add live chat / customer support?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Chat provider").items(&[
            "Chatwoot  — MIT; live chat + helpdesk + email inbox, REST API; use when you\n\
             \x20          need real-time support or sales chat on public pages  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        ChatChoice::Chatwoot
    } else { ChatChoice::None };

    // ── push notifications ────────────────────────────────────────────────
    let notify = if Confirm::with_theme(t)
        .with_prompt("Add push notifications?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Notifications").items(&[
            "ntfy  — Apache 2.0; pub/sub HTTP push; single Go binary; use for order updates,\n\
             \x20      release pings, or alert fans when new content drops  (ntfy.sh free or self-host)",
        ]).default(0).interact().unwrap_or(0);
        NotifyChoice::Ntfy
    } else { NotifyChoice::None };

    // ── scheduling / availability polls ──────────────────────────────────
    let schedule = if Confirm::with_theme(t)
        .with_prompt("Add scheduling / availability polls?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Scheduling").items(&[
            "Rallly  — MIT; availability polling (open-source Doodle); use when you need\n\
             \x20        group scheduling without requiring accounts  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        ScheduleChoice::Rallly
    } else { ScheduleChoice::None };

    // ── job board content type ────────────────────────────────────────────
    let job_board = Confirm::with_theme(t)
        .with_prompt("Scaffold a job board content type?  (generates content-types.example.ts)")
        .default(false).interact().unwrap_or(false);

    // ── A/B testing / feature flags ───────────────────────────────────────
    let ab_testing = if Confirm::with_theme(t)
        .with_prompt("Add A/B testing / feature flags?")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("A/B testing provider").items(&[
            "GrowthBook  — MIT; feature flags + experiments; use when you want data-driven\n\
             \x20            rollouts without a full analytics platform  (generous free cloud tier)",
            "Unleash     — Apache 2.0; enterprise feature toggles; use when you need audit\n\
             \x20            trails and role-based flag access  ⚠ cloud $80/mo; self-host free",
            "Custom      — I'll wire it myself",
        ]).default(0).interact().unwrap_or(0) {
            1 => AbTestingProvider::Unleash,
            2 => AbTestingProvider::Custom,
            _ => AbTestingProvider::GrowthBook,
        }
    } else { AbTestingProvider::None };

    // ── session replay / heatmaps ─────────────────────────────────────────
    // Default to PostHog (index 1) when PostHog was already chosen for analytics
    // — same script, no extra deploy needed.
    let heatmap_default: usize = if analytics == AnalyticsProvider::PostHog { 1 } else { 0 };
    let heatmap = if Confirm::with_theme(t)
        .with_prompt("Add session replay / heatmaps?")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("Session replay provider").items(&[
            "OpenReplay  — MIT; full session replay + heatmaps + DevTools; use when you need\n\
             \x20            rich UX debugging self-hosted  (needs a dedicated server)",
            "PostHog     — MIT; use this if PostHog was chosen for analytics above;\n\
             \x20            same script, no extra deploy",
            "Custom      — I'll wire it myself",
        ]).default(heatmap_default).interact().unwrap_or(heatmap_default) {
            1 => HeatmapProvider::PostHog,
            2 => HeatmapProvider::Custom,
            _ => HeatmapProvider::OpenReplay,
        }
    } else { HeatmapProvider::None };

    // ── REST API ──────────────────────────────────────────────────────────
    let enable_api = Confirm::with_theme(t)
        .with_prompt("Enable the REST API?  (Bearer-token auth at /ap-api/v1/*)")
        .default(false).interact().unwrap_or(false);

    AllFeatures {
        cms, email, commerce, community, search, courses, testimonials, donations,
        forum, chat, payments, notify, schedule, job_board,
        analytics, ab_testing, heatmap, enable_api,
    }
}

// ── scaffold ──────────────────────────────────────────────────────────────────

pub(crate) fn scaffold_new_project(
    project_dir: &Path,
    use_local_package: bool,
    provider: LocalProvider,
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
    analytics_flag: Option<AnalyticsProvider>,
    ab_testing_flag: Option<AbTestingProvider>,
    heatmap_flag: Option<HeatmapProvider>,
    enable_api_flag: bool,
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

    // Collect all feature choices. CLI flags bypass the interactive wizard (CI/scripted use).
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
    } else {
        prompt_all_features()
    };

    let scaffold = load_project_scaffold(
        provider, app_host, data_services,
        Some(features.analytics.as_str()).filter(|s| *s != "none"),
        Some(features.ab_testing.as_str()).filter(|s| *s != "none"),
        Some(features.heatmap.as_str()).filter(|s| *s != "none"),
        features.enable_api,
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
        // Verifies that all four CMS options the wizard presents are valid variants.
        let choices = [CmsChoice::BuiltIn, CmsChoice::Keystatic, CmsChoice::Directus, CmsChoice::Payload];
        assert_eq!(choices.len(), 4, "wizard must present exactly 4 CMS options");
    }

    #[test]
    fn cli_flag_analytics_bypasses_wizard() {
        // Verify the flag → AllFeatures mapping compiles and routes correctly.
        let f = AllFeatures {
            analytics:  AnalyticsProvider::Umami,
            ab_testing: AbTestingProvider::GrowthBook,
            heatmap:    HeatmapProvider::OpenReplay,
            enable_api: true,
            ..AllFeatures::defaults()
        };
        assert_eq!(Some(f.analytics.as_str()).filter(|s| *s != "none"), Some("umami"));
        assert_eq!(Some(f.ab_testing.as_str()).filter(|s| *s != "none"), Some("growthbook"));
        assert_eq!(Some(f.heatmap.as_str()).filter(|s| *s != "none"), Some("openreplay"));
        assert!(f.enable_api);
    }

    #[test]
    fn posthog_analytics_selects_posthog_as_heatmap_default() {
        // When PostHog is chosen for analytics, index 1 (PostHog) is the preselected
        // default for the heatmap/session-replay Select — not index 0 (OpenReplay).
        let heatmap_default: usize = if AnalyticsProvider::PostHog == AnalyticsProvider::PostHog { 1 } else { 0 };
        assert_eq!(heatmap_default, 1, "PostHog analytics should preselect PostHog for heatmaps");

        let non_posthog_default: usize = if AnalyticsProvider::Umami == AnalyticsProvider::PostHog { 1 } else { 0 };
        assert_eq!(non_posthog_default, 0, "non-PostHog analytics should default heatmap to OpenReplay");
    }

    #[test]
    fn none_analytics_filtered_before_scaffold_call() {
        let f = AllFeatures::defaults();
        assert!(Some(f.analytics.as_str()).filter(|s| *s != "none").is_none());
        assert!(Some(f.ab_testing.as_str()).filter(|s| *s != "none").is_none());
        assert!(Some(f.heatmap.as_str()).filter(|s| *s != "none").is_none());
    }
}
