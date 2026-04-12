//! Optional integration choices for `astropress new`.
//! Each feature has an enum, env stubs, optional config file stubs, and a summary label.

use crate::providers::{AbTestingProvider, AnalyticsProvider, HeatmapProvider};

// ── one enum per optional feature ────────────────────────────────────────────

/// Content backend for the project. AstroPress is always the admin panel;
/// this selects what stores and serves the content data.
/// Directus (BSL 1.1) and Strapi v5 (custom non-OSI licence) are excluded;
/// all remaining options are MIT or Apache 2.0.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CmsChoice { BuiltIn, Keystatic, Payload }

#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum EmailChoice             { None, Listmonk }
/// Brevo = SaaS SMTP (300 emails/day free; no server to run).
/// Postal = self-hosted SMTP server (MIT; Fly.io / Railway free; needs dedicated IP for best deliverability).
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum TransactionalEmailChoice { None, Brevo, Postal }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CommerceChoice          { None, Medusa, Vendure }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CommunityChoice         { None, Giscus, Remark42 }
/// Pagefind = static index at build time (zero server).
/// Meilisearch = running service with full-text search API (MIT).
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum SearchChoice            { None, Pagefind, Meilisearch }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CourseChoice            { None, FrappeLms }
/// Forms, surveys, testimonials, and conversational flows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum FormsChoice             { None, Formbricks, Typebot }
/// Multiple donation providers can be enabled simultaneously.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DonationChoices {
    pub polar:         bool,
    pub give_lively:   bool,
    pub liberapay:     bool,
    pub pledge_crypto: bool,
}
impl Default for DonationChoices {
    fn default() -> Self {
        Self { polar: false, give_lively: false, liberapay: false, pledge_crypto: false }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ForumChoice             { None, Flarum, Discourse }
/// Chatwoot excluded (EE split). Tiledesk is fully Apache 2.0.
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ChatChoice              { None, Tiledesk }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum PaymentChoice           { None, HyperSwitch }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum NotifyChoice            { None, Ntfy, Gotify }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ScheduleChoice          { None, Rallly, CalCom }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum VideoChoice             { None, PeerTube }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum PodcastChoice           { None, Castopod }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum EventChoice             { None, HiEvents, Pretix }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum StatusChoice            { None, UptimeKuma }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum KnowledgeBaseChoice     { None, BookStack }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CrmChoice               { None, Twenty }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum SsoChoice               { None, Authentik, Zitadel }

// ── aggregated feature bag ────────────────────────────────────────────────────

#[derive(Debug)]
pub(crate) struct AllFeatures {
    pub cms:                CmsChoice,
    pub email:              EmailChoice,
    pub transactional_email: TransactionalEmailChoice,
    pub commerce:           CommerceChoice,
    pub community:          CommunityChoice,
    pub search:             SearchChoice,
    pub courses:            CourseChoice,
    pub forms:              FormsChoice,
    pub donations:          DonationChoices,
    pub forum:              ForumChoice,
    pub chat:               ChatChoice,
    pub payments:           PaymentChoice,
    pub notify:             NotifyChoice,
    pub schedule:           ScheduleChoice,
    pub video:              VideoChoice,
    pub podcast:            PodcastChoice,
    pub events:             EventChoice,
    pub status:             StatusChoice,
    pub knowledge_base:     KnowledgeBaseChoice,
    pub crm:                CrmChoice,
    pub sso:                SsoChoice,
    pub job_board:          bool,
    pub analytics:          AnalyticsProvider,
    pub ab_testing:         AbTestingProvider,
    pub heatmap:            HeatmapProvider,
    pub enable_api:         bool,
}

impl AllFeatures {
    pub(crate) fn defaults() -> Self {
        AllFeatures {
            cms:                CmsChoice::BuiltIn,
            email:              EmailChoice::None,
            transactional_email: TransactionalEmailChoice::None,
            commerce:           CommerceChoice::None,
            community:          CommunityChoice::Giscus,
            search:             SearchChoice::None,
            courses:            CourseChoice::None,
            forms:              FormsChoice::None,
            donations:          DonationChoices::default(),
            forum:              ForumChoice::None,
            chat:               ChatChoice::None,
            payments:           PaymentChoice::None,
            notify:             NotifyChoice::None,
            schedule:           ScheduleChoice::None,
            video:              VideoChoice::None,
            podcast:            PodcastChoice::None,
            events:             EventChoice::None,
            status:             StatusChoice::None,
            knowledge_base:     KnowledgeBaseChoice::None,
            crm:                CrmChoice::None,
            sso:                SsoChoice::None,
            job_board:          false,
            analytics:          AnalyticsProvider::None,
            ab_testing:         AbTestingProvider::None,
            heatmap:            HeatmapProvider::None,
            enable_api:         false,
        }
    }
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::feature_stubs::{feature_config_stubs, feature_env_stubs};

    // ── CMS ───────────────────────────────────────────────────────────────

    #[test]
    fn cms_default_is_builtin() {
        assert!(matches!(AllFeatures::defaults().cms, CmsChoice::BuiltIn));
    }

    #[test]
    fn payload_generates_config_stub() {
        let f = AllFeatures { cms: CmsChoice::Payload, ..AllFeatures::defaults() };
        let files = feature_config_stubs(&f);
        let paths: Vec<_> = files.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"payload.config.ts"), "expected payload.config.ts, got {paths:?}");
        let content = files.iter().find(|(p, _)| *p == "payload.config.ts").unwrap().1;
        assert!(content.contains("buildConfig"));
    }

