//! Human-readable summary printed at the end of `astropress new` listing the
//! selected stack and where each service will run. Extracted from
//! `feature_stubs.rs` to keep that file under the 300-line arch-lint warning.

use crate::features::{
    AllFeatures, ChatChoice, CmsChoice, CommerceChoice, CommunityChoice, CourseChoice,
    CrmChoice, EmailChoice, EventChoice, FormsChoice, ForumChoice, KnowledgeBaseChoice,
    NotifyChoice, PaymentChoice, PodcastChoice, ScheduleChoice, SearchChoice,
    SsoChoice, StatusChoice, TransactionalEmailChoice, VideoChoice,
};
use crate::providers::{AbTestingProvider, AnalyticsProvider, AppHost, HeatmapProvider};

pub(crate) fn print_stack_summary(f: &AllFeatures, app_host: Option<AppHost>) {
    let host = match app_host {
        Some(AppHost::GithubPages)     => "GitHub Pages          (free, static)",
        Some(AppHost::CloudflarePages) => "Cloudflare Pages      (free, edge CDN)",
        Some(AppHost::Vercel)          => "Vercel                (free tier, serverless)",
        Some(AppHost::Netlify)         => "Netlify               (free tier, serverless)",
        Some(AppHost::RenderStatic)    => "Render static         (free tier)",
        Some(AppHost::RenderWeb)       => "Render web service    (free tier)",
        Some(AppHost::GitlabPages)     => "GitLab Pages          (free, static)",
        Some(AppHost::Runway)          => "Runway                (paid)",
        Some(AppHost::Custom) | None   => "custom / TBD",
    };
    println!();
    println!("  ─────────────────────────────────────────────────────");
    println!("    Your stack");
    println!("  ─────────────────────────────────────────────────────");
    println!("    Site          {host}");
    println!("    Admin panel   Astropress built-in");
    match f.cms {
        CmsChoice::BuiltIn   => println!("    Content       Astropress built-in (SQLite / D1 / Supabase)"),
        CmsChoice::Keystatic => println!("    Content       Keystatic          → git-backed, zero server"),
        CmsChoice::Payload   => println!("    Content       Payload            ⚠ needs a Node server (Fly.io / Railway free)"),
    }
    if f.email == EmailChoice::Listmonk                       { println!("    Email         Listmonk           → Fly.io / Railway (free)"); }
    if f.transactional_email == TransactionalEmailChoice::Brevo   { println!("    Txn email     Brevo              → SaaS free (300/day); no server needed"); }
    if f.transactional_email == TransactionalEmailChoice::Postal  { println!("    Txn email     Postal             → Fly.io / Railway (free)  ⚠ dedicated IP for deliverability"); }
    match f.analytics {
        AnalyticsProvider::Umami     => println!("    Analytics     Umami              → Railway / Fly.io (free)"),
        AnalyticsProvider::Plausible => println!("    Analytics     Plausible          ⚠ cloud $9/mo; self-host free"),
        AnalyticsProvider::Matomo    => println!("    Analytics     Matomo             ⚠ cloud $23/mo; self-host free"),
        AnalyticsProvider::PostHog   => println!("    Analytics     PostHog            → free tier, then paid"),
        AnalyticsProvider::Custom    => println!("    Analytics     Custom"),
        AnalyticsProvider::None      => {}
    }
    if f.commerce    == CommerceChoice::Medusa       { println!("    Storefront    Medusa             → Fly.io / Railway (free)  ⚠ needs Node server"); }
    if f.commerce    == CommerceChoice::Vendure      { println!("    Storefront    Vendure            → Fly.io / Railway (free)  ⚠ needs Node server"); }
    if f.courses == CourseChoice::FrappeLms           { println!("    Courses       Frappe LMS         → Fly.io / Railway (free)"); }
    if f.forms == FormsChoice::Formbricks             { println!("    Forms         Formbricks         → formbricks.com (free tier)"); }
    if f.forms == FormsChoice::Typebot                { println!("    Forms         Typebot            → typebot.io (free tier) or self-host"); }
    if f.donations.polar        { println!("    Donations     Polar              → polar.sh (Apache 2.0, free tier)"); }
    if f.donations.give_lively  { println!("    Donations     GiveLively         → givelively.org (free for nonprofits)"); }
    if f.donations.liberapay    { println!("    Donations     Liberapay          → liberapay.com (free, OSS-friendly)"); }
    if f.donations.pledge_crypto { println!("    Donations     PledgeCrypto       → pledgecrypto.com (free; auto carbon offsets)"); }
    if f.payments    == PaymentChoice::HyperSwitch   { println!("    Payments      HyperSwitch        → Fly.io / Railway (free); provider fees apply"); }
    if f.forum       == ForumChoice::Flarum          { println!("    Forum         Flarum             → Fly.io / Railway (free)"); }
    if f.forum       == ForumChoice::Discourse       { println!("    Forum         Discourse          → Fly.io / Railway (free)  ⚠ heavier: needs Redis + Postgres"); }
    if f.search      == SearchChoice::Meilisearch    { println!("    Search        Meilisearch        → Fly.io / Railway (free)"); }
    if f.chat        == ChatChoice::Tiledesk         { println!("    Live chat     Tiledesk           → Fly.io / Railway (free)"); }
    if f.notify      == NotifyChoice::Ntfy           { println!("    Push notify   ntfy               → ntfy.sh (free) or self-host"); }
    if f.notify      == NotifyChoice::Gotify         { println!("    Push notify   Gotify             → Fly.io / Railway (free)"); }
    if f.schedule    == ScheduleChoice::Rallly       { println!("    Scheduling    Rallly             → Fly.io / Railway (free)"); }
    if f.schedule    == ScheduleChoice::CalCom       { println!("    Scheduling    Cal.com            → Fly.io / Railway (free)  ⚠ needs Postgres"); }
    match f.community {
        CommunityChoice::Giscus   => println!("    Comments      Giscus             → zero server (GitHub Discussions)"),
        CommunityChoice::Remark42 => println!("    Comments      Remark42           → Fly.io (free)"),
        CommunityChoice::None     => {}
    }
    if f.search      == SearchChoice::Pagefind      { println!("    Search        Pagefind           → zero server, built at deploy time"); }
    match f.ab_testing {
        AbTestingProvider::GrowthBook => println!("    A/B testing   GrowthBook         → free cloud tier"),
        AbTestingProvider::Unleash    => println!("    A/B testing   Unleash            ⚠ cloud $80/mo; self-host free"),
        AbTestingProvider::Custom     => println!("    A/B testing   Custom"),
        AbTestingProvider::None       => {}
    }
    match f.heatmap {
        HeatmapProvider::PostHog    => println!("    Replays       PostHog            → same script as analytics"),
        HeatmapProvider::Custom     => println!("    Replays       Custom"),
        HeatmapProvider::None       => {}
    }
    if f.video == VideoChoice::PeerTube               { println!("    Video         PeerTube           → Fly.io / Railway (free)"); }
    if f.podcast == PodcastChoice::Castopod           { println!("    Podcast       Castopod           → Fly.io / Railway (free)"); }
    if f.events == EventChoice::HiEvents              { println!("    Events        Hi.Events          → self-host free"); }
    if f.events == EventChoice::Pretix                { println!("    Events        Pretix             → Fly.io / Railway (free)"); }
    if f.status == StatusChoice::UptimeKuma           { println!("    Status page   Uptime Kuma        → Fly.io / Railway (free)"); }
    if f.knowledge_base == KnowledgeBaseChoice::BookStack { println!("    Knowledge base BookStack        → Fly.io / Railway (free)"); }
    if f.crm == CrmChoice::Twenty                     { println!("    CRM           Twenty             → Fly.io / Railway (free)"); }
    if f.sso == SsoChoice::Authentik                  { println!("    SSO           Authentik          → Fly.io / Railway (free)"); }
    if f.sso == SsoChoice::Zitadel                    { println!("    SSO           Zitadel            → zitadel.com (free tier) or self-host"); }
    if f.job_board  { println!("    Job board     content type       → see content-types.example.ts"); }
    if f.enable_api { println!("    REST API      enabled            → /ap-api/v1/* (Bearer token)"); }
    println!("  ─────────────────────────────────────────────────────");
}
