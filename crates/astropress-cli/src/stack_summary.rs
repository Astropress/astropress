//! Human-readable summary printed at the end of `astropress new` listing the
//! selected stack and where each service will run. Extracted from
//! `feature_stubs.rs` to keep that file under the 300-line arch-lint warning.

use crate::features::{
    AllFeatures, ChatChoice, CmsChoice, CommerceChoice, CommunityChoice, CourseChoice,
    CrmChoice, DocsChoice, EmailChoice, EventChoice, FormsChoice, ForumChoice,
    KnowledgeBaseChoice, NotifyChoice, PaymentChoice, PodcastChoice, ScheduleChoice,
    SearchChoice, SocialChoice, SsoChoice, StatusChoice, TransactionalEmailChoice, VideoChoice,
};
use crate::providers::{
    AbTestingProvider, AnalyticsProvider, AppHost, DataServices, HeatmapProvider,
};

pub(crate) fn format_stack_summary(f: &AllFeatures, app_host: Option<AppHost>) -> String {
    let host = match app_host {
        Some(AppHost::GithubPages)     => "GitHub Pages          (free, static)",
        Some(AppHost::CloudflarePages) => "Cloudflare Pages      (free, edge CDN)",
        Some(AppHost::Vercel)          => "Vercel                (free tier, serverless)",
        Some(AppHost::Netlify)         => "Netlify               (free tier, serverless)",
        Some(AppHost::RenderStatic)    => "Render static         (free tier)",
        Some(AppHost::RenderWeb)       => "Render web service    (free tier)",
        Some(AppHost::GitlabPages)     => "GitLab Pages          (free, static)",
        Some(AppHost::FlyIo)           => "Fly.io                (web service)",
        Some(AppHost::Coolify)         => "Coolify               (self-hosted PaaS)",
        Some(AppHost::DigitalOcean)    => "DigitalOcean App Platform",
        Some(AppHost::Railway)         => "Railway               ⚠ paid — usage-based billing, no free tier",
        Some(AppHost::Custom) | None   => "custom / TBD",
    };
    let mut out = String::new();
    out.push_str("\n  ─────────────────────────────────────────────────────\n");
    out.push_str("    Your stack\n");
    out.push_str("  ─────────────────────────────────────────────────────\n");
    out.push_str(&format!("    Site          {host}\n"));
    out.push_str("    Admin panel   Astropress built-in\n");
    match f.cms {
        CmsChoice::BuiltIn   => out.push_str("    Content       Astropress built-in (SQLite / D1 / Supabase)\n"),
        CmsChoice::Keystatic => out.push_str("    Content       Keystatic          → git-backed, zero server\n"),
        CmsChoice::Payload   => out.push_str("    Content       Payload            ⚠ needs a separate Node server\n"),
    }
    if f.email == EmailChoice::Listmonk                       { out.push_str("    Email         Listmonk           → self-hosted\n"); }
    if f.transactional_email == TransactionalEmailChoice::Resend  { out.push_str("    Txn email     Resend             → SaaS; built-in SPF/DKIM/DMARC\n"); }
    if f.transactional_email == TransactionalEmailChoice::Smtp    { out.push_str("    Txn email     SMTP               → generic relay (Postal, Brevo SMTP, SES, etc.)\n"); }
    match f.analytics {
        AnalyticsProvider::Umami     => out.push_str("    Analytics     Umami              → self-hosted or cloud\n"),
        AnalyticsProvider::Plausible => out.push_str("    Analytics     Plausible          → self-hosted or cloud\n"),
        AnalyticsProvider::Matomo    => out.push_str("    Analytics     Matomo             → self-hosted or cloud\n"),
        AnalyticsProvider::PostHog   => out.push_str("    Analytics     PostHog            → self-hosted or cloud\n"),
        AnalyticsProvider::Custom    => out.push_str("    Analytics     Custom\n"),
        AnalyticsProvider::None      => {}
    }
    if f.commerce    == CommerceChoice::Medusa       { out.push_str("    Storefront    Medusa             → self-hosted  ⚠ needs a separate Node server\n"); }
    if f.commerce    == CommerceChoice::Vendure      { out.push_str("    Storefront    Vendure            → self-hosted  ⚠ needs a separate Node server\n"); }
    if f.courses == CourseChoice::FrappeLms           { out.push_str("    Courses       Frappe LMS         → self-hosted\n"); }
    if f.forms == FormsChoice::Formbricks             { out.push_str("    Forms         Formbricks         → self-hosted or cloud\n"); }
    if f.forms == FormsChoice::Typebot                { out.push_str("    Forms         Typebot            → self-hosted or cloud\n"); }
    if f.donations.polar        { out.push_str("    Donations     Polar              → polar.sh (SaaS)\n"); }
    if f.donations.give_lively  { out.push_str("    Donations     GiveLively         → givelively.org (free for US nonprofits)\n"); }
    if f.donations.liberapay    { out.push_str("    Donations     Liberapay          → liberapay.com (SaaS, OSS-friendly)\n"); }
    if f.donations.pledge_crypto { out.push_str("    Donations     PledgeCrypto       → pledgecrypto.com (auto carbon offsets)\n"); }
    if f.payments    == PaymentChoice::HyperSwitch   { out.push_str("    Payments      HyperSwitch        → self-hosted router + Unified Checkout Web SDK\n"); }
    if f.forum       == ForumChoice::Flarum          { out.push_str("    Forum         Flarum             → self-hosted\n"); }
    if f.forum       == ForumChoice::Discourse       { out.push_str("    Forum         Discourse          → self-hosted  ⚠ heavier: needs Redis + Postgres\n"); }
    if f.search      == SearchChoice::Meilisearch    { out.push_str("    Search        Meilisearch        → self-hosted\n"); }
    if f.search      == SearchChoice::Typesense      { out.push_str("    Search        Typesense          → self-hosted\n"); }
    if f.chat        == ChatChoice::Tiledesk         { out.push_str("    Live chat     Tiledesk           → self-hosted\n"); }
    if f.chat        == ChatChoice::Chatwoot         { out.push_str("    Live chat     Chatwoot           → self-hosted\n"); }
    if f.notify      == NotifyChoice::Ntfy           { out.push_str("    Push notify   ntfy               → self-hosted or cloud\n"); }
    if f.notify      == NotifyChoice::Gotify         { out.push_str("    Push notify   Gotify             → self-hosted\n"); }
    if f.schedule    == ScheduleChoice::Rallly       { out.push_str("    Scheduling    Rallly             → self-hosted\n"); }
    if f.schedule    == ScheduleChoice::CalCom       { out.push_str("    Scheduling    Cal.com            → self-hosted  ⚠ needs Postgres\n"); }
    match f.community {
        CommunityChoice::Giscus   => out.push_str("    Comments      Giscus             → zero server (GitHub Discussions)\n"),
        CommunityChoice::Remark42 => out.push_str("    Comments      Remark42           → self-hosted\n"),
        CommunityChoice::None     => {}
    }
    if f.search      == SearchChoice::Pagefind      { out.push_str("    Search        Pagefind           → zero server, built at deploy time\n"); }
    match f.ab_testing {
        AbTestingProvider::GrowthBook => out.push_str("    A/B testing   GrowthBook         → self-hosted or cloud\n"),
        AbTestingProvider::Unleash    => out.push_str("    A/B testing   Unleash            → self-hosted or cloud  ⚠ cloud is expensive\n"),
        AbTestingProvider::Flagsmith  => out.push_str("    A/B testing   Flagsmith          → self-hosted or cloud\n"),
        AbTestingProvider::Custom     => out.push_str("    A/B testing   Custom\n"),
        AbTestingProvider::None       => {}
    }
    match f.heatmap {
        HeatmapProvider::PostHog    => out.push_str("    Replays       PostHog            → same script as analytics\n"),
        HeatmapProvider::Custom     => out.push_str("    Replays       Custom\n"),
        HeatmapProvider::None       => {}
    }
    if f.video == VideoChoice::PeerTube               { out.push_str("    Video         PeerTube           → self-hosted\n"); }
    if f.podcast == PodcastChoice::Castopod           { out.push_str("    Podcast       Castopod           → self-hosted\n"); }
    if f.events == EventChoice::HiEvents              { out.push_str("    Events        Hi.Events          → self-hosted\n"); }
    if f.events == EventChoice::Pretix                { out.push_str("    Events        Pretix             → self-hosted\n"); }
    if f.status == StatusChoice::UptimeKuma           { out.push_str("    Status page   Uptime Kuma        → self-hosted\n"); }
    if f.knowledge_base == KnowledgeBaseChoice::BookStack { out.push_str("    Knowledge base BookStack        → self-hosted\n"); }
    if f.crm == CrmChoice::Twenty                     { out.push_str("    CRM           Twenty             → self-hosted\n"); }
    if f.sso == SsoChoice::Authentik                  { out.push_str("    SSO           Authentik          → self-hosted\n"); }
    if f.sso == SsoChoice::Zitadel                    { out.push_str("    SSO           Zitadel            → self-hosted or cloud\n"); }
    if f.social == SocialChoice::Postiz               { out.push_str("    Social        Postiz             → self-hosted; LinkedIn/Bluesky/Mastodon/X + 8 more\n"); }
    if f.social == SocialChoice::Mixpost              { out.push_str("    Social        Mixpost            → self-hosted; Twitter/X/Facebook/Instagram/LinkedIn + Mastodon\n"); }
    match f.docs {
        DocsChoice::Starlight => out.push_str("    Docs site     Starlight (MIT)    → docs/; static output, WCAG AA\n"),
        DocsChoice::VitePress => out.push_str("    Docs site     VitePress (MIT)    → docs/; static output, local search\n"),
        DocsChoice::MdBook    => out.push_str("    Docs site     mdBook (MPL-2.0)   → docs/; static output, zero JS framework\n"),
        DocsChoice::None      => {}
    }
    if f.job_board  { out.push_str("    Job board     content type       → see content-types.example.ts\n"); }
    if f.enable_api { out.push_str("    REST API      enabled            → /ap-api/v1/* (Bearer token)\n"); }
    out.push_str("  ─────────────────────────────────────────────────────\n");
    out
}

