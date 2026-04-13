//! Env stubs and config file stubs for optional features.
//! Extracted from features.rs to keep that file under the 300-line limit.
//!
//! Docker Compose and SERVICES.md generation lives in `service_docs.rs`.
//! The human-readable stack summary printed at the end of `astropress new`
//! lives in `stack_summary.rs`.

use crate::docs_stubs::docs_config_stubs;
use crate::features::{
    AllFeatures, ChatChoice, CmsChoice, CommerceChoice, CommunityChoice, CourseChoice,
    CrmChoice, DocsChoice, EmailChoice, EventChoice, FormsChoice, ForumChoice,
    KnowledgeBaseChoice, NotifyChoice, PaymentChoice, PodcastChoice, ScheduleChoice,
    SearchChoice, SsoChoice, StatusChoice, TransactionalEmailChoice, VideoChoice,
};
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
    if f.search == SearchChoice::Typesense {
        lines.extend(&["# Typesense (typo-tolerant full-text search — GPL-3.0)",
            "TYPESENSE_HOST=localhost",
            "TYPESENSE_PORT=8108",
            "TYPESENSE_PROTOCOL=http",
            "TYPESENSE_API_KEY=replace-me"]);
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
    // ── A/B testing / feature flags ──────────────────────────────────────
    // (analytics handled separately via ScaffoldOptions; these cover the
    // standalone providers selected in new_wizard_more)

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
    if f.chat == ChatChoice::Chatwoot {
        lines.extend(&["# Chatwoot (omnichannel customer support — MIT)",
            "CHATWOOT_API_URL=http://localhost:3000",
            "CHATWOOT_API_TOKEN=replace-me",
            "CHATWOOT_WEBSITE_TOKEN=replace-me"]);
    }
    if f.payments == PaymentChoice::HyperSwitch {
        lines.extend(&["# HyperSwitch (payment router — Apache 2.0, self-hosted Rust service)",
            "# Native connectors include: Safaricom M-Pesa (Daraja), Stripe (cards/Apple Pay/Google Pay),",
            "# Razorpay (UPI/India/IMPS/NEFT), PayPal (Venmo), Square (Cash App), Adyen, Braintree, 50+ more.",
            "# Upstream contrib: https://github.com/juspay/hyperswitch — add connectors in crates/router/src/connector/",
            "# Add provider API keys via the HyperSwitch dashboard after deploying.",
            "HYPERSWITCH_API_KEY=replace-me",
            "HYPERSWITCH_BASE_URL=http://localhost:8080",
            "PAYMENT_SUCCESS_REDIRECT_URL=https://yourdomain.com/payment/success",
            "PAYMENT_FAILURE_REDIRECT_URL=https://yourdomain.com/payment/failure"]);
    }
    if f.payments == PaymentChoice::MpesaDaraja {
        lines.extend(&["# M-Pesa Daraja API (Safaricom — direct mobile money integration, no self-hosted service needed)",
            "# Daraja API docs: https://developer.safaricom.co.ke/Documentation",
            "# Register at https://developer.safaricom.co.ke → Create App → get Consumer Key + Secret.",
            "# STK Push (Lipa Na M-Pesa Online) requires a Shortcode and Passkey from Safaricom.",
            "MPESA_CONSUMER_KEY=replace-me",
            "MPESA_CONSUMER_SECRET=replace-me",
            "MPESA_SHORTCODE=174379",
            "MPESA_PASSKEY=replace-me",
            "MPESA_BASE_URL=https://sandbox.safaricom.co.ke",
            "MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback"]);
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
    if f.transactional_email == TransactionalEmailChoice::Resend {
        lines.extend(&["# Resend (transactional email — MIT SDK)",
            "# Use for password resets, order confirmations, and notifications.",
            "# Sign up at https://resend.com → API Keys → Create API key.",
            "EMAIL_DELIVERY_MODE=resend",
            "RESEND_API_KEY=re_replace-me",
            "RESEND_FROM_EMAIL=noreply@yourdomain.com"]);
    }
    if f.transactional_email == TransactionalEmailChoice::Smtp {
        lines.extend(&["# SMTP (transactional email — generic contract)",
            "# Use for password resets, order confirmations, and notifications.",
            "# Works with Postal, Brevo SMTP, Amazon SES SMTP, Mailgun SMTP, and similar relays.",
            "EMAIL_DELIVERY_MODE=smtp",
            "SMTP_HOST=smtp.example.com", "SMTP_PORT=587",
            "SMTP_USERNAME=replace-me", "SMTP_PASSWORD=replace-me",
            "SMTP_FROM_EMAIL=noreply@yourdomain.com"]);
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
    match f.docs {
        DocsChoice::Starlight => lines.push(
            "# Starlight docs (MIT, Astro team) — see DOCS.md to complete setup",
        ),
        DocsChoice::VitePress => lines.push(
            "# VitePress docs site (MIT, Vue team) — see docs/README.md to build",
        ),
        DocsChoice::MdBook => lines.push(
            "# mdBook docs site (MPL-2.0, Rust project) — see docs/README.md to build",
        ),
        DocsChoice::None => {}
    }

    if lines.is_empty() { String::new() }
    else { format!("\n# Optional integrations\n{}\n", lines.join("\n")) }
}

// ── config file stubs ─────────────────────────────────────────────────────────

pub(crate) fn feature_config_stubs(f: &AllFeatures) -> Vec<(&'static str, &'static str)> {
    let mut files: Vec<(&'static str, &'static str)> = Vec::new();

    // Per-service docker-compose + .env.example files
    files.extend(service_compose_stubs(f));

    // Docs-site generator stubs (Starlight / VitePress / mdBook).
    files.extend(docs_config_stubs(f));

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
