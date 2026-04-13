//! Human-readable summary printed at the end of `astropress new` listing the
//! selected stack and where each service will run. Extracted from
//! `feature_stubs.rs` to keep that file under the 300-line arch-lint warning.

use crate::features::{
    AllFeatures, ChatChoice, CmsChoice, CommerceChoice, CommunityChoice, CourseChoice,
    CrmChoice, DocsChoice, EmailChoice, EventChoice, FormsChoice, ForumChoice,
    KnowledgeBaseChoice, NotifyChoice, PaymentChoice, PodcastChoice, ScheduleChoice,
    SearchChoice, SsoChoice, StatusChoice, TransactionalEmailChoice, VideoChoice,
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
        Some(AppHost::FlyIo)           => "Fly.io                (web service)",
        Some(AppHost::Coolify)         => "Coolify               (self-hosted PaaS)",
        Some(AppHost::DigitalOcean)    => "DigitalOcean App Platform",
        Some(AppHost::Railway)         => "Railway               ⚠ paid — usage-based billing, no free tier",
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
        CmsChoice::Payload   => println!("    Content       Payload            ⚠ needs a separate Node server"),
    }
    if f.email == EmailChoice::Listmonk                       { println!("    Email         Listmonk           → self-hosted"); }
    if f.transactional_email == TransactionalEmailChoice::Resend  { println!("    Txn email     Resend             → SaaS; built-in SPF/DKIM/DMARC"); }
    if f.transactional_email == TransactionalEmailChoice::Smtp    { println!("    Txn email     SMTP               → generic relay (Postal, Brevo SMTP, SES, etc.)"); }
    match f.analytics {
        AnalyticsProvider::Umami     => println!("    Analytics     Umami              → self-hosted or cloud"),
        AnalyticsProvider::Plausible => println!("    Analytics     Plausible          → self-hosted or cloud"),
        AnalyticsProvider::Matomo    => println!("    Analytics     Matomo             → self-hosted or cloud"),
        AnalyticsProvider::PostHog   => println!("    Analytics     PostHog            → self-hosted or cloud"),
        AnalyticsProvider::Custom    => println!("    Analytics     Custom"),
        AnalyticsProvider::None      => {}
    }
    if f.commerce    == CommerceChoice::Medusa       { println!("    Storefront    Medusa             → self-hosted  ⚠ needs a separate Node server"); }
    if f.commerce    == CommerceChoice::Vendure      { println!("    Storefront    Vendure            → self-hosted  ⚠ needs a separate Node server"); }
    if f.courses == CourseChoice::FrappeLms           { println!("    Courses       Frappe LMS         → self-hosted"); }
    if f.forms == FormsChoice::Formbricks             { println!("    Forms         Formbricks         → self-hosted or cloud"); }
    if f.forms == FormsChoice::Typebot                { println!("    Forms         Typebot            → self-hosted or cloud"); }
    if f.donations.polar        { println!("    Donations     Polar              → polar.sh (SaaS)"); }
    if f.donations.give_lively  { println!("    Donations     GiveLively         → givelively.org (free for US nonprofits)"); }
    if f.donations.liberapay    { println!("    Donations     Liberapay          → liberapay.com (SaaS, OSS-friendly)"); }
    if f.donations.pledge_crypto { println!("    Donations     PledgeCrypto       → pledgecrypto.com (auto carbon offsets)"); }
    if f.payments    == PaymentChoice::HyperSwitch   { println!("    Payments      HyperSwitch        → self-hosted; provider fees apply"); }
    if f.payments    == PaymentChoice::MpesaDaraja   { println!("    Payments      M-Pesa (Daraja)    → Safaricom cloud API; KES + mobile money; no server"); }
    if f.forum       == ForumChoice::Flarum          { println!("    Forum         Flarum             → self-hosted"); }
    if f.forum       == ForumChoice::Discourse       { println!("    Forum         Discourse          → self-hosted  ⚠ heavier: needs Redis + Postgres"); }
    if f.search      == SearchChoice::Meilisearch    { println!("    Search        Meilisearch        → self-hosted"); }
    if f.search      == SearchChoice::Typesense      { println!("    Search        Typesense          → self-hosted"); }
    if f.chat        == ChatChoice::Tiledesk         { println!("    Live chat     Tiledesk           → self-hosted"); }
    if f.chat        == ChatChoice::Chatwoot         { println!("    Live chat     Chatwoot           → self-hosted"); }
    if f.notify      == NotifyChoice::Ntfy           { println!("    Push notify   ntfy               → self-hosted or cloud"); }
    if f.notify      == NotifyChoice::Gotify         { println!("    Push notify   Gotify             → self-hosted"); }
    if f.schedule    == ScheduleChoice::Rallly       { println!("    Scheduling    Rallly             → self-hosted"); }
    if f.schedule    == ScheduleChoice::CalCom       { println!("    Scheduling    Cal.com            → self-hosted  ⚠ needs Postgres"); }
    match f.community {
        CommunityChoice::Giscus   => println!("    Comments      Giscus             → zero server (GitHub Discussions)"),
        CommunityChoice::Remark42 => println!("    Comments      Remark42           → self-hosted"),
        CommunityChoice::None     => {}
    }
    if f.search      == SearchChoice::Pagefind      { println!("    Search        Pagefind           → zero server, built at deploy time"); }
    match f.ab_testing {
        AbTestingProvider::GrowthBook => println!("    A/B testing   GrowthBook         → self-hosted or cloud"),
        AbTestingProvider::Unleash    => println!("    A/B testing   Unleash            → self-hosted or cloud  ⚠ cloud is expensive"),
        AbTestingProvider::Flagsmith  => println!("    A/B testing   Flagsmith          → self-hosted or cloud"),
        AbTestingProvider::Custom     => println!("    A/B testing   Custom"),
        AbTestingProvider::None       => {}
    }
    match f.heatmap {
        HeatmapProvider::PostHog    => println!("    Replays       PostHog            → same script as analytics"),
        HeatmapProvider::Custom     => println!("    Replays       Custom"),
        HeatmapProvider::None       => {}
    }
    if f.video == VideoChoice::PeerTube               { println!("    Video         PeerTube           → self-hosted"); }
    if f.podcast == PodcastChoice::Castopod           { println!("    Podcast       Castopod           → self-hosted"); }
    if f.events == EventChoice::HiEvents              { println!("    Events        Hi.Events          → self-hosted"); }
    if f.events == EventChoice::Pretix                { println!("    Events        Pretix             → self-hosted"); }
    if f.status == StatusChoice::UptimeKuma           { println!("    Status page   Uptime Kuma        → self-hosted"); }
    if f.knowledge_base == KnowledgeBaseChoice::BookStack { println!("    Knowledge base BookStack        → self-hosted"); }
    if f.crm == CrmChoice::Twenty                     { println!("    CRM           Twenty             → self-hosted"); }
    if f.sso == SsoChoice::Authentik                  { println!("    SSO           Authentik          → self-hosted"); }
    if f.sso == SsoChoice::Zitadel                    { println!("    SSO           Zitadel            → self-hosted or cloud"); }
    match f.docs {
        DocsChoice::Starlight => println!("    Docs site     Starlight (MIT)    → docs/; static output, WCAG AA"),
        DocsChoice::VitePress => println!("    Docs site     VitePress (MIT)    → docs/; static output, local search"),
        DocsChoice::MdBook    => println!("    Docs site     mdBook (MPL-2.0)   → docs/; static output, zero JS framework"),
        DocsChoice::None      => {}
    }
    if f.job_board  { println!("    Job board     content type       → see content-types.example.ts"); }
    if f.enable_api { println!("    REST API      enabled            → /ap-api/v1/* (Bearer token)"); }
    println!("  ─────────────────────────────────────────────────────");
}
