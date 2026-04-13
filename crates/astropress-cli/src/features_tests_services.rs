//! Unit tests for service-integration features — forum, chat, payments,
//! notify, schedule, video, podcast, events, status, knowledge base, crm,
//! sso, job board. Split from `features_tests.rs` to stay under the 300-line
//! arch-lint warning. Wired in via
//! `#[cfg(test)] #[path = ...] mod tests_services;` in `features.rs`.

use super::*;
use crate::feature_stubs::{feature_config_stubs, feature_env_stubs};
use crate::features::SocialChoice;

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

#[test]
fn chatwoot_generates_env_stubs() {
    let f = AllFeatures { chat: ChatChoice::Chatwoot, ..AllFeatures::defaults() };
    let s = feature_env_stubs(&f);
    assert!(s.contains("CHATWOOT_API_URL"));
    assert!(s.contains("CHATWOOT_API_TOKEN"));
    assert!(s.contains("CHATWOOT_WEBSITE_TOKEN"));
}

// ── payments ──────────────────────────────────────────────────────────

#[test]
fn hyperswitch_env_mentions_all_six_regions() {
    let f = AllFeatures { payments: PaymentChoice::HyperSwitch, ..AllFeatures::defaults() };
    let s = feature_env_stubs(&f);
    // East Africa
    assert!(s.contains("M-Pesa"),      "East Africa: {s}");
    assert!(s.contains("Daraja"),      "East Africa: {s}");
    // West & Southern Africa
    assert!(s.contains("Flutterwave"), "W/S Africa: {s}");
    assert!(s.contains("Paystack"),    "W/S Africa: {s}");
    // India
    assert!(s.contains("Razorpay"),    "India: {s}");
    assert!(s.contains("UPI"),         "India: {s}");
    // Southeast Asia
    assert!(s.contains("Xendit"),      "SE Asia: {s}");
    assert!(s.contains("GrabPay"),     "SE Asia: {s}");
    // Middle East
    assert!(s.contains("Noon"),        "Middle East: {s}");
    assert!(s.contains("mada"),        "Middle East: {s}");
    // Latin America
    assert!(s.contains("dLocal"),      "LatAm: {s}");
    assert!(s.contains("PIX"),         "LatAm: {s}");
    assert!(s.contains("OXXO"),        "LatAm: {s}");
}

#[test]
fn hyperswitch_env_includes_both_api_keys() {
    let f = AllFeatures { payments: PaymentChoice::HyperSwitch, ..AllFeatures::defaults() };
    let s = feature_env_stubs(&f);
    assert!(s.contains("HYPERSWITCH_API_KEY"), "server-side key missing: {s}");
    assert!(s.contains("HYPERSWITCH_PUBLISHABLE_KEY"), "client-side key for Web SDK missing: {s}");
}

#[test]
fn hyperswitch_env_includes_redirect_urls() {
    let f = AllFeatures { payments: PaymentChoice::HyperSwitch, ..AllFeatures::defaults() };
    let s = feature_env_stubs(&f);
    assert!(s.contains("PAYMENT_SUCCESS_REDIRECT_URL"));
    assert!(s.contains("PAYMENT_FAILURE_REDIRECT_URL"));
}

#[test]
fn hyperswitch_scaffolds_checkout_component() {
    let f = AllFeatures { payments: PaymentChoice::HyperSwitch, ..AllFeatures::defaults() };
    let files = feature_config_stubs(&f);
    let component = files.iter().find(|(p, _)| *p == "src/components/HyperCheckout.astro");
    assert!(component.is_some(), "HyperCheckout.astro must be scaffolded: {:?}", files.iter().map(|(p,_)| p).collect::<Vec<_>>());
    let content = component.unwrap().1;
    assert!(content.contains("HyperLoader.js"), "must load HyperSwitch Web SDK: {content}");
    assert!(content.contains("HYPERSWITCH_PUBLISHABLE_KEY"), "must reference publishable key: {content}");
    assert!(content.contains("M-Pesa"), "must document M-Pesa STK Push behaviour: {content}");
    assert!(content.contains("UPI"), "must document UPI collect flow: {content}");
    assert!(content.contains("confirmPayment"), "must wire confirmPayment: {content}");
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

// ── social media ─────────────────────────────────────────────────────

#[test]
fn postiz_generates_env_stubs() {
    let f = AllFeatures { social: SocialChoice::Postiz, ..AllFeatures::defaults() };
    let s = feature_env_stubs(&f);
    assert!(s.contains("POSTIZ_URL"),      "URL missing: {s}");
    assert!(s.contains("POSTIZ_API_TOKEN"), "token missing: {s}");
    assert!(s.contains("LinkedIn"),         "platforms missing: {s}");
    assert!(s.contains("Bluesky"),          "Bluesky missing: {s}");
    assert!(s.contains("Mastodon"),         "Mastodon missing: {s}");
}

#[test]
fn mixpost_generates_env_stubs() {
    let f = AllFeatures { social: SocialChoice::Mixpost, ..AllFeatures::defaults() };
    let s = feature_env_stubs(&f);
    assert!(s.contains("MIXPOST_URL"),      "URL missing: {s}");
    assert!(s.contains("MIXPOST_API_TOKEN"), "token missing: {s}");
    assert!(s.contains("Mastodon"),          "Mastodon missing: {s}");
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