    #[test]
    fn payload_generates_payload_secret_env_stub() {
        let f = AllFeatures { cms: CmsChoice::Payload, ..AllFeatures::defaults() };
        assert!(feature_env_stubs(&f).contains("PAYLOAD_SECRET"));
    }

    #[test]
    fn keystatic_generates_config_stub() {
        let f = AllFeatures { cms: CmsChoice::Keystatic, ..AllFeatures::defaults() };
        let files = feature_config_stubs(&f);
        let paths: Vec<_> = files.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"keystatic.config.ts"), "expected keystatic.config.ts, got {paths:?}");
        let content = files.iter().find(|(p, _)| *p == "keystatic.config.ts").unwrap().1;
        assert!(content.contains("@keystatic/core"));
    }

    #[test]
    fn builtin_cms_produces_no_stubs() {
        let f = AllFeatures::defaults(); // cms = BuiltIn, community = Giscus (no stubs)
        assert!(feature_env_stubs(&f).is_empty());
        assert!(feature_config_stubs(&f).is_empty());
    }

    // ── email ─────────────────────────────────────────────────────────────

    #[test]
    fn listmonk_generates_env_stubs() {
        let f = AllFeatures { email: EmailChoice::Listmonk, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("NEWSLETTER_DELIVERY_MODE=listmonk"));
        assert!(s.contains("LISTMONK_API_URL"));
        assert!(s.contains("LISTMONK_API_USERNAME"));
        assert!(s.contains("LISTMONK_API_PASSWORD"));
        assert!(s.contains("LISTMONK_LIST_ID"));
    }

    #[test]
    fn listmonk_generates_caddy_proxy_files() {
        // Compose files now come from service_docs::service_compose_stubs() via feature_config_stubs().
        let f = AllFeatures { email: EmailChoice::Listmonk, ..AllFeatures::defaults() };
        let stubs = feature_config_stubs(&f);
        let paths: Vec<&str> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"listmonk/Caddyfile"), "{paths:?}");
        assert!(paths.contains(&"listmonk/docker-compose.yml"), "{paths:?}");
        assert!(paths.contains(&"listmonk/.env.listmonk.example"), "{paths:?}");
        let caddyfile = stubs.iter().find(|(p, _)| *p == "listmonk/Caddyfile").unwrap().1;
        assert!(caddyfile.contains("header_down -X-Frame-Options"));
        assert!(caddyfile.contains("frame-ancestors"));
        let compose = stubs.iter().find(|(p, _)| *p == "listmonk/docker-compose.yml").unwrap().1;
        assert!(compose.contains("caddy:2-alpine"));
        assert!(compose.contains("listmonk/listmonk:latest"));
        assert!(compose.contains("postgres:16-alpine"));
    }

    #[test]
    fn listmonk_generates_middleware_with_register_service() {
        let f = AllFeatures { email: EmailChoice::Listmonk, ..AllFeatures::defaults() };
        let stubs = feature_config_stubs(&f);
        let mw = stubs.iter().find(|(p, _)| *p == "src/middleware.ts");
        assert!(mw.is_some(), "src/middleware.ts not generated");
        let content = mw.unwrap().1;
        assert!(content.contains("registerAstropressService"));
        assert!(content.contains("provider: \"email\""));
        assert!(content.contains("registerCms"));
        assert!(content.contains("createAstropressSecurityMiddleware"));
    }

    #[test]
    fn brevo_generates_env_stubs() {
        let f = AllFeatures { transactional_email: TransactionalEmailChoice::Brevo, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("BREVO_SMTP_HOST"));
        assert!(s.contains("BREVO_SMTP_PASSWORD"));
        assert!(s.contains("BREVO_FROM_ADDRESS"));
    }

    #[test]
    fn postal_generates_env_stubs() {
        let f = AllFeatures { transactional_email: TransactionalEmailChoice::Postal, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("POSTAL_SMTP_HOST"));
        assert!(s.contains("POSTAL_FROM_ADDRESS"));
    }

    // ── commerce ──────────────────────────────────────────────────────────

    #[test]
    fn medusa_config_and_env_stubs() {
        let f = AllFeatures { commerce: CommerceChoice::Medusa, ..AllFeatures::defaults() };
        assert!(feature_env_stubs(&f).contains("MEDUSA_BACKEND_URL"));
        assert!(feature_config_stubs(&f).iter().any(|(p, _)| *p == "medusa-config.js"));
    }

    // ── community / comments ──────────────────────────────────────────────

    #[test]
    fn remark42_env_stubs() {
        let f = AllFeatures { community: CommunityChoice::Remark42, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("REMARK42_URL"));
        assert!(s.contains("REMARK42_SITE_ID"));
    }

    // ── search ────────────────────────────────────────────────────────────

    #[test]
    fn pagefind_adds_build_note() {
        let f = AllFeatures { search: SearchChoice::Pagefind, ..AllFeatures::defaults() };
        assert!(feature_env_stubs(&f).to_lowercase().contains("pagefind"));
    }

    // ── courses ───────────────────────────────────────────────────────────

    #[test]
    fn frappe_lms_generates_env_stubs() {
        let f = AllFeatures { courses: CourseChoice::FrappeLms, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("FRAPPE_LMS_URL"));
        assert!(s.contains("FRAPPE_LMS_API_KEY"));
    }

    // ── forms ─────────────────────────────────────────────────────────────

    #[test]
    fn formbricks_env_stubs() {
        let f = AllFeatures { forms: FormsChoice::Formbricks, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("FORMBRICKS_API_KEY"));
        assert!(s.contains("FORMBRICKS_ENVIRONMENT_ID"));
    }

    #[test]
    fn typebot_generates_env_stubs() {
        let f = AllFeatures { forms: FormsChoice::Typebot, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("TYPEBOT_URL"));
        assert!(s.contains("TYPEBOT_API_TOKEN"));
    }

    // ── donations ─────────────────────────────────────────────────────────

    #[test]
    fn polar_generates_env_stubs() {
        let f = AllFeatures {
            donations: DonationChoices { polar: true, ..DonationChoices::default() },
            ..AllFeatures::defaults()
        };
        let s = feature_env_stubs(&f);
        assert!(s.contains("POLAR_ACCESS_TOKEN"));
        assert!(s.contains("POLAR_ORGANIZATION_ID"));
    }

    #[test]
    fn give_lively_generates_env_stubs() {
        let f = AllFeatures {
            donations: DonationChoices { give_lively: true, ..DonationChoices::default() },
            ..AllFeatures::defaults()
        };
        let s = feature_env_stubs(&f);
        assert!(s.contains("GIVELIVELY_ORG_SLUG"));
    }

    #[test]
    fn liberapay_generates_env_stubs() {
        let f = AllFeatures {
            donations: DonationChoices { liberapay: true, ..DonationChoices::default() },
            ..AllFeatures::defaults()
        };
        assert!(feature_env_stubs(&f).contains("LIBERAPAY_USERNAME"));
    }

    #[test]
    fn pledge_crypto_generates_env_stubs() {
        let f = AllFeatures {
            donations: DonationChoices { pledge_crypto: true, ..DonationChoices::default() },
            ..AllFeatures::defaults()
        };
        assert!(feature_env_stubs(&f).contains("PLEDGE_PARTNER_KEY"));
    }

    #[test]
    fn multiple_donation_providers_generate_all_stubs() {
        let f = AllFeatures {
            donations: DonationChoices {
                give_lively: true, liberapay: true, pledge_crypto: true,
                ..DonationChoices::default()
            },
            ..AllFeatures::defaults()
        };
        let s = feature_env_stubs(&f);
        assert!(s.contains("GIVELIVELY_ORG_SLUG"));
        assert!(s.contains("LIBERAPAY_USERNAME"));
        assert!(s.contains("PLEDGE_PARTNER_KEY"));
    }

    // ── forum ─────────────────────────────────────────────────────────────

    #[test]
    fn flarum_generates_env_stubs() {
        let f = AllFeatures { forum: ForumChoice::Flarum, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("FLARUM_URL"));
        assert!(s.contains("FLARUM_API_KEY"));
    }

    // ── live chat ─────────────────────────────────────────────────────────

    #[test]
    fn tiledesk_generates_env_stubs() {
        let f = AllFeatures { chat: ChatChoice::Tiledesk, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("TILEDESK_API_URL"));
        assert!(s.contains("TILEDESK_PROJECT_ID"));
        assert!(s.contains("TILEDESK_TOKEN"));
    }

    // ── payments ──────────────────────────────────────────────────────────

    #[test]
    fn hyperswitch_env_mentions_providers() {
        let f = AllFeatures { payments: PaymentChoice::HyperSwitch, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("HYPERSWITCH_API_KEY"));
        assert!(s.contains("Razorpay"));
        assert!(s.contains("M-PESA"));
    }

    #[test]
    fn hyperswitch_env_includes_redirect_urls() {
        let f = AllFeatures { payments: PaymentChoice::HyperSwitch, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("PAYMENT_SUCCESS_REDIRECT_URL"));
        assert!(s.contains("PAYMENT_FAILURE_REDIRECT_URL"));
    }

    // ── notifications ─────────────────────────────────────────────────────

    #[test]
    fn ntfy_env_stubs() {
        let f = AllFeatures { notify: NotifyChoice::Ntfy, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("NTFY_URL"));
        assert!(s.contains("NTFY_TOPIC"));
    }

    // ── scheduling ────────────────────────────────────────────────────────

    #[test]
    fn rallly_generates_env_stubs() {
        let f = AllFeatures { schedule: ScheduleChoice::Rallly, ..AllFeatures::defaults() };
        assert!(feature_env_stubs(&f).contains("RALLLY_URL"));
    }

    // ── video ─────────────────────────────────────────────────────────────

    #[test]
    fn peertube_generates_env_stubs() {
        let f = AllFeatures { video: VideoChoice::PeerTube, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("PEERTUBE_URL"));
        assert!(s.contains("PEERTUBE_API_TOKEN"));
    }

    // ── podcast ───────────────────────────────────────────────────────────

    #[test]
    fn castopod_generates_env_stubs() {
        let f = AllFeatures { podcast: PodcastChoice::Castopod, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("CASTOPOD_URL"));
        assert!(s.contains("CASTOPOD_API_TOKEN"));
    }

    // ── events ────────────────────────────────────────────────────────────

    #[test]
    fn hievents_generates_env_stubs() {
        let f = AllFeatures { events: EventChoice::HiEvents, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("HIEVENTS_URL"));
        assert!(s.contains("HIEVENTS_API_KEY"));
    }

    #[test]
    fn pretix_generates_env_stubs() {
        let f = AllFeatures { events: EventChoice::Pretix, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("PRETIX_URL"));
        assert!(s.contains("PRETIX_API_TOKEN"));
        assert!(s.contains("PRETIX_ORGANIZER"));
    }

    // ── status ────────────────────────────────────────────────────────────

    #[test]
    fn uptime_kuma_generates_env_stubs() {
        let f = AllFeatures { status: StatusChoice::UptimeKuma, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("UPTIME_KUMA_URL"));
    }

    // ── knowledge base ────────────────────────────────────────────────────

    #[test]
    fn bookstack_generates_env_stubs() {
        let f = AllFeatures { knowledge_base: KnowledgeBaseChoice::BookStack, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("BOOKSTACK_URL"));
        assert!(s.contains("BOOKSTACK_TOKEN_ID"));
        assert!(s.contains("BOOKSTACK_TOKEN_SECRET"));
    }

    // ── crm ───────────────────────────────────────────────────────────────

    #[test]
    fn twenty_generates_env_stubs() {
        let f = AllFeatures { crm: CrmChoice::Twenty, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("TWENTY_URL"));
        assert!(s.contains("TWENTY_API_KEY"));
    }

    // ── sso ───────────────────────────────────────────────────────────────

    #[test]
    fn authentik_generates_env_stubs() {
        let f = AllFeatures { sso: SsoChoice::Authentik, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("AUTHENTIK_URL"));
        assert!(s.contains("AUTHENTIK_TOKEN"));
    }

    #[test]
    fn zitadel_generates_env_stubs() {
        let f = AllFeatures { sso: SsoChoice::Zitadel, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("ZITADEL_DOMAIN"));
        assert!(s.contains("ZITADEL_CLIENT_ID"));
        assert!(s.contains("ZITADEL_CLIENT_SECRET"));
    }

    // ── job board ─────────────────────────────────────────────────────────

    #[test]
    fn job_board_generates_content_type_stub() {
        let f = AllFeatures { job_board: true, ..AllFeatures::defaults() };
        let files = feature_config_stubs(&f);
        let file = files.iter().find(|(p, _)| *p == "content-types.example.ts");
        assert!(file.is_some(), "expected content-types.example.ts");
        assert!(file.unwrap().1.contains("jobListingContentType"));
    }
}
