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
#[path = "stack_summary_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "stack_summary_tests_more.rs"]
mod tests_more;

#[cfg(test)]
#[path = "stack_summary_tests_more2.rs"]
mod tests_more2;
