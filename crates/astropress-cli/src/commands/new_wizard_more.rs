//! Second half of the `astropress new` feature wizard (payments through API).
//! Extracted from `new_wizard.rs` to keep that file under the 300-line limit.

use crate::features::{
    ChatChoice, CrmChoice, EventChoice, ForumChoice, KnowledgeBaseChoice, NotifyChoice,
    PaymentChoice, PodcastChoice, ScheduleChoice, SsoChoice, StatusChoice,
    TransactionalEmailChoice, VideoChoice,
};
use crate::providers::{AbTestingProvider, HeatmapProvider};

pub(super) struct MoreFeatures {
    pub payments: PaymentChoice,
    pub forum: ForumChoice,
    pub chat: ChatChoice,
    pub notify: NotifyChoice,
    pub schedule: ScheduleChoice,
    pub video: VideoChoice,
    pub podcast: PodcastChoice,
    pub events: EventChoice,
    pub transactional_email: TransactionalEmailChoice,
    pub status: StatusChoice,
    pub knowledge_base: KnowledgeBaseChoice,
    pub crm: CrmChoice,
    pub sso: SsoChoice,
    pub job_board: bool,
    pub ab_testing: AbTestingProvider,
    pub heatmap: HeatmapProvider,
    pub enable_api: bool,
}

