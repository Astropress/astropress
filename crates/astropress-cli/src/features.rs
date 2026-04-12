//! Optional integration choices for `astropress new`.
//! Each feature has an enum, env stubs, optional config file stubs, and a summary label.

use crate::providers::{AbTestingProvider, AnalyticsProvider, HeatmapProvider};

// ── one enum per optional feature ────────────────────────────────────────────

/// Content backend for the project. AstroPress is always the admin panel;
/// this selects what stores and serves the content data.
/// Content backend. Directus (BSL 1.1) and Strapi v5 (custom non-OSI licence)
/// are excluded; all remaining options are MIT or Apache 2.0.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CmsChoice { BuiltIn, Keystatic, Payload }

#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum EmailChoice      { None, Listmonk }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CommerceChoice   { None, Medusa, Vendure }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CommunityChoice  { None, Giscus, Remark42 }
/// Pagefind = static index at build time (zero server).
/// Meilisearch = running service with full-text search API (MIT).
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum SearchChoice     { None, Pagefind, Meilisearch }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CourseChoice     { None, FrappeLms }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum TestimonialChoice{ None, Formbricks }
/// Multiple donation providers can be enabled simultaneously.
/// Polar remains an exclusive single-provider option (SaaS paid posts model).
/// GiveLively, Liberapay, and PledgeCrypto are widget-based and go through the JS bridge.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DonationChoices {
    pub polar:        bool,
    pub give_lively:  bool,
    pub liberapay:    bool,
    pub pledge_crypto: bool,
}
impl Default for DonationChoices {
    fn default() -> Self {
        Self { polar: false, give_lively: false, liberapay: false, pledge_crypto: false }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ForumChoice      { None, Flarum, Discourse }
/// Chatwoot excluded (EE split — enterprise features are proprietary).
/// Tiledesk is fully Apache 2.0.
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ChatChoice       { None, Tiledesk }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum PaymentChoice    { None, HyperSwitch }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum NotifyChoice     { None, Ntfy, Gotify }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ScheduleChoice   { None, Rallly, CalCom }

// ── aggregated feature bag ────────────────────────────────────────────────────

pub(crate) struct AllFeatures {
    pub cms:          CmsChoice,
    pub email:        EmailChoice,
    pub commerce:     CommerceChoice,
    pub community:    CommunityChoice,
    pub search:       SearchChoice,
    pub courses:      CourseChoice,
    pub testimonials: TestimonialChoice,
    pub donations:    DonationChoices,
    pub forum:        ForumChoice,
    pub chat:         ChatChoice,
    pub payments:     PaymentChoice,
    pub notify:       NotifyChoice,
    pub schedule:     ScheduleChoice,
    pub job_board:    bool,
    pub analytics:    AnalyticsProvider,
    pub ab_testing:   AbTestingProvider,
    pub heatmap:      HeatmapProvider,
    pub enable_api:   bool,
}

impl AllFeatures {
    pub(crate) fn defaults() -> Self {
        AllFeatures {
            cms:          CmsChoice::BuiltIn,
            email:        EmailChoice::None,
            commerce:     CommerceChoice::None,
            community:    CommunityChoice::Giscus,
            search:       SearchChoice::None,
            courses:      CourseChoice::None,
            testimonials: TestimonialChoice::None,
            donations:    DonationChoices::default(),
            forum:        ForumChoice::None,
            chat:         ChatChoice::None,
            payments:     PaymentChoice::None,
            notify:       NotifyChoice::None,
            schedule:     ScheduleChoice::None,
            job_board:    false,
            analytics:    AnalyticsProvider::None,
            ab_testing:   AbTestingProvider::None,
            heatmap:      HeatmapProvider::None,
            enable_api:   false,
        }
    }
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::feature_stubs::{feature_config_stubs, feature_env_stubs};

    // ── CMS choices ───────────────────────────────────────────────────────

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
        assert!(s.contains("NEWSLETTER_DELIVERY_MODE=listmonk"), "missing NEWSLETTER_DELIVERY_MODE");
        assert!(s.contains("LISTMONK_API_URL"), "missing LISTMONK_API_URL");
        assert!(s.contains("LISTMONK_API_USERNAME"), "missing LISTMONK_API_USERNAME");
        assert!(s.contains("LISTMONK_API_PASSWORD"), "missing LISTMONK_API_PASSWORD");
        assert!(s.contains("LISTMONK_LIST_ID"), "missing LISTMONK_LIST_ID");
    }

    #[test]
    fn listmonk_generates_setup_doc() {
        let f = AllFeatures { email: EmailChoice::Listmonk, ..AllFeatures::defaults() };
        let stubs = feature_config_stubs(&f);
        let listmonk_md = stubs.iter().find(|(p, _)| *p == "LISTMONK.md");
        assert!(listmonk_md.is_some(), "LISTMONK.md not generated");
        let content = listmonk_md.unwrap().1;
        assert!(content.contains("LISTMONK_API_URL"), "missing LISTMONK_API_URL in LISTMONK.md");
        assert!(content.contains("LISTMONK_API_USERNAME"), "missing LISTMONK_API_USERNAME in LISTMONK.md");
        assert!(content.contains("LISTMONK_API_PASSWORD"), "missing LISTMONK_API_PASSWORD in LISTMONK.md");
        assert!(content.contains("LISTMONK_LIST_ID"), "missing LISTMONK_LIST_ID in LISTMONK.md");
        assert!(content.contains("NEWSLETTER_DELIVERY_MODE"), "missing NEWSLETTER_DELIVERY_MODE in LISTMONK.md");
        assert!(content.contains("Fly.io"), "missing Fly.io instructions in LISTMONK.md");
        // verify all three generated files are mentioned
        assert!(content.contains("docker-compose.yml"), "LISTMONK.md should reference docker-compose.yml");
        assert!(content.contains("Caddyfile"), "LISTMONK.md should reference Caddyfile");
        assert!(content.contains("registerAstropressService"), "LISTMONK.md should mention registerAstropressService");
    }

    #[test]
    fn listmonk_generates_caddy_proxy_files() {
        let f = AllFeatures { email: EmailChoice::Listmonk, ..AllFeatures::defaults() };
        let stubs = feature_config_stubs(&f);
        let paths: Vec<&str> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"listmonk/Caddyfile"), "Caddyfile not generated");
        assert!(paths.contains(&"listmonk/docker-compose.yml"), "docker-compose.yml not generated");
        assert!(paths.contains(&"listmonk/.env.listmonk.example"), ".env.listmonk.example not generated");

