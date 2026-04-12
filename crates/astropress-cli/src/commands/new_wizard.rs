//! Interactive feature wizard for `astropress new`.
//! Extracted from new.rs to keep that file under the 300-line limit.

use crate::features::{
    AllFeatures, ChatChoice, CmsChoice, CommunityChoice, CommerceChoice, CourseChoice,
    CrmChoice, DonationChoices, EmailChoice, EventChoice, FormsChoice, ForumChoice,
    KnowledgeBaseChoice, NotifyChoice, PaymentChoice, PodcastChoice, ScheduleChoice,
    SearchChoice, SsoChoice, StatusChoice, TransactionalEmailChoice, VideoChoice,
};
use crate::providers::{
    AbTestingProvider, AnalyticsProvider, HeatmapProvider,
};

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
         \x20                     schema control in code  ⚠ needs a Node server (Fly.io / Railway free)",
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
        match Select::with_theme(t).with_prompt("Commerce platform").items(&[
            "Medusa    — MIT; headless commerce with Stripe + product catalog; use when you need\n\
             \x20          a full cart + checkout flow  ⚠ needs a Node server (Fly.io / Railway free)",
            "Vendure   — MIT; TypeScript-first headless commerce; GraphQL API; use when you want\n\
             \x20          full type safety + plugin architecture  ⚠ needs a Node server (Fly.io / Railway free)",
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
             \x20              real-time search across frequently updated content  (Fly.io / Railway free)",
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
             \x20            structured learning paths with quizzes  (Fly.io / Railway free)",
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
        match Select::with_theme(t).with_prompt("Forum software").items(&[
            "Flarum     — MIT; PHP; lightweight REST API; use when you need async threaded\n\
             \x20           discussion and Giscus is too developer-centric  (Fly.io / Railway free)",
            "Discourse  — GPL 2.0; Ruby; mature platform with plugins, moderation tools,\n\
             \x20           and email digests  ⚠ heavier: needs Redis + Postgres  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0) {
            1 => ForumChoice::Discourse,
            _ => ForumChoice::Flarum,
        }
    } else { ForumChoice::None };

    // ── live chat ─────────────────────────────────────────────────────────
    let chat = if Confirm::with_theme(t)
        .with_prompt("Add live chat / customer support?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Chat provider").items(&[
            "Tiledesk  — Apache 2.0; live chat + chatbot + helpdesk; REST + webhook API;\n\
             \x20          use when you need real-time support or sales chat  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        ChatChoice::Tiledesk
    } else { ChatChoice::None };

    // ── push notifications ────────────────────────────────────────────────
    let notify = if Confirm::with_theme(t)
        .with_prompt("Add push notifications?")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("Notifications").items(&[
            "ntfy      — Apache 2.0; pub/sub HTTP push; single Go binary; use for order updates,\n\
             \x20          release pings, or fan alerts  (ntfy.sh free or self-host)",
            "Gotify    — MIT; simple self-hosted push; REST API + WebSocket; use when you want\n\
             \x20          zero third-party dependency and a lightweight server  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0) {
            1 => NotifyChoice::Gotify,
            _ => NotifyChoice::Ntfy,
        }
    } else { NotifyChoice::None };

    // ── scheduling / availability polls ──────────────────────────────────
    let schedule = if Confirm::with_theme(t)
        .with_prompt("Add scheduling / availability polls?")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("Scheduling").items(&[
            "Rallly    — MIT; availability polling (open-source Doodle); use for\n\
             \x20          group scheduling without requiring accounts  (Fly.io / Railway free)",
            "Cal.com   — AGPL 3.0; full booking system; calendar integrations; use when you need\n\
             \x20          appointment booking with availability rules  ⚠ needs Postgres  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0) {
            1 => ScheduleChoice::CalCom,
            _ => ScheduleChoice::Rallly,
        }
    } else { ScheduleChoice::None };

    // ── video hosting ─────────────────────────────────────────────────────
    let video = if Confirm::with_theme(t)
        .with_prompt("Add self-hosted video?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Video provider").items(&[
            "PeerTube  — AGPL 3.0; self-hosted video with embeds + ActivityPub federation;\n\
             \x20          use when you want to host video without YouTube dependency  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        VideoChoice::PeerTube
    } else { VideoChoice::None };

    // ── podcast hosting ───────────────────────────────────────────────────
    let podcast = if Confirm::with_theme(t)
        .with_prompt("Add podcast hosting?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Podcast provider").items(&[
            "Castopod  — AGPL 3.0; self-hosted podcast hosting; RSS feed, embeddable player,\n\
             \x20          ActivityPub federation; use when you run a podcast alongside your site\n\
             \x20          (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        PodcastChoice::Castopod
    } else { PodcastChoice::None };

    // ── event management / ticketing ──────────────────────────────────────
    let events = if Confirm::with_theme(t)
        .with_prompt("Add event management / ticketing?")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("Events platform").items(&[
            "Hi.Events  — AGPL 3.0; event pages, RSVP, ticket sales; use for community orgs\n\
             \x20           and nonprofits running public events  (self-host free)",
            "Pretix     — Apache 2.0; established ticketing with seating charts and complex\n\
             \x20           ticket types; use when you need box-office-level features  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0) {
            1 => EventChoice::Pretix,
            _ => EventChoice::HiEvents,
        }
    } else { EventChoice::None };

    // ── transactional email ───────────────────────────────────────────────
    let transactional_email = if Confirm::with_theme(t)
        .with_prompt("Add transactional email?  (password resets, order confirmations, notifications)")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Transactional email").items(&[
            "Postal  — MIT; self-hosted SMTP server for triggered emails; use alongside\n\
             \x20        Listmonk (which handles campaigns) for a fully self-hosted email stack\n\
             \x20        (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        TransactionalEmailChoice::Postal
    } else { TransactionalEmailChoice::None };

    // ── uptime / status page ──────────────────────────────────────────────
    let status = if Confirm::with_theme(t)
        .with_prompt("Add uptime monitoring + status page?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Status / uptime").items(&[
            "Uptime Kuma  — MIT; self-hosted uptime monitor with a public status page;\n\
             \x20             use to show service health to your users  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        StatusChoice::UptimeKuma
    } else { StatusChoice::None };

    // ── knowledge base ────────────────────────────────────────────────────
    let knowledge_base = if Confirm::with_theme(t)
        .with_prompt("Add a knowledge base / wiki?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Knowledge base").items(&[
            "BookStack  — MIT; structured wiki and docs with shelves, books, and chapters;\n\
             \x20           use for a public help center or internal documentation  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        KnowledgeBaseChoice::BookStack
    } else { KnowledgeBaseChoice::None };

    // ── CRM ───────────────────────────────────────────────────────────────
    let crm = if Confirm::with_theme(t)
        .with_prompt("Add a CRM?  (track contacts, donors, or leads)")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("CRM").items(&[
            "Twenty  — AGPL 3.0; modern open-source CRM; use for nonprofits tracking donors\n\
             \x20        and volunteers, or businesses tracking leads  (Fly.io / Railway free)",
        ]).default(0).interact().unwrap_or(0);
        CrmChoice::Twenty
    } else { CrmChoice::None };

    // ── SSO / identity ────────────────────────────────────────────────────
    let sso = if Confirm::with_theme(t)
        .with_prompt("Add SSO / identity provider?  (unified login for staff across services)")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("Identity provider").items(&[
            "Authentik  — MIT; social login, MFA, LDAP; use when multiple self-hosted services\n\
             \x20           need a single sign-on  (Fly.io / Railway free)",
            "Zitadel    — Apache 2.0; hosted-or-self-hosted; use when you need fine-grained\n\
             \x20           org/team roles  (zitadel.com free tier or self-host)",
        ]).default(0).interact().unwrap_or(0) {
            1 => SsoChoice::Zitadel,
            _ => SsoChoice::Authentik,
        }
    } else { SsoChoice::None };

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
    // Default to PostHog (index 0) when PostHog was already chosen for analytics — same script.
    let heatmap_default: usize = 0;
    let heatmap = if Confirm::with_theme(t)
        .with_prompt("Add session replay / heatmaps?")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("Session replay provider").items(&[
            "PostHog   — MIT; session replay + heatmaps; use this if PostHog was chosen for\n\
             \x20          analytics above — same script, no extra deploy  (generous free tier)",
            "Custom    — I'll wire it myself",
        ]).default(heatmap_default).interact().unwrap_or(heatmap_default) {
            1 => HeatmapProvider::Custom,
            _ => HeatmapProvider::PostHog,
        }
    } else { HeatmapProvider::None };

    // ── REST API ──────────────────────────────────────────────────────────
    let enable_api = Confirm::with_theme(t)
        .with_prompt("Enable the REST API?  (Bearer-token auth at /ap-api/v1/*)")
        .default(false).interact().unwrap_or(false);

    AllFeatures {
        cms, email, transactional_email, commerce, community, search, courses, forms,
        donations, forum, chat, payments, notify, schedule, video, podcast, events,
        status, knowledge_base, crm, sso, job_board, analytics, ab_testing, heatmap,
        enable_api,
    }
}
