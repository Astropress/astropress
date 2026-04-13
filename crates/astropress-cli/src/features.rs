//! Feature enums and the aggregated `AllFeatures` struct collected by the
//! `new` and `add` commands. Tests live in `features_tests.rs` to keep this
//! module under the 300-line arch-lint warning.

use crate::providers::{AbTestingProvider, AnalyticsProvider, HeatmapProvider};

// ── one enum per optional feature ────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CmsChoice { BuiltIn, Keystatic, Payload }

#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum EmailChoice             { None, Listmonk }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum TransactionalEmailChoice { None, Resend, Smtp }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CommerceChoice          { None, Medusa, Vendure }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CommunityChoice         { None, Giscus, Remark42 }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum SearchChoice            { None, Pagefind, Meilisearch, Typesense }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum CourseChoice            { None, FrappeLms }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum FormsChoice             { None, Formbricks, Typebot }

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DonationChoices {
    pub polar: bool,
    pub give_lively: bool,
    pub liberapay: bool,
    pub pledge_crypto: bool,
}
impl Default for DonationChoices {
    fn default() -> Self {
        Self { polar: false, give_lively: false, liberapay: false, pledge_crypto: false }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ForumChoice             { None, Flarum, Discourse }
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum ChatChoice              { None, Tiledesk, Chatwoot }
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
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub(crate) enum DocsChoice              { None, Starlight, VitePress, MdBook }

// ── aggregated feature bag ────────────────────────────────────────────────────

#[derive(Debug)]
pub(crate) struct AllFeatures {
    pub cms:                 CmsChoice,
    pub email:               EmailChoice,
    pub transactional_email: TransactionalEmailChoice,
    pub commerce:            CommerceChoice,
    pub community:           CommunityChoice,
    pub search:              SearchChoice,
    pub courses:             CourseChoice,
    pub forms:               FormsChoice,
    pub donations:           DonationChoices,
    pub forum:               ForumChoice,
    pub chat:                ChatChoice,
    pub payments:            PaymentChoice,
    pub notify:              NotifyChoice,
    pub schedule:            ScheduleChoice,
    pub video:               VideoChoice,
    pub podcast:             PodcastChoice,
    pub events:              EventChoice,
    pub status:              StatusChoice,
    pub knowledge_base:      KnowledgeBaseChoice,
    pub crm:                 CrmChoice,
    pub sso:                 SsoChoice,
    pub docs:                DocsChoice,
    pub job_board:           bool,
    pub analytics:           AnalyticsProvider,
    pub ab_testing:          AbTestingProvider,
    pub heatmap:             HeatmapProvider,
    pub enable_api:          bool,
}

impl AllFeatures {
    pub fn defaults() -> Self {
        Self {
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
            docs:               DocsChoice::None,
            job_board:          false,
            analytics:          AnalyticsProvider::None,
            ab_testing:         AbTestingProvider::None,
            heatmap:            HeatmapProvider::None,
            enable_api:         false,
        }
    }
}

#[cfg(test)]
#[path = "features_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "features_tests_services.rs"]
mod tests_services;
