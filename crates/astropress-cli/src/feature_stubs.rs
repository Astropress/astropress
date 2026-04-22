//! Env stubs and config file stubs for optional features.
//! Extracted from features.rs to keep that file under the 300-line limit.
//!
//! Docker Compose and SERVICES.md generation lives in `service_docs.rs`.
//! The human-readable stack summary printed at the end of `astropress new`
//! lives in `stack_summary.rs`.

use crate::features::{
    AllFeatures, ChatChoice, CmsChoice, CommerceChoice, CommunityChoice, CourseChoice,
    CrmChoice, DocsChoice, EmailChoice, EventChoice, FormsChoice, ForumChoice,
    KnowledgeBaseChoice, NotifyChoice, PaymentChoice, PodcastChoice, ScheduleChoice,
    SearchChoice, SocialChoice, SsoChoice, StatusChoice, TransactionalEmailChoice, VideoChoice,
};

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
        lines.extend(&["# Formbricks (forms + surveys + testimonials + referrals — MIT community edition)",
            "FORMBRICKS_URL=http://localhost:3000", "FORMBRICKS_API_KEY=replace-me",
            "FORMBRICKS_ENVIRONMENT_ID=replace-me",
            "FORMBRICKS_WEBHOOK_SECRET=replace-me"]);
    }
    if f.forms == FormsChoice::Typebot {
        lines.extend(&["# Typebot (conversational forms + testimonials + referrals — AGPL 3.0)",
            "TYPEBOT_URL=https://typebot.io", "TYPEBOT_API_TOKEN=replace-me",
            "TYPEBOT_WEBHOOK_SECRET=replace-me"]);
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
        lines.extend(&["# HyperSwitch (payment router + Unified Checkout Web SDK — Apache 2.0 / MIT)",
            "# Made by Juspay (India). Native connectors span 6 regions — see SERVICES.md for the full table:",
            "#   East Africa:    Safaricom M-Pesa / Daraja (STK Push)",
            "#   W/S Africa:     Flutterwave (30+ countries), Paystack (NG/GH/KE/ZA)",
            "#   India:          Razorpay (UPI/IMPS/NEFT), Cashfree (UPI QR), PayU, PhonePe",
            "#   SE Asia:        Xendit (GCash/Maya/QRIS), Adyen (GrabPay/PromptPay/PayNow/FPX)",
            "#   Middle East:    Noon (AE/SA/EG/JO), Checkout.com (mada/KNET/BENEFIT/Fawry)",
            "#   Latin America:  dLocal (PIX/OXXO/Boleto/PSE, 15 countries), Ebanx, PayU",
            "#   Global:         Stripe (cards/Apple Pay/Google Pay), Adyen, PayPal, Checkout.com",
            "# HYPERSWITCH_API_KEY         — server-side; used to create PaymentIntents.",
            "# HYPERSWITCH_PUBLISHABLE_KEY — client-side; used by src/components/HyperCheckout.astro.",
            "HYPERSWITCH_API_KEY=replace-me",
            "HYPERSWITCH_PUBLISHABLE_KEY=replace-me",
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
    if f.social == SocialChoice::Postiz {
        lines.extend(&["# Postiz (social media cross-posting — AGPL 3.0)",
            "# Platforms: LinkedIn, Bluesky, Mastodon, Twitter/X, Instagram, TikTok, Pinterest,",
            "#            Reddit, Threads, Facebook, YouTube",
            "POSTIZ_URL=http://localhost:5000",
            "POSTIZ_API_TOKEN=replace-me"]);
    }
    if f.social == SocialChoice::Mixpost {
        lines.extend(&["# Mixpost (social media scheduler — MIT community edition)",
            "# Platforms: Twitter/X, Facebook, Instagram, LinkedIn, Pinterest, TikTok, Mastodon",
            "# Note: Bluesky is not supported in the community edition.",
            "MIXPOST_URL=http://localhost:8080",
            "MIXPOST_API_TOKEN=replace-me"]);
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

#[path = "feature_stubs_config.rs"]
mod feature_stubs_config;
pub(crate) use feature_stubs_config::feature_config_stubs;
