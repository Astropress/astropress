//! Interactive feature wizard for `astropress new`.
//! Extracted from new.rs to keep that file under the 300-line limit.
//!
//! The second half of the prompts (payments through REST API) lives in
//! `new_wizard_more.rs` to keep each file under the 300-line arch-lint threshold.

use crate::features::{
    AllFeatures, CmsChoice, CommunityChoice, CommerceChoice, CourseChoice,
    DocsChoice, DonationChoices, EmailChoice, FormsChoice, SearchChoice,
};
use crate::providers::AnalyticsProvider;

#[path = "new_wizard_more.rs"]
mod new_wizard_more;
use new_wizard_more::{prompt_more_features, MoreFeatures};

/// Ask y/n for each optional feature, then show tool selection for "yes" answers.
/// Descriptions explain *when* to use each tool. Cost warnings are shown inline.
/// Falls back to defaults in plain / non-TTY mode.
pub(crate) fn prompt_all_features() -> AllFeatures {
    if crate::tui::is_plain() {
        return AllFeatures::defaults();
    }
    use dialoguer::{Confirm, MultiSelect, Select, theme::ColorfulTheme};
    let t = &ColorfulTheme::default();

    // ── content backend (always a choice, no y/n — every project needs one) ──
    let cms = match Select::with_theme(t).with_prompt("Content backend").items(&[
        "AstroPress built-in  — SQLite / Cloudflare D1 / Supabase; use for most projects;\n\
         \x20                     full admin panel + REST API included",
        "Keystatic            — git-backed JSON/YAML; zero server; use for small teams that\n\
         \x20                     prefer editing content files directly in the repo",
        "Payload              — TypeScript-first, local-first; use when you want full\n\
         \x20                     schema control in code  ⚠ needs a Node server (Fly.io free)",
    ]).default(0).interact().unwrap_or(0) {
        1 => CmsChoice::Keystatic,
        2 => CmsChoice::Payload,
        _ => CmsChoice::BuiltIn,
    };

    // ── email / newsletter ────────────────────────────────────────────────
    let email = if Confirm::with_theme(t)
        .with_prompt("Add email / newsletter?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Email provider").items(&[
            "Listmonk  — MIT; self-hosted subscriber lists + campaigns; use when you need full\n\
             \x20           ownership of your list and want to send newsletters (Fly.io free)",
        ]).default(0).interact().unwrap_or(0);
        EmailChoice::Listmonk
    } else { EmailChoice::None };

    // ── analytics ─────────────────────────────────────────────────────────
    let analytics = if Confirm::with_theme(t)
        .with_prompt("Add analytics?")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("Analytics provider").items(&[
            "Umami      — MIT; ~1 KB; pageviews, bounce rate, custom events\n\
             \x20           no funnels / heatmaps / session replay  (Fly.io free)",
            "Plausible  — AGPL; ~1 KB; pageviews, bounce rate, conversion goals\n\
             \x20           no funnels / heatmaps / session replay  ⚠ cloud $9/mo; self-host free",
            "Matomo     — GPL; bounce rate, conversion goals, funnels, heatmaps, session replay\n\
             \x20           (heatmaps & replay via free built-in plugins)  ⚠ cloud $23/mo; self-host free",
            "PostHog    — MIT; bounce rate, funnels, heatmaps, session replay, A/B testing\n\
             \x20           all built-in, no plugins needed; ~70 KB script  (generous free tier, then paid)",
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
        match Select::with_theme(t).with_prompt("Commerce platform").items(&[
            "Medusa    — MIT; headless commerce with Stripe + product catalog; use when you need\n\
             \x20          a full cart + checkout flow  ⚠ needs a Node server (Fly.io free)",
            "Vendure   — MIT; TypeScript-first headless commerce; GraphQL API; use when you want\n\
             \x20          full type safety + plugin architecture  ⚠ needs a Node server (Fly.io free)",
        ]).default(0).interact().unwrap_or(0) {
            1 => CommerceChoice::Vendure,
            _ => CommerceChoice::Medusa,
        }
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
        match Select::with_theme(t).with_prompt("Search").items(&[
            "Pagefind      — Apache 2.0; static index at deploy time; zero server; use for\n\
             \x20              content-heavy sites that want instant client-side search (<10 KB on page)",
            "Meilisearch   — MIT; typo-tolerant full-text search API; use when you need\n\
             \x20              real-time search across frequently updated content  (Fly.io free)",
        ]).default(0).interact().unwrap_or(0) {
            1 => SearchChoice::Meilisearch,
            _ => SearchChoice::Pagefind,
        }
    } else { SearchChoice::None };

    // ── courses / LMS ─────────────────────────────────────────────────────
    let courses = if Confirm::with_theme(t)
        .with_prompt("Add courses / LMS?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("LMS provider").items(&[
            "Frappe LMS  — MIT; Python; progress tracking + certificates; use when you need\n\
             \x20            structured learning paths with quizzes  (Fly.io free)",
        ]).default(0).interact().unwrap_or(0);
        CourseChoice::FrappeLms
    } else { CourseChoice::None };

    // ── forms / surveys / testimonials ────────────────────────────────────
    let forms = if Confirm::with_theme(t)
        .with_prompt("Add forms / surveys / testimonials?")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("Forms provider").items(&[
            "Formbricks  — MIT community edition; survey + testimonial collection, REST API;\n\
             \x20            use when you need NPS surveys, onboarding flows, or social proof\n\
             \x20            collection  (formbricks.com free tier or self-host)",
            "Typebot     — AGPL 3.0; visual chatbot + conversational form builder;\n\
             \x20            use when you want interactive flows embedded on any page\n\
             \x20            (typebot.io free tier or self-host)",
        ]).default(0).interact().unwrap_or(0) {
            1 => FormsChoice::Typebot,
            _ => FormsChoice::Formbricks,
        }
    } else { FormsChoice::None };

    // ── donations / sponsorships ──────────────────────────────────────────
    let donations = if Confirm::with_theme(t)
        .with_prompt("Add donations / sponsorships?")
        .default(false).interact().unwrap_or(false)
    {
        let selected = MultiSelect::with_theme(t)
            .with_prompt("Donation providers (space to toggle, enter to confirm)")
            .items(&[
                "Polar         — dev/OSS-focused; paid posts + sponsorships + issue funding (polar.sh free tier)",
                "GiveLively    — fiat widget for US nonprofits (free, HTTPS widget embed)",
                "Liberapay     — recurring fiat donations; no external JS; OSS-friendly (liberapay.com free)",
                "PledgeCrypto  — crypto donations with automatic carbon offsets per transaction",
            ])
            .interact()
            .unwrap_or_default();
        DonationChoices {
            polar:        selected.contains(&0),
            give_lively:  selected.contains(&1),
            liberapay:    selected.contains(&2),
            pledge_crypto: selected.contains(&3),
        }
    } else { DonationChoices::default() };

    // ── docs site (Starlight / VitePress / mdBook) ────────────────────────
    let docs = if Confirm::with_theme(t)
        .with_prompt("Add a docs site?")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("Docs generator").items(&[
            "Starlight  — MIT; Astro-based; WCAG AA out of the box, keyboard nav,\n\
             \x20           prefers-reduced-motion, built-in Pagefind search. Use when\n\
             \x20           you want a polished reference site with zero accessibility work.",
            "VitePress  — MIT; Vue-based; minimal, keyboard-friendly, local-first\n\
             \x20           client-side search. Use when you want a fast, simple site\n\
             \x20           with no external trackers.",
            "mdBook     — MPL-2.0; Rust tool; zero JS framework lock-in, semantic HTML,\n\
             \x20           print-friendly. Use when you want the lightest possible\n\
             \x20           dependency surface and offline-friendly reading.",
        ]).default(0).interact().unwrap_or(0) {
            1 => DocsChoice::VitePress,
            2 => DocsChoice::MdBook,
            _ => DocsChoice::Starlight,
        }
    } else { DocsChoice::None };

    let MoreFeatures {
        payments, forum, chat, notify, schedule, video, podcast, events,
        transactional_email, status, knowledge_base, crm, sso, job_board,
        ab_testing, heatmap, enable_api,
    } = prompt_more_features();

    AllFeatures {
        cms, email, transactional_email, commerce, community, search, courses, forms,
        donations, forum, chat, payments, notify, schedule, video, podcast, events,
        status, knowledge_base, crm, sso, docs, job_board,
        analytics, ab_testing, heatmap, enable_api,
    }
}
