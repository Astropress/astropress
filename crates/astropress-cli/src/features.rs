//! Optional integration choices for `astropress new`.
//! Each feature has an enum, env stubs, optional config file stubs, and a summary label.

use crate::providers::{AbTestingProvider, AnalyticsProvider, HeatmapProvider};

// ── one enum per optional feature ────────────────────────────────────────────

/// Content backend for the project. AstroPress is always the admin panel;
/// this selects what stores and serves the content data.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CmsChoice { BuiltIn, Keystatic, Directus, Payload }

#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum EmailChoice      { None, Listmonk }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CommerceChoice   { None, Medusa }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CommunityChoice  { None, Giscus, Remark42 }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum SearchChoice     { None, Pagefind }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CourseChoice     { None, FrappeLms }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum TestimonialChoice{ None, Formbricks }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum DonationChoice   { None, Polar }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ForumChoice      { None, Flarum }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ChatChoice       { None, Chatwoot }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum PaymentChoice    { None, HyperSwitch }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum NotifyChoice     { None, Ntfy }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ScheduleChoice   { None, Rallly }

// ── aggregated feature bag ────────────────────────────────────────────────────

pub(crate) struct AllFeatures {
    pub cms:          CmsChoice,
    pub email:        EmailChoice,
    pub commerce:     CommerceChoice,
    pub community:    CommunityChoice,
    pub search:       SearchChoice,
    pub courses:      CourseChoice,
    pub testimonials: TestimonialChoice,
    pub donations:    DonationChoice,
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
            donations:    DonationChoice::None,
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
    fn directus_generates_env_stubs() {
        let f = AllFeatures { cms: CmsChoice::Directus, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("DIRECTUS_URL"));
        assert!(s.contains("DIRECTUS_TOKEN"));
    }

    #[test]
    fn builtin_cms_produces_no_stubs() {
        let f = AllFeatures::defaults(); // cms = BuiltIn, community = Giscus (no stubs)
        assert!(feature_env_stubs(&f).is_empty());
        assert!(feature_config_stubs(&f).is_empty());
    }

    // ── email ─────────────────────────────────────────────────────────────

    #[test]
    fn listmonk_generates_api_env_entries() {
        let f = AllFeatures { email: EmailChoice::Listmonk, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("LISTMONK_API_URL"));
        assert!(s.contains("LISTMONK_API_TOKEN"));
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
        let f = AllFeatures { donations: DonationChoice::Polar, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("POLAR_ACCESS_TOKEN"));
        assert!(s.contains("POLAR_ORGANIZATION_ID"));
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
    fn chatwoot_generates_env_stubs() {
        let f = AllFeatures { chat: ChatChoice::Chatwoot, ..AllFeatures::defaults() };
        let s = feature_env_stubs(&f);
        assert!(s.contains("CHATWOOT_URL"));
        assert!(s.contains("CHATWOOT_API_ACCESS_TOKEN"));
        assert!(s.contains("CHATWOOT_INBOX_ID"));
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
