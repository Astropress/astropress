//! Unit tests for `features.rs` — CMS, email, commerce, community, search,
//! courses, forms, donations. Service integrations (forum, chat, payments,
//! notify, etc.) live in `features_tests_services.rs` so each file stays under
//! the 300-line arch-lint warning. Wired in via
//! `#[cfg(test)] #[path = ...] mod tests;` in `features.rs`.

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
    let f = AllFeatures::defaults();
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
fn resend_generates_env_stubs() {
    let f = AllFeatures { transactional_email: TransactionalEmailChoice::Resend, ..AllFeatures::defaults() };
    let s = feature_env_stubs(&f);
    assert!(s.contains("EMAIL_DELIVERY_MODE=resend"));
    assert!(s.contains("RESEND_API_KEY"));
    assert!(s.contains("RESEND_FROM_EMAIL"));
}

#[test]
fn smtp_generates_env_stubs() {
    let f = AllFeatures { transactional_email: TransactionalEmailChoice::Smtp, ..AllFeatures::defaults() };
    let s = feature_env_stubs(&f);
    assert!(s.contains("EMAIL_DELIVERY_MODE=smtp"));
    assert!(s.contains("SMTP_HOST"));
    assert!(s.contains("SMTP_PASSWORD"));
    assert!(s.contains("SMTP_FROM_EMAIL"));
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

#[test]
fn typesense_generates_env_stubs() {
    let f = AllFeatures { search: SearchChoice::Typesense, ..AllFeatures::defaults() };
    let s = feature_env_stubs(&f);
    assert!(s.contains("TYPESENSE_HOST"));
    assert!(s.contains("TYPESENSE_API_KEY"));
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
    assert!(s.contains("FORMBRICKS_WEBHOOK_SECRET"));
}

#[test]
fn typebot_generates_env_stubs() {
    let f = AllFeatures { forms: FormsChoice::Typebot, ..AllFeatures::defaults() };
    let s = feature_env_stubs(&f);
    assert!(s.contains("TYPEBOT_URL"));
    assert!(s.contains("TYPEBOT_API_TOKEN"));
    assert!(s.contains("TYPEBOT_WEBHOOK_SECRET"));
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
