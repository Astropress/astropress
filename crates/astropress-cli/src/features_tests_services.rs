//! Unit tests for service-integration features — forum, chat, payments,
//! notify, schedule, video, podcast, events, status, knowledge base, crm,
//! sso, job board. Split from `features_tests.rs` to stay under the 300-line
//! arch-lint warning. Wired in via
//! `#[cfg(test)] #[path = ...] mod tests_services;` in `features.rs`.

use super::*;
use crate::feature_stubs::{feature_config_stubs, feature_env_stubs};

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
