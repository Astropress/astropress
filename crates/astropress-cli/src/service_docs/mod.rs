//! Docker Compose files and unified SERVICES.md for self-hosted integrations.
//!
//! `service_compose_stubs()` — per-service `docker-compose.yml` + `.env.example` files;
//!   returned as static `(path, content)` pairs for inclusion in `feature_config_stubs()`.
//!
//! `build_services_doc()` — builds a single `SERVICES.md` covering all selected services.
//!
//! Constants are grouped by domain into submodules (`communication`, `content`,
//! `commerce`, `scheduling`, `media`, `identity`) to keep files under the
//! 600-line arch-lint hard cap.

mod commerce;
mod communication;
mod content;
mod identity;
mod markdown;
mod media;
mod scheduling;
mod social;

use crate::features::{
    AllFeatures, ChatChoice, CmsChoice, CommerceChoice, CommunityChoice, CourseChoice,
    CrmChoice, EmailChoice, EventChoice, FormsChoice, ForumChoice, KnowledgeBaseChoice,
    NotifyChoice, PaymentChoice, PodcastChoice, ScheduleChoice, SearchChoice,
    SocialChoice, SsoChoice, StatusChoice, VideoChoice,
};
use crate::providers::AbTestingProvider;

pub(crate) use markdown::build_services_doc;

