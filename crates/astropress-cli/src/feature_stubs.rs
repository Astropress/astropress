//! Env stubs, config file stubs, and stack summary for optional features.
//! Extracted from features.rs to keep that file under the 300-line limit.
//!
//! Docker Compose and SERVICES.md generation lives in `service_docs.rs`.

use crate::features::{
    AllFeatures, ChatChoice, CmsChoice, CommerceChoice, CommunityChoice, CourseChoice,
    CrmChoice, EmailChoice, EventChoice, FormsChoice, ForumChoice, KnowledgeBaseChoice,
    NotifyChoice, PaymentChoice, PodcastChoice, ScheduleChoice, SearchChoice,
    SsoChoice, StatusChoice, TransactionalEmailChoice, VideoChoice,
};
use crate::providers::{AbTestingProvider, AnalyticsProvider, AppHost, HeatmapProvider};
use crate::service_docs::service_compose_stubs;

// ── env stubs ─────────────────────────────────────────────────────────────────

pub(crate) fn feature_env_stubs(f: &AllFeatures) -> String {
    let mut lines: Vec<&str> = Vec::new();

    match f.cms {
        CmsChoice::Keystatic => lines.push("# Keystatic CMS — configure in keystatic.config.ts"),
        CmsChoice::Payload   => lines.extend(&["# Payload CMS",
            "PAYLOAD_URL=http://localhost:3000", "PAYLOAD_SECRET=replace-me"]),
        CmsChoice::BuiltIn   => {}
    }

    if f.email == EmailChoice::Listmonk {
        lines.extend(&["# Listmonk (email / newsletter — see LISTMONK.md for setup instructions)",
            "NEWSLETTER_DELIVERY_MODE=listmonk",
            "LISTMONK_API_URL=http://localhost:9001",
            "LISTMONK_API_USERNAME=listmonk",
            "LISTMONK_API_PASSWORD=replace-me",
            "LISTMONK_LIST_ID=1"]);
    }
    if f.commerce == CommerceChoice::Medusa {
        lines.extend(&["# Medusa (headless commerce — MIT)",
            "MEDUSA_BACKEND_URL=http://localhost:9000"]);
    }
    if f.commerce == CommerceChoice::Vendure {
        lines.extend(&["# Vendure (headless commerce — MIT)",
            "VENDURE_API_URL=http://localhost:3000/shop-api",
            "VENDURE_ADMIN_API_URL=http://localhost:3000/admin-api"]);
    }
    if f.community == CommunityChoice::Remark42 {
        lines.extend(&["# Remark42 (comments)",
            "REMARK42_URL=http://localhost:8080", "REMARK42_SITE_ID=remark"]);
    }
    if f.search == SearchChoice::Pagefind {
        lines.push("# Pagefind — add `npx pagefind --source dist` to your build script");
    }
    if f.search == SearchChoice::Meilisearch {
        lines.extend(&["# Meilisearch (full-text search — MIT)",
            "MEILISEARCH_URL=http://localhost:7700",
            "MEILISEARCH_API_KEY=replace-me"]);
    }
    if f.courses == CourseChoice::FrappeLms {
        lines.extend(&["# Frappe LMS (courses)",
            "FRAPPE_LMS_URL=http://localhost:8000", "FRAPPE_LMS_API_KEY=replace-me"]);
    }
    if f.forms == FormsChoice::Formbricks {
        lines.extend(&["# Formbricks (forms + surveys + testimonials — MIT community edition)",
            "FORMBRICKS_URL=http://localhost:3000", "FORMBRICKS_API_KEY=replace-me",
            "FORMBRICKS_ENVIRONMENT_ID=replace-me"]);
    }
    if f.forms == FormsChoice::Typebot {
        lines.extend(&["# Typebot (conversational forms + chatbot flows — AGPL 3.0)",
            "TYPEBOT_URL=https://typebot.io", "TYPEBOT_API_TOKEN=replace-me"]);
    }
    if f.donations.polar {
        lines.extend(&["# Polar (donations / sponsorships)",
            "POLAR_ACCESS_TOKEN=replace-me", "POLAR_ORGANIZATION_ID=replace-me"]);
    }
    if f.donations.give_lively {
        lines.extend(&["# GiveLively (fiat donations — US nonprofits)",
            "GIVELIVELY_ORG_SLUG=replace-with-your-org-slug",
            "GIVELIVELY_CAMPAIGN_SLUG=replace-with-your-campaign-slug-or-remove"]);
    }
    if f.donations.liberapay {
        lines.extend(&["# Liberapay (recurring donations — OSS-friendly)",
            "LIBERAPAY_USERNAME=replace-with-your-liberapay-username"]);
    }
    if f.donations.pledge_crypto {
        lines.extend(&["# PledgeCrypto (crypto donations + automatic carbon offsets)",
            "PLEDGE_PARTNER_KEY=[YOUR_PLEDGE_PARTNER_KEY]"]);
    }
    if f.forum == ForumChoice::Flarum {
        lines.extend(&["# Flarum (forum — MIT)",
            "FLARUM_URL=http://localhost:8080", "FLARUM_API_KEY=replace-me"]);
    }
    if f.forum == ForumChoice::Discourse {
        lines.extend(&["# Discourse (forum — GPL 2.0)",
            "DISCOURSE_URL=http://localhost:3000",
            "DISCOURSE_API_KEY=replace-me", "DISCOURSE_API_USERNAME=system"]);
    }
    if f.chat == ChatChoice::Tiledesk {
        lines.extend(&["# Tiledesk (live chat + support — Apache 2.0)",
            "TILEDESK_API_URL=http://localhost:8080",
            "TILEDESK_PROJECT_ID=replace-me", "TILEDESK_TOKEN=replace-me"]);
    }
    if f.payments == PaymentChoice::HyperSwitch {
        lines.extend(&["# HyperSwitch (payment router — Apache 2.0)",
            "# Routes to: Stripe (M-PESA/cards/Apple Pay), Razorpay (UPI/India/IMPS/NEFT),",
            "# PayPal (Venmo), Square (Cash App), Adyen, Braintree, and 50+ more providers.",
            "# Add connector API keys via the HyperSwitch dashboard after deploying.",
            "HYPERSWITCH_API_KEY=replace-me",
            "HYPERSWITCH_BASE_URL=http://localhost:8080",
            "PAYMENT_SUCCESS_REDIRECT_URL=https://yourdomain.com/payment/success",
            "PAYMENT_FAILURE_REDIRECT_URL=https://yourdomain.com/payment/failure"]);
    }
    if f.notify == NotifyChoice::Ntfy {
        lines.extend(&["# ntfy (push notifications — Apache 2.0)",
            "NTFY_URL=https://ntfy.sh", "NTFY_TOPIC=replace-with-your-topic"]);
    }
    if f.notify == NotifyChoice::Gotify {
        lines.extend(&["# Gotify (push notifications — MIT)",
            "GOTIFY_URL=http://localhost:80", "GOTIFY_APP_TOKEN=replace-me"]);
    }
    if f.schedule == ScheduleChoice::Rallly {
        lines.extend(&["# Rallly (scheduling polls — MIT)", "RALLLY_URL=http://localhost:3000"]);
    }
    if f.schedule == ScheduleChoice::CalCom {
        lines.extend(&["# Cal.com (scheduling — AGPL 3.0)",
            "CALCOM_API_URL=https://api.cal.com/v1", "CALCOM_API_KEY=replace-me"]);
    }
    if f.video == VideoChoice::PeerTube {
        lines.extend(&["# PeerTube (self-hosted video — AGPL 3.0)",
            "PEERTUBE_URL=http://localhost:9000", "PEERTUBE_API_TOKEN=replace-me"]);
    }
    if f.podcast == PodcastChoice::Castopod {
        lines.extend(&["# Castopod (self-hosted podcast hosting — AGPL 3.0)",
            "CASTOPOD_URL=http://localhost:8000", "CASTOPOD_API_TOKEN=replace-me"]);
    }
    if f.events == EventChoice::HiEvents {
        lines.extend(&["# Hi.Events (event management + ticketing — AGPL 3.0)",
            "HIEVENTS_URL=http://localhost:8080", "HIEVENTS_API_KEY=replace-me"]);
    }
    if f.events == EventChoice::Pretix {
        lines.extend(&["# Pretix (event ticketing — Apache 2.0)",
            "PRETIX_URL=http://localhost:8000", "PRETIX_API_TOKEN=replace-me",
            "PRETIX_ORGANIZER=replace-me", "PRETIX_EVENT=replace-me"]);
    }
    if f.transactional_email == TransactionalEmailChoice::Brevo {
        lines.extend(&["# Brevo (transactional email — SaaS; 300 emails/day free)",
            "# Use for password resets, order confirmations, notifications.",
            "# Sign up at https://www.brevo.com → SMTP & API → Generate SMTP key.",
            "BREVO_SMTP_HOST=smtp-relay.brevo.com", "BREVO_SMTP_PORT=587",
            "BREVO_SMTP_USERNAME=replace-with-brevo-login-email",
            "BREVO_SMTP_PASSWORD=replace-with-brevo-smtp-key",
            "BREVO_FROM_ADDRESS=noreply@yourdomain.com"]);
    }
    if f.transactional_email == TransactionalEmailChoice::Postal {
        lines.extend(&["# Postal (transactional email server — MIT)",
            "# Use for password resets, order confirmations, notifications.",
            "# Listmonk handles newsletter campaigns; Postal handles triggered emails.",
            "# ⚠ For best deliverability, Postal needs a dedicated IP (Fly.io dedicated-vm).",
            "POSTAL_SMTP_HOST=localhost", "POSTAL_SMTP_PORT=587",
            "POSTAL_SMTP_USERNAME=replace-me", "POSTAL_SMTP_PASSWORD=replace-me",
            "POSTAL_FROM_ADDRESS=noreply@yourdomain.com"]);
    }
    if f.status == StatusChoice::UptimeKuma {
        lines.extend(&["# Uptime Kuma (uptime monitoring + status page — MIT)",
            "UPTIME_KUMA_URL=http://localhost:3001"]);
    }
    if f.knowledge_base == KnowledgeBaseChoice::BookStack {
        lines.extend(&["# BookStack (knowledge base / wiki — MIT)",
            "BOOKSTACK_URL=http://localhost:6875",
            "BOOKSTACK_TOKEN_ID=replace-me", "BOOKSTACK_TOKEN_SECRET=replace-me"]);
    }
    if f.crm == CrmChoice::Twenty {
        lines.extend(&["# Twenty CRM (open-source CRM — AGPL 3.0)",
            "TWENTY_URL=http://localhost:3000", "TWENTY_API_KEY=replace-me"]);
    }
    if f.sso == SsoChoice::Authentik {
        lines.extend(&["# Authentik (identity provider — MIT)",
            "AUTHENTIK_URL=http://localhost:9000", "AUTHENTIK_TOKEN=replace-me"]);
    }
    if f.sso == SsoChoice::Zitadel {
        lines.extend(&["# Zitadel (identity platform — Apache 2.0)",
            "ZITADEL_DOMAIN=replace-me.zitadel.cloud",
            "ZITADEL_CLIENT_ID=replace-me", "ZITADEL_CLIENT_SECRET=replace-me"]);
    }

    if lines.is_empty() { String::new() }
    else { format!("\n# Optional integrations\n{}\n", lines.join("\n")) }
}