/// Prompts for infrastructure/operations features (payments, forum, chat, notifications,
/// scheduling, video, podcast, events, transactional email, status, KB, CRM, SSO, job
/// board, A/B testing, session replay, REST API). Assumes the caller has already
/// checked `tui::is_plain()`.
pub(super) fn prompt_more_features() -> MoreFeatures {
    use dialoguer::{Confirm, Select, theme::ColorfulTheme};
    let t = &ColorfulTheme::default();

    // ── payment processing ────────────────────────────────────────────────
    let payments = if Confirm::with_theme(t)
        .with_prompt("Add payment processing?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Payment router").items(&[
            "HyperSwitch  — Apache 2.0; Rust; made by Juspay (India); one self-hosted service\n\
             \x20             that routes to any provider you configure in the dashboard:\n\
             \x20             • East Africa:   M-Pesa / Daraja (STK Push)\n\
             \x20             • W/S Africa:    Flutterwave (30+ countries), Paystack (NG/GH/KE/ZA)\n\
             \x20             • India:         Razorpay (UPI/IMPS/NEFT), Cashfree, PayU, PhonePe\n\
             \x20             • SE Asia:       Xendit (GCash/Maya/QRIS), Adyen (GrabPay/PromptPay/FPX)\n\
             \x20             • Middle East:   Noon (AE/SA/EG), Checkout.com (mada/KNET/BENEFIT/Fawry)\n\
             \x20             • Latin America: dLocal (PIX/OXXO/Boleto, 15 countries), Ebanx, PayU\n\
             \x20             • Global:        Stripe (cards/Apple Pay/Google Pay), Adyen, PayPal\n\
             \x20             Includes src/components/HyperCheckout.astro — Unified Checkout Web SDK\n\
             \x20             (MIT) that renders the right UI automatically per enabled connector\n\
             \x20             ⚠ each provider charges its own transaction fees",
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
             \x20           discussion and Giscus is too developer-centric",
            "Discourse  — GPL 2.0; Ruby; mature platform with plugins, moderation tools,\n\
             \x20           and email digests  ⚠ heavier: needs Redis + Postgres",
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
        match Select::with_theme(t).with_prompt("Chat provider").items(&[
            "Tiledesk  — Apache 2.0; live chat + chatbot + helpdesk; REST + webhook API;\n\
             \x20          use when you need real-time support or sales chat with chatbot flows",
            "Chatwoot  — MIT; omnichannel support (email, live chat, social DMs); webhook\n\
             \x20          + REST API; use when you need a full-featured helpdesk for teams",
        ]).default(0).interact().unwrap_or(0) {
            1 => ChatChoice::Chatwoot,
            _ => ChatChoice::Tiledesk,
        }
    } else { ChatChoice::None };

    // ── push notifications ────────────────────────────────────────────────
    let notify = if Confirm::with_theme(t)
        .with_prompt("Add push notifications?")
        .default(false).interact().unwrap_or(false)
    {
        match Select::with_theme(t).with_prompt("Notifications").items(&[
            "ntfy      — Apache 2.0; pub/sub HTTP push; single Go binary; use for order updates,\n\
             \x20          release pings, or fan alerts",
            "Gotify    — MIT; simple self-hosted push; REST API + WebSocket; use when you want\n\
             \x20          zero third-party dependency and a lightweight server",
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
             \x20          group scheduling without requiring accounts",
            "Cal.com   — AGPL 3.0; full booking system; calendar integrations; use when you need\n\
             \x20          appointment booking with availability rules  ⚠ needs Postgres",
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
             \x20          use when you want to host video without YouTube dependency",
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
             \x20        ",
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
             \x20           and nonprofits running public events",
            "Pretix     — Apache 2.0; established ticketing with seating charts and complex\n\
             \x20           ticket types; use when you need box-office-level features",
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
        match Select::with_theme(t).with_prompt("Transactional email").items(&[
            "Resend  — MIT SDK; developer-first API; built-in SPF/DKIM/DMARC;\n\
             \x20        use when you want the simplest integration (resend.com)",
            "SMTP    — bring your own relay (Brevo SMTP, Postal, SES, Postmark SMTP,\n\
             \x20        Mailgun SMTP, etc.); use when you want one generic contract\n\
             \x20        and will manage provider credentials yourself",
        ]).default(0).interact().unwrap_or(0) {
            1 => TransactionalEmailChoice::Smtp,
            _ => TransactionalEmailChoice::Resend,
        }
    } else { TransactionalEmailChoice::None };

    // ── uptime / status page ──────────────────────────────────────────────
    let status = if Confirm::with_theme(t)
        .with_prompt("Add uptime monitoring + status page?")
        .default(false).interact().unwrap_or(false)
    {
        let _ = Select::with_theme(t).with_prompt("Status / uptime").items(&[
            "Uptime Kuma  — MIT; self-hosted uptime monitor with a public status page;\n\
             \x20             use to show service health to your users",
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
             \x20           use for a public help center or internal documentation",
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
             \x20        and volunteers, or businesses tracking leads",
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
             \x20           need a single sign-on",
            "Zitadel    — Apache 2.0; hosted-or-self-hosted; use when you need fine-grained\n\
             \x20           org/team roles",
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
             \x20            rollouts without a full analytics platform",
            "Unleash     — Apache 2.0; enterprise feature toggles; use when you need audit\n\
             \x20            trails and role-based flag access  ⚠ cloud is expensive; self-host free",
            "Flagsmith   — BSD-3-Clause; feature flags + remote config + A/B testing;\n\
             \x20            use when you want simple flag management with a clean UI",
            "Custom      — I'll wire it myself",
        ]).default(0).interact().unwrap_or(0) {
            1 => AbTestingProvider::Unleash,
            2 => AbTestingProvider::Flagsmith,
            3 => AbTestingProvider::Custom,
            _ => AbTestingProvider::GrowthBook,
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
        match Select::with_theme(t).with_prompt("Session replay provider").items(&[
            "PostHog   — MIT; session replay + heatmaps built-in; choose this if PostHog was\n\
             \x20          selected for analytics — same script, no extra deploy",
            "Custom    — I'll wire it myself  (or Matomo plugins are already configured)",
        ]).default(heatmap_default).interact().unwrap_or(heatmap_default) {
            1 => HeatmapProvider::Custom,
            _ => HeatmapProvider::PostHog,
        }
    } else { HeatmapProvider::None };

    // ── REST API ──────────────────────────────────────────────────────────
    let enable_api = Confirm::with_theme(t)
        .with_prompt("Enable the REST API?  (Bearer-token auth at /ap-api/v1/*)")
        .default(false).interact().unwrap_or(false);

    MoreFeatures {
        payments, forum, chat, notify, schedule, video, podcast, events,
        transactional_email, status, knowledge_base, crm, sso, job_board,
        ab_testing, heatmap, enable_api,
    }
}