pub(crate) fn print_stack_summary(f: &AllFeatures, app_host: Option<AppHost>) {
    print!("{}", format_stack_summary(f, app_host));
}

pub(crate) fn free_first_hosting_note(
    app_host: Option<AppHost>,
    data_services: Option<DataServices>,
) -> &'static str {
    match (app_host, data_services) {
        (Some(AppHost::GithubPages), None | Some(DataServices::None)) => {
            "Free-first path: GitHub Pages + the built-in local SQLite flow keeps the public site static and zero infrastructure."
        }
        (Some(AppHost::CloudflarePages), Some(DataServices::Cloudflare)) => {
            "Free-first path: Cloudflare Pages + D1/R2 is the supported edge setup and stays on Cloudflare's free tiers to start."
        }
        (Some(AppHost::Vercel), Some(DataServices::Supabase)) => {
            "Free-first path: Vercel + Supabase is the supported server-backed setup with generous free tiers on both sides."
        }
        (Some(AppHost::Netlify), Some(DataServices::Supabase)) => {
            "Free-first path: Netlify + Supabase is the supported server-backed setup with generous free tiers on both sides."
        }
        (Some(AppHost::Railway), _) => {
            "Railway has no free tier. For a free-first deployment, switch to GitHub Pages + built-in SQLite, Cloudflare Pages + D1/R2, or Vercel/Netlify + Supabase."
        }
        _ => {
            "Free-first defaults: GitHub Pages + built-in SQLite for static sites, Cloudflare Pages + D1/R2 for edge-backed sites, or Vercel/Netlify + Supabase for server-backed sites."
        }
    }
}