        let caddyfile = stubs.iter().find(|(p, _)| *p == "listmonk/Caddyfile").unwrap().1;
        assert!(caddyfile.contains("header_down -X-Frame-Options"), "Caddyfile should strip X-Frame-Options");
        assert!(caddyfile.contains("frame-ancestors"), "Caddyfile should set frame-ancestors CSP");

        let compose = stubs.iter().find(|(p, _)| *p == "listmonk/docker-compose.yml").unwrap().1;
        assert!(compose.contains("caddy:2-alpine"), "docker-compose should include Caddy");
        assert!(compose.contains("listmonk/listmonk:latest"), "docker-compose should include Listmonk");
        assert!(compose.contains("postgres:16-alpine"), "docker-compose should include Postgres");
    }

    #[test]
    fn listmonk_generates_middleware_with_register_service() {
        let f = AllFeatures { email: EmailChoice::Listmonk, ..AllFeatures::defaults() };
        let stubs = feature_config_stubs(&f);
        let middleware = stubs.iter().find(|(p, _)| *p == "src/middleware.ts");
        assert!(middleware.is_some(), "src/middleware.ts not generated");
        let content = middleware.unwrap().1;
        assert!(content.contains("registerAstropressService"), "middleware should call registerAstropressService");
        assert!(content.contains("provider: \"email\""), "middleware should register email provider");
        assert!(content.contains("registerCms"), "middleware should still call registerCms");
        assert!(content.contains("createAstropressSecurityMiddleware"), "middleware should export security middleware");
    }

    // ── commerce ──────────────────────────────────────────────────────────

    #[test]
    fn medusa_config_and_env_stubs() {
        let f = AllFeatures { commerce: CommerceChoice::Medusa, ..AllFeatures::defaults() };
        assert!(feature_env_stubs(&f).contains("MEDUSA_BACKEND_URL"));
        assert!(feature_config_stubs(&f).iter().any(|(p, _)| *p == "medusa-config.js"));
    }

    #[test]
    fn medusa_generates_medusa_backend_url_env_stub() {
        let f = AllFeatures { commerce: CommerceChoice::Medusa, ..AllFeatures::defaults() };
        assert!(feature_env_stubs(&f).contains("MEDUSA_BACKEND_URL"));
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

    // ── testimonials ──────────────────────────────────────────────────────

    #[test]
    fn formbricks_env_stubs() {
        let f = AllFeatures { testimonials: TestimonialChoice::Formbricks, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("FORMBRICKS_API_KEY"));
        assert!(s.contains("FORMBRICKS_ENVIRONMENT_ID"));
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
        assert!(s.contains("GIVELIVELY_CAMPAIGN_SLUG"));
    }

    #[test]
    fn liberapay_generates_env_stubs() {
        let f = AllFeatures {
            donations: DonationChoices { liberapay: true, ..DonationChoices::default() },
            ..AllFeatures::defaults()
        };
        let s = feature_env_stubs(&f);
        assert!(s.contains("LIBERAPAY_USERNAME"));
    }

    #[test]
    fn pledge_crypto_generates_env_stubs() {
        let f = AllFeatures {
            donations: DonationChoices { pledge_crypto: true, ..DonationChoices::default() },
            ..AllFeatures::defaults()
        };
        let s = feature_env_stubs(&f);
        assert!(s.contains("PLEDGE_PARTNER_KEY"));
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
        assert!(s.contains("Razorpay"), "should mention Razorpay (UPI/India)");
        assert!(s.contains("M-PESA"), "should mention M-PESA");
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