/// Returns per-service `docker-compose.yml` and `.env.example` files for all
/// self-hosted services selected in `f`. SMTP-backed transactional email is
/// configured through generic env vars, so it does not imply a provider-
/// specific compose stack.
pub(crate) fn service_compose_stubs(f: &AllFeatures) -> Vec<(&'static str, &'static str)> {
    let mut files: Vec<(&'static str, &'static str)> = Vec::new();

    if f.email == EmailChoice::Listmonk {
        files.push(("listmonk/Caddyfile",             communication::CADDYFILE_LISTMONK));
        files.push(("listmonk/docker-compose.yml",    communication::COMPOSE_LISTMONK));
        files.push(("listmonk/.env.listmonk.example", communication::ENV_LISTMONK));
    }
    if f.cms == CmsChoice::Payload {
        files.push(("payload/docker-compose.yml",   content::COMPOSE_PAYLOAD));
        files.push(("payload/.env.payload.example", content::ENV_PAYLOAD));
    }
    if f.search == SearchChoice::Meilisearch {
        files.push(("meilisearch/docker-compose.yml",       content::COMPOSE_MEILISEARCH));
        files.push(("meilisearch/.env.meilisearch.example", content::ENV_MEILISEARCH));
    }
    if f.search == SearchChoice::Typesense {
        files.push(("typesense/docker-compose.yml",       content::COMPOSE_TYPESENSE));
        files.push(("typesense/.env.typesense.example", content::ENV_TYPESENSE));
    }
    if f.community == CommunityChoice::Remark42 {
        files.push(("remark42/docker-compose.yml",    communication::COMPOSE_REMARK42));
        files.push(("remark42/.env.remark42.example", communication::ENV_REMARK42));
    }
    if f.forum == ForumChoice::Flarum {
        files.push(("flarum/docker-compose.yml",  content::COMPOSE_FLARUM));
        files.push(("flarum/.env.flarum.example", content::ENV_FLARUM));
    }
    if f.forum == ForumChoice::Discourse {
        files.push(("discourse/docker-compose.yml",     content::COMPOSE_DISCOURSE));
        files.push(("discourse/.env.discourse.example", content::ENV_DISCOURSE));
    }
    if f.chat == ChatChoice::Tiledesk {
        files.push(("tiledesk/docker-compose.yml",    communication::COMPOSE_TILEDESK));
        files.push(("tiledesk/.env.tiledesk.example", communication::ENV_TILEDESK));
    }
    if f.chat == ChatChoice::Chatwoot {
        files.push(("chatwoot/docker-compose.yml",    communication::COMPOSE_CHATWOOT));
        files.push(("chatwoot/.env.chatwoot.example", communication::ENV_CHATWOOT));
    }
    if f.payments == PaymentChoice::HyperSwitch {
        files.push(("hyperswitch/docker-compose.yml",       commerce::COMPOSE_HYPERSWITCH));
        files.push(("hyperswitch/.env.hyperswitch.example", commerce::ENV_HYPERSWITCH));
    }
    if f.schedule == ScheduleChoice::Rallly {
        files.push(("rallly/docker-compose.yml",  scheduling::COMPOSE_RALLLY));
        files.push(("rallly/.env.rallly.example", scheduling::ENV_RALLLY));
    }
    if f.schedule == ScheduleChoice::CalCom {
        files.push(("calcom/docker-compose.yml",  scheduling::COMPOSE_CALCOM));
        files.push(("calcom/.env.calcom.example", scheduling::ENV_CALCOM));
    }
    if f.notify == NotifyChoice::Gotify {
        files.push(("gotify/docker-compose.yml",  communication::COMPOSE_GOTIFY));
        files.push(("gotify/.env.gotify.example", communication::ENV_GOTIFY));
    }
    if f.commerce == CommerceChoice::Medusa {
        files.push(("medusa/docker-compose.yml",  commerce::COMPOSE_MEDUSA));
        files.push(("medusa/.env.medusa.example", commerce::ENV_MEDUSA));
    }
    if f.commerce == CommerceChoice::Vendure {
        files.push(("vendure/docker-compose.yml",   commerce::COMPOSE_VENDURE));
        files.push(("vendure/.env.vendure.example", commerce::ENV_VENDURE));
    }
    if f.forms == FormsChoice::Typebot {
        files.push(("typebot/docker-compose.yml",   commerce::COMPOSE_TYPEBOT));
        files.push(("typebot/.env.typebot.example", commerce::ENV_TYPEBOT));
    }
    if f.forms == FormsChoice::Formbricks {
        files.push(("formbricks/docker-compose.yml",      commerce::COMPOSE_FORMBRICKS));
        files.push(("formbricks/.env.formbricks.example", commerce::ENV_FORMBRICKS));
    }
    if f.video == VideoChoice::PeerTube {
        files.push(("peertube/docker-compose.yml",    media::COMPOSE_PEERTUBE));
        files.push(("peertube/.env.peertube.example", media::ENV_PEERTUBE));
    }
    if f.podcast == PodcastChoice::Castopod {
        files.push(("castopod/docker-compose.yml",    media::COMPOSE_CASTOPOD));
        files.push(("castopod/.env.castopod.example", media::ENV_CASTOPOD));
    }
    if f.events == EventChoice::HiEvents {
        files.push(("hievents/docker-compose.yml",    scheduling::COMPOSE_HIEVENTS));
        files.push(("hievents/.env.hievents.example", scheduling::ENV_HIEVENTS));
    }
    if f.events == EventChoice::Pretix {
        files.push(("pretix/docker-compose.yml",  scheduling::COMPOSE_PRETIX));
        files.push(("pretix/.env.pretix.example", scheduling::ENV_PRETIX));
    }
    if f.status == StatusChoice::UptimeKuma {
        files.push(("uptime-kuma/docker-compose.yml",       identity::COMPOSE_UPTIME_KUMA));
        files.push(("uptime-kuma/.env.uptime-kuma.example", identity::ENV_UPTIME_KUMA));
    }
    if f.knowledge_base == KnowledgeBaseChoice::BookStack {
        files.push(("bookstack/docker-compose.yml",     content::COMPOSE_BOOKSTACK));
        files.push(("bookstack/.env.bookstack.example", content::ENV_BOOKSTACK));
    }
    if f.crm == CrmChoice::Twenty {
        files.push(("twenty/docker-compose.yml",  identity::COMPOSE_TWENTY));
        files.push(("twenty/.env.twenty.example", identity::ENV_TWENTY));
    }
    if f.sso == SsoChoice::Authentik {
        files.push(("authentik/docker-compose.yml",     identity::COMPOSE_AUTHENTIK));
        files.push(("authentik/.env.authentik.example", identity::ENV_AUTHENTIK));
    }
    if f.sso == SsoChoice::Zitadel {
        files.push(("zitadel/docker-compose.yml",   identity::COMPOSE_ZITADEL));
        files.push(("zitadel/.env.zitadel.example", identity::ENV_ZITADEL));
    }
    if f.courses == CourseChoice::FrappeLms {
        files.push(("frappe-lms/docker-compose.yml",      identity::COMPOSE_FRAPPE_LMS));
        files.push(("frappe-lms/.env.frappe-lms.example", identity::ENV_FRAPPE_LMS));
    }
    if f.ab_testing == AbTestingProvider::Flagsmith {
        files.push(("flagsmith/docker-compose.yml",       identity::COMPOSE_FLAGSMITH));
        files.push(("flagsmith/.env.flagsmith.example",   identity::ENV_FLAGSMITH));
    }
    if f.social == SocialChoice::Postiz {
        files.push(("postiz/docker-compose.yml",    social::COMPOSE_POSTIZ));
        files.push(("postiz/.env.postiz.example",   social::ENV_POSTIZ));
    }
    if f.social == SocialChoice::Mixpost {
        files.push(("mixpost/docker-compose.yml",   social::COMPOSE_MIXPOST));
        files.push(("mixpost/.env.mixpost.example", social::ENV_MIXPOST));
    }

    files
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::{AllFeatures, TransactionalEmailChoice};

    fn with_listmonk() -> AllFeatures {
        AllFeatures { email: EmailChoice::Listmonk, ..AllFeatures::defaults() }
    }

    #[test]
    fn listmonk_generates_compose_and_caddyfile() {
        let stubs = service_compose_stubs(&with_listmonk());
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"listmonk/docker-compose.yml"), "{paths:?}");
        assert!(paths.contains(&"listmonk/Caddyfile"), "{paths:?}");
        assert!(paths.contains(&"listmonk/.env.listmonk.example"), "{paths:?}");
    }

    #[test]
    fn listmonk_services_doc_covers_setup() {
        let doc = build_services_doc(&with_listmonk()).expect("should generate doc");
        assert!(doc.contains("Listmonk"));
        assert!(doc.contains("LISTMONK_API_URL"));
        assert!(doc.contains("Fly.io"));
        assert!(doc.contains("docker-compose.yml") || doc.contains("docker compose"));
        assert!(doc.contains("registerAstropressService") || doc.contains("Caddy"));
    }

    #[test]
    fn no_self_hosted_services_returns_none() {
        let f = AllFeatures::defaults();
        assert!(build_services_doc(&f).is_none());
    }

    #[test]
    fn meilisearch_generates_compose() {
        let f = AllFeatures { search: SearchChoice::Meilisearch, ..AllFeatures::defaults() };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"meilisearch/docker-compose.yml"), "{paths:?}");
        let compose = stubs.iter().find(|(p, _)| *p == "meilisearch/docker-compose.yml").unwrap().1;
        assert!(compose.contains("MEILI_MASTER_KEY"));
    }

    #[test]
    fn meilisearch_services_doc_has_section() {
        let f = AllFeatures { search: SearchChoice::Meilisearch, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("Meilisearch"));
        assert!(doc.contains("MEILISEARCH_URL"));
    }

    #[test]
    fn typesense_generates_compose() {
        let f = AllFeatures { search: SearchChoice::Typesense, ..AllFeatures::defaults() };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"typesense/docker-compose.yml"), "{paths:?}");
        let compose = stubs.iter().find(|(p, _)| *p == "typesense/docker-compose.yml").unwrap().1;
        assert!(compose.contains("TYPESENSE_API_KEY"));
    }

    #[test]
    fn typesense_services_doc_has_section() {
        let f = AllFeatures { search: SearchChoice::Typesense, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("Typesense"));
        assert!(doc.contains("TYPESENSE_API_KEY"));
    }

    #[test]
    fn chatwoot_generates_compose() {
        let f = AllFeatures { chat: ChatChoice::Chatwoot, ..AllFeatures::defaults() };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"chatwoot/docker-compose.yml"), "{paths:?}");
        let compose = stubs.iter().find(|(p, _)| *p == "chatwoot/docker-compose.yml").unwrap().1;
        assert!(compose.contains("SECRET_KEY_BASE"));
        assert!(compose.contains("sidekiq"));
    }

    #[test]
    fn chatwoot_services_doc_has_section() {
        let f = AllFeatures { chat: ChatChoice::Chatwoot, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("Chatwoot"));
        assert!(doc.contains("CHATWOOT_API_TOKEN"));
    }

    #[test]
    fn flagsmith_generates_compose() {
        let f = AllFeatures { ab_testing: crate::providers::AbTestingProvider::Flagsmith, ..AllFeatures::defaults() };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"flagsmith/docker-compose.yml"), "{paths:?}");
        let compose = stubs.iter().find(|(p, _)| *p == "flagsmith/docker-compose.yml").unwrap().1;
        assert!(compose.contains("SECRET_KEY"));
    }

    #[test]
    fn flagsmith_services_doc_has_section() {
        let f = AllFeatures { ab_testing: crate::providers::AbTestingProvider::Flagsmith, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("Flagsmith"));
        assert!(doc.contains("FLAGSMITH_ENVIRONMENT_KEY"));
    }

    #[test]
    fn peertube_needs_r2_note_in_doc() {
        let f = AllFeatures { video: VideoChoice::PeerTube, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("R2"), "expected Cloudflare R2 note");
        assert!(doc.contains("PeerTube"));
    }

    #[test]
    fn castopod_needs_r2_note_in_doc() {
        let f = AllFeatures { podcast: PodcastChoice::Castopod, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("R2"), "expected Cloudflare R2 note");
    }

    #[test]
    fn twenty_doc_warns_about_ram() {
        let f = AllFeatures { crm: CrmChoice::Twenty, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("4 GB RAM") || doc.contains("4GB"), "{doc}");
    }

    #[test]
    fn hyperswitch_services_doc_covers_all_payment_regions() {
        let f = AllFeatures { payments: PaymentChoice::HyperSwitch, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        // East Africa
        assert!(doc.contains("M-Pesa"),       "East Africa M-Pesa: {doc}");
        assert!(doc.contains("Daraja"),        "East Africa Daraja: {doc}");
        // West & Southern Africa
        assert!(doc.contains("Flutterwave"),   "W/S Africa Flutterwave: {doc}");
        assert!(doc.contains("Paystack"),      "W/S Africa Paystack: {doc}");
        // India
        assert!(doc.contains("Razorpay"),      "India Razorpay: {doc}");
        assert!(doc.contains("UPI"),           "India UPI: {doc}");
        // Southeast Asia
        assert!(doc.contains("Xendit"),        "SE Asia Xendit: {doc}");
        assert!(doc.contains("GrabPay"),       "SE Asia GrabPay: {doc}");
        assert!(doc.contains("PromptPay"),     "SE Asia PromptPay: {doc}");
        // Middle East & N. Africa
        assert!(doc.contains("Noon"),          "Middle East Noon: {doc}");
        assert!(doc.contains("mada"),          "Middle East mada: {doc}");
        assert!(doc.contains("KNET"),          "Middle East KNET: {doc}");
        assert!(doc.contains("Fawry"),         "Egypt Fawry: {doc}");
        // Latin America
        assert!(doc.contains("dLocal"),        "LatAm dLocal: {doc}");
        assert!(doc.contains("PIX"),           "LatAm PIX: {doc}");
        assert!(doc.contains("OXXO"),          "LatAm OXXO: {doc}");
        assert!(doc.contains("Boleto"),        "LatAm Boleto: {doc}");
    }

    #[test]
    fn postiz_generates_compose_and_env() {
        let f = AllFeatures { social: SocialChoice::Postiz, ..AllFeatures::defaults() };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"postiz/docker-compose.yml"), "{paths:?}");
        assert!(paths.contains(&"postiz/.env.postiz.example"), "{paths:?}");
        let compose = stubs.iter().find(|(p, _)| *p == "postiz/docker-compose.yml").unwrap().1;
        assert!(compose.contains("postiz_uploads"), "uploads volume missing: {compose}");
        let env = stubs.iter().find(|(p, _)| *p == "postiz/.env.postiz.example").unwrap().1;
        assert!(env.contains("JWT_SECRET"), "JWT_SECRET missing from env: {env}");
    }

    #[test]
    fn postiz_services_doc_has_section() {
        let f = AllFeatures { social: SocialChoice::Postiz, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("Postiz"), "{doc}");
        assert!(doc.contains("LinkedIn"), "{doc}");
        assert!(doc.contains("Bluesky"), "{doc}");
        assert!(doc.contains("Mastodon"), "{doc}");
    }

    #[test]
    fn mixpost_generates_compose_and_env() {
        let f = AllFeatures { social: SocialChoice::Mixpost, ..AllFeatures::defaults() };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"mixpost/docker-compose.yml"), "{paths:?}");
        assert!(paths.contains(&"mixpost/.env.mixpost.example"), "{paths:?}");
        let compose = stubs.iter().find(|(p, _)| *p == "mixpost/docker-compose.yml").unwrap().1;
        assert!(compose.contains("APP_KEY") || compose.contains("MIXPOST"));
    }

    #[test]
    fn mixpost_services_doc_has_section() {
        let f = AllFeatures { social: SocialChoice::Mixpost, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("Mixpost"), "{doc}");
        assert!(doc.contains("Mastodon"), "{doc}");
    }

    #[test]
    fn resend_does_not_generate_compose() {
        let f = AllFeatures {
            transactional_email: TransactionalEmailChoice::Resend,
            ..AllFeatures::defaults()
        };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(!paths.iter().any(|p| p.contains("resend")), "Resend is SaaS — no compose: {paths:?}");
    }

    #[test]
    fn smtp_does_not_generate_compose() {
        let f = AllFeatures {
            transactional_email: TransactionalEmailChoice::Smtp,
            ..AllFeatures::defaults()
        };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(!paths.iter().any(|p| p.contains("postal") || p.contains("smtp")), "SMTP should not imply a provider-specific compose stack: {paths:?}");
    }
}