pub(crate) fn selected_services_note(has_services_doc: bool) -> Option<&'static str> {
    has_services_doc.then_some(
        "SERVICES.md lists the selected external tools in deployment order, prefers free cloud tiers or self-hosted defaults where possible, and marks paid-only paths with ⚠.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::{
        AllFeatures, ChatChoice, CmsChoice, CommerceChoice, CommunityChoice, CourseChoice,
        CrmChoice, DocsChoice, EmailChoice, EventChoice, FormsChoice, ForumChoice,
        KnowledgeBaseChoice, NotifyChoice, PaymentChoice, PodcastChoice, ScheduleChoice,
        SearchChoice, SocialChoice, SsoChoice, StatusChoice, TransactionalEmailChoice, VideoChoice,
    };
    use crate::providers::{AbTestingProvider, AnalyticsProvider, AppHost, HeatmapProvider};

    fn defaults() -> AllFeatures { AllFeatures::defaults() }

    #[test]
    fn format_summary_github_pages() {
        let f = defaults();
        let s = format_stack_summary(&f, Some(AppHost::GithubPages));
        assert!(s.contains("GitHub Pages"));
    }

    #[test]
    fn format_summary_cloudflare_pages() {
        let s = format_stack_summary(&defaults(), Some(AppHost::CloudflarePages));
        assert!(s.contains("Cloudflare Pages"));
    }

    #[test]
    fn format_summary_vercel() {
        let s = format_stack_summary(&defaults(), Some(AppHost::Vercel));
        assert!(s.contains("Vercel"));
    }

    #[test]
    fn format_summary_netlify() {
        let s = format_stack_summary(&defaults(), Some(AppHost::Netlify));
        assert!(s.contains("Netlify"));
    }

    #[test]
    fn format_summary_render_static() {
        let s = format_stack_summary(&defaults(), Some(AppHost::RenderStatic));
        assert!(s.contains("Render static"));
    }

    #[test]
    fn format_summary_render_web() {
        let s = format_stack_summary(&defaults(), Some(AppHost::RenderWeb));
        assert!(s.contains("Render web service"));
    }

    #[test]
    fn format_summary_gitlab_pages() {
        let s = format_stack_summary(&defaults(), Some(AppHost::GitlabPages));
        assert!(s.contains("GitLab Pages"));
    }

    #[test]
    fn format_summary_fly_io() {
        let s = format_stack_summary(&defaults(), Some(AppHost::FlyIo));
        assert!(s.contains("Fly.io"));
    }

    #[test]
    fn format_summary_coolify() {
        let s = format_stack_summary(&defaults(), Some(AppHost::Coolify));
        assert!(s.contains("Coolify"));
    }

    #[test]
    fn format_summary_digitalocean() {
        let s = format_stack_summary(&defaults(), Some(AppHost::DigitalOcean));
        assert!(s.contains("DigitalOcean"));
    }

    #[test]
    fn format_summary_railway() {
        let s = format_stack_summary(&defaults(), Some(AppHost::Railway));
        assert!(s.contains("Railway"));
    }

    #[test]
    fn format_summary_custom_host() {
        let s = format_stack_summary(&defaults(), Some(AppHost::Custom));
        assert!(s.contains("custom / TBD"));
    }

    #[test]
    fn format_summary_no_host() {
        let s = format_stack_summary(&defaults(), None);
        assert!(s.contains("custom / TBD"));
    }

    #[test]
    fn format_summary_cms_builtin() {
        let mut f = defaults();
        f.cms = CmsChoice::BuiltIn;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Astropress built-in"));
    }

    #[test]
    fn format_summary_cms_keystatic() {
        let mut f = defaults();
        f.cms = CmsChoice::Keystatic;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Keystatic"));
    }

    #[test]
    fn format_summary_cms_payload() {
        let mut f = defaults();
        f.cms = CmsChoice::Payload;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Payload"));
    }

    #[test]
    fn format_summary_email_listmonk() {
        let mut f = defaults();
        f.email = EmailChoice::Listmonk;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Listmonk"));
    }

    #[test]
    fn format_summary_txn_email_resend() {
        let mut f = defaults();
        f.transactional_email = TransactionalEmailChoice::Resend;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Resend"));
    }

    #[test]
    fn format_summary_txn_email_smtp() {
        let mut f = defaults();
        f.transactional_email = TransactionalEmailChoice::Smtp;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("SMTP"));
    }

    #[test]
    fn format_summary_analytics_umami() {
        let mut f = defaults();
        f.analytics = AnalyticsProvider::Umami;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Umami"));
    }

    #[test]
    fn format_summary_analytics_plausible() {
        let mut f = defaults();
        f.analytics = AnalyticsProvider::Plausible;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Plausible"));
    }

    #[test]
    fn format_summary_analytics_matomo() {
        let mut f = defaults();
        f.analytics = AnalyticsProvider::Matomo;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Matomo"));
    }

    #[test]
    fn format_summary_analytics_posthog() {
        let mut f = defaults();
        f.analytics = AnalyticsProvider::PostHog;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("PostHog"));
    }

    #[test]
    fn format_summary_analytics_custom() {
        let mut f = defaults();
        f.analytics = AnalyticsProvider::Custom;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Analytics     Custom"));
    }

    #[test]
    fn format_summary_analytics_none_not_printed() {
        let mut f = defaults();
        f.analytics = AnalyticsProvider::None;
        let s = format_stack_summary(&f, None);
        assert!(!s.contains("Analytics"));
    }

    #[test]
    fn format_summary_commerce_medusa() {
        let mut f = defaults();
        f.commerce = CommerceChoice::Medusa;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Medusa"));
    }

    #[test]
    fn format_summary_commerce_vendure() {
        let mut f = defaults();
        f.commerce = CommerceChoice::Vendure;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Vendure"));
    }

    #[test]
    fn format_summary_courses_frappe() {
        let mut f = defaults();
        f.courses = CourseChoice::FrappeLms;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Frappe LMS"));
    }

    #[test]
    fn format_summary_forms_formbricks() {
        let mut f = defaults();
        f.forms = FormsChoice::Formbricks;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Formbricks"));
    }

    #[test]
    fn format_summary_forms_typebot() {
        let mut f = defaults();
        f.forms = FormsChoice::Typebot;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Typebot"));
    }

    #[test]
    fn format_summary_donations_polar() {
        let mut f = defaults();
        f.donations.polar = true;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Polar"));
    }

    #[test]
    fn format_summary_donations_give_lively() {
        let mut f = defaults();
        f.donations.give_lively = true;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("GiveLively"));
    }

    #[test]
    fn format_summary_donations_liberapay() {
        let mut f = defaults();
        f.donations.liberapay = true;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Liberapay"));
    }

    #[test]
    fn format_summary_donations_pledge_crypto() {
        let mut f = defaults();
        f.donations.pledge_crypto = true;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("PledgeCrypto"));
    }

    #[test]
    fn format_summary_payments_hyperswitch() {
        let mut f = defaults();
        f.payments = PaymentChoice::HyperSwitch;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("HyperSwitch"));
    }

    #[test]
    fn format_summary_forum_flarum() {
        let mut f = defaults();
        f.forum = ForumChoice::Flarum;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Flarum"));
    }

    #[test]
    fn format_summary_forum_discourse() {
        let mut f = defaults();
        f.forum = ForumChoice::Discourse;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Discourse"));
    }

    #[test]
    fn format_summary_search_meilisearch() {
        let mut f = defaults();
        f.search = SearchChoice::Meilisearch;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Meilisearch"));
    }

    #[test]
    fn format_summary_search_typesense() {
        let mut f = defaults();
        f.search = SearchChoice::Typesense;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Typesense"));
    }

    #[test]
    fn format_summary_search_pagefind() {
        let mut f = defaults();
        f.search = SearchChoice::Pagefind;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Pagefind"));
    }

    #[test]
    fn format_summary_chat_tiledesk() {
        let mut f = defaults();
        f.chat = ChatChoice::Tiledesk;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Tiledesk"));
    }

    #[test]
    fn format_summary_chat_chatwoot() {
        let mut f = defaults();
        f.chat = ChatChoice::Chatwoot;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Chatwoot"));
    }

    #[test]
    fn format_summary_notify_ntfy() {
        let mut f = defaults();
        f.notify = NotifyChoice::Ntfy;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("ntfy"));
    }

    #[test]
    fn format_summary_notify_gotify() {
        let mut f = defaults();
        f.notify = NotifyChoice::Gotify;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Gotify"));
    }

    #[test]
    fn format_summary_schedule_rallly() {
        let mut f = defaults();
        f.schedule = ScheduleChoice::Rallly;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Rallly"));
    }

    #[test]
    fn format_summary_schedule_calcom() {
        let mut f = defaults();
        f.schedule = ScheduleChoice::CalCom;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Cal.com"));
    }

    #[test]
    fn format_summary_community_giscus() {
        let mut f = defaults();
        f.community = CommunityChoice::Giscus;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Giscus"));
    }

    #[test]
    fn format_summary_community_remark42() {
        let mut f = defaults();
        f.community = CommunityChoice::Remark42;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Remark42"));
    }

    #[test]
    fn format_summary_ab_testing_growthbook() {
        let mut f = defaults();
        f.ab_testing = AbTestingProvider::GrowthBook;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("GrowthBook"));
    }

    #[test]
    fn format_summary_ab_testing_unleash() {
        let mut f = defaults();
        f.ab_testing = AbTestingProvider::Unleash;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Unleash"));
    }

    #[test]
    fn format_summary_ab_testing_flagsmith() {
        let mut f = defaults();
        f.ab_testing = AbTestingProvider::Flagsmith;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Flagsmith"));
    }

    #[test]
    fn format_summary_ab_testing_custom() {
        let mut f = defaults();
        f.ab_testing = AbTestingProvider::Custom;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("A/B testing   Custom"));
    }

    #[test]
    fn format_summary_heatmap_posthog() {
        let mut f = defaults();
        f.heatmap = HeatmapProvider::PostHog;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Replays") && s.contains("PostHog"));
    }

    #[test]
    fn format_summary_heatmap_custom() {
        let mut f = defaults();
        f.heatmap = HeatmapProvider::Custom;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Replays       Custom"));
    }

    #[test]
    fn format_summary_video_peertube() {
        let mut f = defaults();
        f.video = VideoChoice::PeerTube;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("PeerTube"));
    }

    #[test]
    fn format_summary_podcast_castopod() {
        let mut f = defaults();
        f.podcast = PodcastChoice::Castopod;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Castopod"));
    }

    #[test]
    fn format_summary_events_hievents() {
        let mut f = defaults();
        f.events = EventChoice::HiEvents;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Hi.Events"));
    }

    #[test]
    fn format_summary_events_pretix() {
        let mut f = defaults();
        f.events = EventChoice::Pretix;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Pretix"));
    }

    #[test]
    fn format_summary_status_uptime_kuma() {
        let mut f = defaults();
        f.status = StatusChoice::UptimeKuma;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Uptime Kuma"));
    }

    #[test]
    fn format_summary_knowledge_base_bookstack() {
        let mut f = defaults();
        f.knowledge_base = KnowledgeBaseChoice::BookStack;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("BookStack"));
    }

    #[test]
    fn format_summary_crm_twenty() {
        let mut f = defaults();
        f.crm = CrmChoice::Twenty;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Twenty"));
    }

    #[test]
    fn format_summary_sso_authentik() {
        let mut f = defaults();
        f.sso = SsoChoice::Authentik;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Authentik"));
    }

    #[test]
    fn format_summary_sso_zitadel() {
        let mut f = defaults();
        f.sso = SsoChoice::Zitadel;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Zitadel"));
    }

    #[test]
    fn format_summary_social_postiz() {
        let mut f = defaults();
        f.social = SocialChoice::Postiz;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Postiz"));
    }

    #[test]
    fn format_summary_social_mixpost() {
        let mut f = defaults();
        f.social = SocialChoice::Mixpost;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Mixpost"));
    }

    #[test]
    fn format_summary_docs_starlight() {
        let mut f = defaults();
        f.docs = DocsChoice::Starlight;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Starlight"));
    }

    #[test]
    fn format_summary_docs_vitepress() {
        let mut f = defaults();
        f.docs = DocsChoice::VitePress;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("VitePress"));
    }

    #[test]
    fn format_summary_docs_mdbook() {
        let mut f = defaults();
        f.docs = DocsChoice::MdBook;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("mdBook"));
    }

    #[test]
    fn format_summary_job_board() {
        let mut f = defaults();
        f.job_board = true;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("Job board"));
    }

    #[test]
    fn format_summary_enable_api() {
        let mut f = defaults();
        f.enable_api = true;
        let s = format_stack_summary(&f, None);
        assert!(s.contains("REST API"));
    }

    #[test]
    fn free_first_hosting_note_github_pages_none() {
        let note = free_first_hosting_note(Some(AppHost::GithubPages), None);
        // Must match the GithubPages-specific arm, not the wildcard (which also says "GitHub Pages")
        assert!(note.contains("local SQLite flow"), "expected GithubPages-specific text, got: {note}");
    }

    #[test]
    fn free_first_hosting_note_github_pages_data_none() {
        use crate::providers::DataServices;
        let note = free_first_hosting_note(Some(AppHost::GithubPages), Some(DataServices::None));
        assert!(note.contains("local SQLite flow"), "expected GithubPages-specific text, got: {note}");
    }

    #[test]
    fn free_first_hosting_note_cloudflare() {
        use crate::providers::DataServices;
        let note = free_first_hosting_note(Some(AppHost::CloudflarePages), Some(DataServices::Cloudflare));
        // Must match the Cloudflare-specific arm: "edge setup" vs wildcard "edge-backed sites"
        assert!(note.contains("edge setup"), "expected Cloudflare-specific text, got: {note}");
    }

    #[test]
    fn free_first_hosting_note_vercel_supabase() {
        use crate::providers::DataServices;
        let note = free_first_hosting_note(Some(AppHost::Vercel), Some(DataServices::Supabase));
        // "Vercel + Supabase is" is arm-unique; wildcard says "Vercel/Netlify + Supabase for"
        assert!(note.contains("Vercel + Supabase is"), "expected Vercel-specific text, got: {note}");
    }

    #[test]
    fn free_first_hosting_note_netlify_supabase() {
        use crate::providers::DataServices;
        let note = free_first_hosting_note(Some(AppHost::Netlify), Some(DataServices::Supabase));
        // "Netlify + Supabase is" is arm-unique; wildcard says "Vercel/Netlify + Supabase for"
        assert!(note.contains("Netlify + Supabase is"), "expected Netlify-specific text, got: {note}");
    }

    #[test]
    fn free_first_hosting_note_railway() {
        let note = free_first_hosting_note(Some(AppHost::Railway), None);
        assert!(note.contains("Railway"));
    }

    #[test]
    fn free_first_hosting_note_fallback() {
        let note = free_first_hosting_note(None, None);
        assert!(note.contains("GitHub Pages") || note.contains("Cloudflare") || note.contains("free"));
    }

    #[test]
    fn selected_services_note_with_doc() {
        assert!(selected_services_note(true).is_some());
    }

    #[test]
    fn selected_services_note_without_doc() {
        assert!(selected_services_note(false).is_none());
    }
}
