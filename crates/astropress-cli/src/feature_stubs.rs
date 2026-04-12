//! Env stubs, config file stubs, and stack summary for optional features.
//! Extracted from features.rs to keep that file under the 300-line limit.

use crate::features::{
    AllFeatures, ChatChoice, CmsChoice, CommerceChoice, CommunityChoice, CourseChoice,
    EmailChoice, ForumChoice, NotifyChoice, PaymentChoice, ScheduleChoice,
    SearchChoice, TestimonialChoice,
};
use crate::providers::{AbTestingProvider, AnalyticsProvider, AppHost, HeatmapProvider};

// ── env stubs ─────────────────────────────────────────────────────────────────

pub(crate) fn feature_env_stubs(f: &AllFeatures) -> String {
    let mut lines: Vec<&str> = Vec::new();

    match f.cms {
        CmsChoice::Keystatic => lines.push("# Keystatic CMS — configure in keystatic.config.ts"),
        CmsChoice::Directus  => lines.extend(&["# Directus CMS",
            "DIRECTUS_URL=http://localhost:8055", "DIRECTUS_TOKEN=replace-me"]),
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
        lines.extend(&["# Medusa (e-commerce)", "MEDUSA_BACKEND_URL=http://localhost:9000"]);
    }
    if f.community == CommunityChoice::Remark42 {
        lines.extend(&["# Remark42 (comments)",
            "REMARK42_URL=http://localhost:8080", "REMARK42_SITE_ID=remark"]);
    }
    if f.search == SearchChoice::Pagefind {
        lines.push("# Pagefind — add `npx pagefind --source dist` to your build script");
    }
    if f.courses == CourseChoice::FrappeLms {
        lines.extend(&["# Frappe LMS (courses)",
            "FRAPPE_LMS_URL=http://localhost:8000", "FRAPPE_LMS_API_KEY=replace-me"]);
    }
    if f.testimonials == TestimonialChoice::Formbricks {
        lines.extend(&["# Formbricks (testimonials + surveys)",
            "FORMBRICKS_URL=http://localhost:3000", "FORMBRICKS_API_KEY=replace-me",
            "FORMBRICKS_ENVIRONMENT_ID=replace-me"]);
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
        lines.extend(&["# Flarum (forum)",
            "FLARUM_URL=http://localhost:8080", "FLARUM_API_KEY=replace-me"]);
    }
    if f.chat == ChatChoice::Chatwoot {
        lines.extend(&["# Chatwoot (live chat + support)",
            "CHATWOOT_URL=http://localhost:3000",
            "CHATWOOT_API_ACCESS_TOKEN=replace-me", "CHATWOOT_INBOX_ID=replace-me"]);
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
    if f.schedule == ScheduleChoice::Rallly {
        lines.extend(&["# Rallly (scheduling polls)", "RALLLY_URL=http://localhost:3000"]);
    }

    if lines.is_empty() { String::new() }
    else { format!("\n# Optional integrations\n{}\n", lines.join("\n")) }
}

// ── config file stubs ─────────────────────────────────────────────────────────

pub(crate) fn feature_config_stubs(f: &AllFeatures) -> Vec<(&'static str, &'static str)> {
    let mut files: Vec<(&'static str, &'static str)> = Vec::new();
    match f.cms {
        CmsChoice::Keystatic => files.push((
            "keystatic.config.ts",
            "import { config } from '@keystatic/core';\n\nexport default config({\n  // Configure Keystatic here.\n  // See: https://keystatic.com/docs\n  collections: {},\n});\n",
        )),
        CmsChoice::Payload => files.push((
            "payload.config.ts",
            "import { buildConfig } from 'payload/config';\n\nexport default buildConfig({\n  // Configure Payload CMS here.\n  // See: https://payloadcms.com/docs/configuration/overview\n  collections: [],\n});\n",
        )),
        CmsChoice::Directus | CmsChoice::BuiltIn => {}
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
            "// See LISTMONK.md for setup instructions.\n",
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

        // listmonk/Caddyfile — reverse proxy that strips X-Frame-Options so the Listmonk
        // admin can be embedded in the Astropress admin panel via iframe.
        // Listmonk sends X-Frame-Options: SAMEORIGIN by default (hardcoded); Caddy removes it
        // and replaces it with a Content-Security-Policy frame-ancestors directive scoped to
        // the Astropress site URL.
        files.push(("listmonk/Caddyfile", concat!(
            "# Caddy reverse proxy for Listmonk.\n",
            "# Strips X-Frame-Options: SAMEORIGIN so the Listmonk admin can be embedded\n",
            "# in the Astropress admin panel at /ap-admin/services/email.\n",
            "# SITE_URL must be set to your Astropress site's public URL (e.g. https://example.com).\n",
            "{\n",
            "    admin off\n",
            "}\n",
            "\n",
            ":80 {\n",
            "    reverse_proxy listmonk:9000 {\n",
            "        header_down -X-Frame-Options\n",
            "    }\n",
            "    header {\n",
            "        Content-Security-Policy \"frame-ancestors 'self' {$SITE_URL}\"\n",
            "    }\n",
            "}\n",
        )));

        // listmonk/docker-compose.yml — runs Listmonk + Caddy + Postgres.
        // Works locally, on Railway (deploy via Docker Compose), and on Fly.io (fly deploy).
        files.push(("listmonk/docker-compose.yml", concat!(
            "# Listmonk + Caddy reverse proxy + Postgres.\n",
            "# Caddy strips X-Frame-Options so Listmonk can be embedded in the Astropress admin panel.\n",
            "#\n",
            "# Usage:\n",
            "#   cp .env.listmonk.example .env.listmonk\n",
            "#   # Edit .env.listmonk and set DB_PASSWORD and SITE_URL\n",
            "#   docker compose --env-file .env.listmonk up -d\n",
            "#\n",
            "# Deploy to Railway: connect this directory as a Docker Compose service.\n",
            "# Deploy to Fly.io:  cd listmonk && fly launch && fly deploy\n",
            "services:\n",
            "  caddy:\n",
            "    image: caddy:2-alpine\n",
            "    ports:\n",
            "      - \"80:80\"\n",
            "      - \"443:443\"\n",
            "    volumes:\n",
            "      - ./Caddyfile:/etc/caddy/Caddyfile\n",
            "      - caddy_data:/data\n",
            "    environment:\n",
            "      SITE_URL: \"${SITE_URL:-https://example.com}\"\n",
            "    depends_on:\n",
            "      - listmonk\n",
            "    restart: unless-stopped\n",
            "\n",
            "  listmonk:\n",
            "    image: listmonk/listmonk:latest\n",
            "    environment:\n",
            "      LISTMONK_app__address: \"0.0.0.0:9000\"\n",
            "      LISTMONK_db__host: db\n",
            "      LISTMONK_db__port: \"5432\"\n",
            "      LISTMONK_db__user: listmonk\n",
            "      LISTMONK_db__password: \"${DB_PASSWORD:?set DB_PASSWORD in .env.listmonk}\"\n",
            "      LISTMONK_db__database: listmonk\n",
            "    depends_on:\n",
            "      db:\n",
            "        condition: service_healthy\n",
            "    restart: unless-stopped\n",
            "\n",
            "  db:\n",
            "    image: postgres:16-alpine\n",
            "    environment:\n",
            "      POSTGRES_USER: listmonk\n",
            "      POSTGRES_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.listmonk}\"\n",
            "      POSTGRES_DB: listmonk\n",
            "    volumes:\n",
            "      - listmonk_db:/var/lib/postgresql/data\n",
            "    healthcheck:\n",
            "      test: [\"CMD-SHELL\", \"pg_isready -U listmonk\"]\n",
            "      interval: 5s\n",
            "      timeout: 5s\n",
            "      retries: 5\n",
            "    restart: unless-stopped\n",
            "\n",
            "volumes:\n",
            "  caddy_data:\n",
            "  listmonk_db:\n",
        )));

        // listmonk/.env.listmonk.example — env vars for the docker-compose deployment
        files.push(("listmonk/.env.listmonk.example", concat!(
            "# Copy to .env.listmonk and fill in real values before running docker compose.\n",
            "DB_PASSWORD=change-me\n",
            "SITE_URL=https://your-astropress-site.example.com\n",
        )));

        files.push(("LISTMONK.md", concat!(
            "# Listmonk Setup Guide\n\n",
            "Listmonk is a self-hosted, open-source newsletter and mailing list manager.\n",
            "Your subscriber list and campaign data stay on your own infrastructure — no SaaS fees or vendor lock-in.\n\n",
            "## What was generated\n\n",
            "| File | Purpose |\n",
            "|---|---|\n",
            "| `listmonk/docker-compose.yml` | Runs Listmonk + Caddy reverse proxy + Postgres |\n",
            "| `listmonk/Caddyfile` | Caddy config — proxies Listmonk and removes `X-Frame-Options` so the admin UI can be embedded in Astropress |\n",
            "| `listmonk/.env.listmonk.example` | Environment variables for the docker-compose deployment |\n",
            "| `src/middleware.ts` | Updated to call `registerAstropressService` so the Listmonk UI appears at `/ap-admin/services/email` |\n\n",
            "## Why Caddy?\n\n",
            "Listmonk sends `X-Frame-Options: SAMEORIGIN` on every response (hardcoded).\n",
            "This header prevents the Listmonk admin from being embedded in the Astropress admin panel iframe.\n",
            "The generated Caddy config sits in front of Listmonk and strips that header, replacing it with\n",
            "a `Content-Security-Policy: frame-ancestors` directive scoped to your Astropress site URL.\n\n",
            "## Deploy\n\n",
            "### Option A — Docker Compose (local or Railway)\n\n",
            "```sh\n",
            "cd listmonk\n",
            "cp .env.listmonk.example .env.listmonk\n",
            "# Edit .env.listmonk: set DB_PASSWORD and SITE_URL\n",
            "docker compose --env-file .env.listmonk up -d\n",
            "```\n\n",
            "Your Listmonk instance is now reachable at `http://localhost` (via Caddy on port 80).\n\n",
            "To deploy on **Railway**: push this repo, create a new Railway service, point it at the `listmonk/` directory, and set `DB_PASSWORD` and `SITE_URL` as Railway environment variables.\n\n",
            "### Option B — Fly.io\n\n",
            "```sh\n",
            "cd listmonk\n",
            "fly launch          # creates fly.toml from docker-compose.yml\n",
            "fly secrets set DB_PASSWORD=change-me SITE_URL=https://your-astropress-site.example.com\n",
            "fly deploy\n",
            "```\n\n",
            "## First-time Listmonk configuration\n\n",
            "1. Visit your Listmonk URL and complete the setup wizard.\n",
            "2. Create an admin account (save these credentials — you will need them below).\n",
            "3. Go to **Lists** → **New list** and create a subscriber list.\n",
            "4. Note the numeric list ID shown in the URL (e.g. `/lists/1/...` → ID is `1`).\n\n",
            "## Configure your Astropress site\n\n",
            "Add these variables to your `.env` (local) or your host's environment settings (production):\n\n",
            "```\n",
            "NEWSLETTER_DELIVERY_MODE=listmonk\n",
            "LISTMONK_API_URL=https://your-listmonk-instance.example.com\n",
            "LISTMONK_API_USERNAME=your-admin-username\n",
            "LISTMONK_API_PASSWORD=your-admin-password\n",
            "LISTMONK_LIST_ID=1\n",
            "```\n\n",
            "`LISTMONK_API_URL` doubles as the `adminPath` used by `registerAstropressService` in `src/middleware.ts`.\n",
            "This means the Caddy proxy URL (not the internal `listmonk:9000` address) must be set here.\n\n",
            "## Test locally\n\n",
            "Set `NEWSLETTER_DELIVERY_MODE=mock` in `.env.local` to skip the API call during development.\n",
            "The mock adapter always returns `{ ok: true }` without contacting Listmonk.\n\n",
            "## Mailchimp subscriber migration\n\n",
            "If you are moving from Mailchimp:\n\n",
            "1. In Mailchimp, go to **Audience** → **Manage Contacts** → **Export Audience** → download as CSV.\n",
            "2. Convert the CSV to Listmonk import JSON:\n\n",
            "   ```json\n",
            "   [\n",
            "     { \"email\": \"subscriber@example.com\", \"name\": \"First Last\" }\n",
            "   ]\n",
            "   ```\n\n",
            "3. POST to your Listmonk instance:\n\n",
            "   ```sh\n",
            "   curl -u admin:password -X POST https://your-listmonk/api/subscribers/import \\\n",
            "     -H 'Content-Type: application/json' \\\n",
            "     -d '{ \"mode\": \"subscribe\", \"subscription_status\": \"confirmed\",\n",
            "          \"lists\": [1],\n",
            "          \"records\": [ { \"email\": \"subscriber@example.com\", \"name\": \"First Last\" } ] }'\n",
            "   ```\n\n",
            "   Replace `lists: [1]` with your actual list ID.\n",
        )));
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
        CmsChoice::Directus  => println!("    Content       Directus           → Fly.io / Railway (free)"),
        CmsChoice::Payload   => println!("    Content       Payload            ⚠ needs a Node server (Fly.io / Railway free)"),
    }
    if f.email       == EmailChoice::Listmonk        { println!("    Email         Listmonk           → Fly.io / Railway (free)"); }
    match f.analytics {
        AnalyticsProvider::Umami     => println!("    Analytics     Umami              → Railway / Fly.io (free)"),
        AnalyticsProvider::Plausible => println!("    Analytics     Plausible          ⚠ cloud $9/mo; self-host free"),
        AnalyticsProvider::Matomo    => println!("    Analytics     Matomo             ⚠ cloud $23/mo; self-host free"),
        AnalyticsProvider::PostHog   => println!("    Analytics     PostHog            → free tier, then paid"),
        AnalyticsProvider::Custom    => println!("    Analytics     Custom"),
        AnalyticsProvider::None      => {}
    }
    if f.commerce    == CommerceChoice::Medusa       { println!("    Storefront    Medusa             → Fly.io / Railway (free)  ⚠ needs Node server"); }
    if f.courses     == CourseChoice::FrappeLms      { println!("    Courses       Frappe LMS         → Fly.io / Railway (free)"); }
    if f.testimonials == TestimonialChoice::Formbricks { println!("    Testimonials  Formbricks         → formbricks.com (free tier)"); }
    if f.donations.polar        { println!("    Donations     Polar              → polar.sh (Apache 2.0, free tier)"); }
    if f.donations.give_lively  { println!("    Donations     GiveLively         → givelively.org (free for nonprofits)"); }
    if f.donations.liberapay    { println!("    Donations     Liberapay          → liberapay.com (free, OSS-friendly)"); }
    if f.donations.pledge_crypto { println!("    Donations     PledgeCrypto       → pledgecrypto.com (free; auto carbon offsets)"); }
    if f.payments    == PaymentChoice::HyperSwitch   { println!("    Payments      HyperSwitch        → Fly.io / Railway (free); provider fees apply"); }
    if f.forum       == ForumChoice::Flarum          { println!("    Forum         Flarum             → Fly.io / Railway (free)"); }
    if f.chat        == ChatChoice::Chatwoot         { println!("    Live chat     Chatwoot           → Fly.io / Railway (free)"); }
    if f.notify      == NotifyChoice::Ntfy           { println!("    Push notify   ntfy               → ntfy.sh (free) or self-host"); }
    if f.schedule    == ScheduleChoice::Rallly       { println!("    Scheduling    Rallly             → Fly.io / Railway (free)"); }
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
        HeatmapProvider::OpenReplay => println!("    Replays       OpenReplay         → self-hosted"),
        HeatmapProvider::PostHog    => println!("    Replays       PostHog            → same script as analytics"),
        HeatmapProvider::Custom     => println!("    Replays       Custom"),
        HeatmapProvider::None       => {}
    }
    if f.job_board  { println!("    Job board     content type       → see content-types.example.ts"); }
    if f.enable_api { println!("    REST API      enabled            → /ap-api/v1/* (Bearer token)"); }
    println!("  ─────────────────────────────────────────────────────");
}