// ── config file stubs ─────────────────────────────────────────────────────────

pub(crate) fn feature_config_stubs(f: &AllFeatures) -> Vec<(&'static str, &'static str)> {
    let mut files: Vec<(&'static str, &'static str)> = Vec::new();

    // Per-service docker-compose + .env.example files
    files.extend(service_compose_stubs(f));

    match f.cms {
        CmsChoice::Keystatic => files.push((
            "keystatic.config.ts",
            "import { config } from '@keystatic/core';\n\nexport default config({\n  // Configure Keystatic here.\n  // See: https://keystatic.com/docs\n  collections: {},\n});\n",
        )),
        CmsChoice::Payload => files.push((
            "payload.config.ts",
            "import { buildConfig } from 'payload/config';\n\nexport default buildConfig({\n  // Configure Payload CMS here.\n  // See: https://payloadcms.com/docs/configuration/overview\n  collections: [],\n});\n",
        )),
        CmsChoice::BuiltIn => {}
    }
    if f.email == EmailChoice::Listmonk {
        // src/middleware.ts — overrides the static template to add registerAstropressService
        files.push(("src/middleware.ts", concat!(
            "import { createAstropressSecurityMiddleware } from \"astropress/integration\";\n",
            "import { registerCms } from \"astropress\";\n",
            "import { registerAstropressService } from \"astropress/services-config\";\n",
            "\n",
            "// Register CMS — edit siteUrl and templateKeys to match your site.\n",
            "// See: docs/guides/QUICK_START.md\n",
            "registerCms({\n",
            "  siteUrl: import.meta.env.SITE ?? \"https://example.com\",\n",
            "  templateKeys: [],\n",
            "  seedPages: [],\n",
            "  archives: [],\n",
            "  translationStatus: [],\n",
            "});\n",
            "\n",
            "// Register Listmonk so the admin panel can embed it at /ap-admin/services/email.\n",
            "// LISTMONK_API_URL is the public URL of your Listmonk instance (via the Caddy proxy).\n",
            "// See SERVICES.md for setup instructions.\n",
            "registerAstropressService({\n",
            "  provider: \"email\",\n",
            "  label: \"Listmonk\",\n",
            "  description: \"Newsletter and campaign management\",\n",
            "  adminPath: process.env.LISTMONK_API_URL ?? \"\",\n",
            "});\n",
            "\n",
            "// Applies security headers on every response:\n",
            "// CSP, X-Frame-Options, Permissions-Policy, Referrer-Policy, Cache-Control, X-Request-Id.\n",
            "// Options: https://astropress.dev/docs/reference/API_REFERENCE.md#security-middleware\n",
            "export const onRequest = createAstropressSecurityMiddleware();\n",
        )));

        // Listmonk compose files are now generated by service_docs::service_compose_stubs().
        // Setup instructions are in SERVICES.md (generated by service_docs::build_services_doc()).
    }
    if f.commerce == CommerceChoice::Medusa {
        files.push(("medusa-config.js",
            "/** @type {import('@medusajs/medusa').ConfigModule} */\nmodule.exports = {\n  projectConfig: { databaseUrl: process.env.DATABASE_URL },\n  plugins: [],\n};\n",
        ));
    }
    if f.job_board {
        files.push(("content-types.example.ts", concat!(
            "// Uncomment and pass to registerCms({ contentTypes: [jobListingContentType] }).\n",
            "// export const jobListingContentType = {\n",
            "//   key: \"job\",\n",
            "//   label: \"Job Listing\",\n",
            "//   fields: [\n",
            "//     { name: \"company\",  label: \"Company\",         type: \"text\",   required: true },\n",
            "//     { name: \"location\", label: \"Location\",        type: \"text\" },\n",
            "//     { name: \"salary\",   label: \"Salary Range\",    type: \"text\" },\n",
            "//     { name: \"jobType\",  label: \"Type\",            type: \"select\",\n",
            "//       options: [\"full-time\",\"part-time\",\"contract\",\"remote\"] },\n",
            "//     { name: \"applyUrl\", label: \"Apply URL\",       type: \"text\" },\n",
            "//   ],\n",
            "// };\n",
        )));
    }
    files
}

// ── stack summary ─────────────────────────────────────────────────────────────

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
