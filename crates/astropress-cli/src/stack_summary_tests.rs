use super::*;
use crate::features::{
    AllFeatures, CmsChoice, CommerceChoice, CourseChoice,
    EmailChoice, FormsChoice, ForumChoice,
    PaymentChoice, SearchChoice, TransactionalEmailChoice,
};
use crate::providers::{AnalyticsProvider, AppHost};

fn defaults() -> AllFeatures { AllFeatures::defaults() }

#[test]
fn format_summary_github_pages() {
    let f = defaults();
    let s = format_stack_summary(&f, Some(AppHost::GithubPages));
    assert!(s.contains("GitHub Pages"));
}

#[test]
fn format_summary_cloudflare_pages() {
    let s = format_stack_summary(&defaults(), Some(AppHost::CloudflarePages));
    assert!(s.contains("Cloudflare Pages"));
}

#[test]
fn format_summary_vercel() {
    let s = format_stack_summary(&defaults(), Some(AppHost::Vercel));
    assert!(s.contains("Vercel"));
}

#[test]
fn format_summary_netlify() {
    let s = format_stack_summary(&defaults(), Some(AppHost::Netlify));
    assert!(s.contains("Netlify"));
}

#[test]
fn format_summary_render_static() {
    let s = format_stack_summary(&defaults(), Some(AppHost::RenderStatic));
    assert!(s.contains("Render static"));
}

#[test]
fn format_summary_render_web() {
    let s = format_stack_summary(&defaults(), Some(AppHost::RenderWeb));
    assert!(s.contains("Render web service"));
}

#[test]
fn format_summary_gitlab_pages() {
    let s = format_stack_summary(&defaults(), Some(AppHost::GitlabPages));
    assert!(s.contains("GitLab Pages"));
}

#[test]
fn format_summary_fly_io() {
    let s = format_stack_summary(&defaults(), Some(AppHost::FlyIo));
    assert!(s.contains("Fly.io"));
}

#[test]
fn format_summary_coolify() {
    let s = format_stack_summary(&defaults(), Some(AppHost::Coolify));
    assert!(s.contains("Coolify"));
}

#[test]
fn format_summary_digitalocean() {
    let s = format_stack_summary(&defaults(), Some(AppHost::DigitalOcean));
    assert!(s.contains("DigitalOcean"));
}

#[test]
fn format_summary_railway() {
    let s = format_stack_summary(&defaults(), Some(AppHost::Railway));
    assert!(s.contains("Railway"));
}

#[test]
fn format_summary_custom_host() {
    let s = format_stack_summary(&defaults(), Some(AppHost::Custom));
    assert!(s.contains("custom / TBD"));
}

#[test]
fn format_summary_no_host() {
    let s = format_stack_summary(&defaults(), None);
    assert!(s.contains("custom / TBD"));
}

#[test]
fn format_summary_cms_builtin() {
    let mut f = defaults();
    f.cms = CmsChoice::BuiltIn;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Astropress built-in"));
}

#[test]
fn format_summary_cms_keystatic() {
    let mut f = defaults();
    f.cms = CmsChoice::Keystatic;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Keystatic"));
}

#[test]
fn format_summary_cms_payload() {
    let mut f = defaults();
    f.cms = CmsChoice::Payload;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Payload"));
}

#[test]
fn format_summary_email_listmonk() {
    let mut f = defaults();
    f.email = EmailChoice::Listmonk;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Listmonk"));
}

#[test]
fn format_summary_txn_email_resend() {
    let mut f = defaults();
    f.transactional_email = TransactionalEmailChoice::Resend;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Resend"));
}

#[test]
fn format_summary_txn_email_smtp() {
    let mut f = defaults();
    f.transactional_email = TransactionalEmailChoice::Smtp;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("SMTP"));
}

#[test]
fn format_summary_analytics_umami() {
    let mut f = defaults();
    f.analytics = AnalyticsProvider::Umami;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Umami"));
}

#[test]
fn format_summary_analytics_plausible() {
    let mut f = defaults();
    f.analytics = AnalyticsProvider::Plausible;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Plausible"));
}

#[test]
fn format_summary_analytics_matomo() {
    let mut f = defaults();
    f.analytics = AnalyticsProvider::Matomo;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Matomo"));
}

#[test]
fn format_summary_analytics_posthog() {
    let mut f = defaults();
    f.analytics = AnalyticsProvider::PostHog;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("PostHog"));
}

#[test]
fn format_summary_analytics_custom() {
    let mut f = defaults();
    f.analytics = AnalyticsProvider::Custom;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Analytics     Custom"));
}

#[test]
fn format_summary_analytics_none_not_printed() {
    let mut f = defaults();
    f.analytics = AnalyticsProvider::None;
    let s = format_stack_summary(&f, None);
    assert!(!s.contains("Analytics"));
}

#[test]
fn format_summary_commerce_medusa() {
    let mut f = defaults();
    f.commerce = CommerceChoice::Medusa;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Medusa"));
}

#[test]
fn format_summary_commerce_vendure() {
    let mut f = defaults();
    f.commerce = CommerceChoice::Vendure;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Vendure"));
}

#[test]
fn format_summary_courses_frappe() {
    let mut f = defaults();
    f.courses = CourseChoice::FrappeLms;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Frappe LMS"));
}

#[test]
fn format_summary_forms_formbricks() {
    let mut f = defaults();
    f.forms = FormsChoice::Formbricks;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Formbricks"));
}

#[test]
fn format_summary_forms_typebot() {
    let mut f = defaults();
    f.forms = FormsChoice::Typebot;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Typebot"));
}

#[test]
fn format_summary_donations_polar() {
    let mut f = defaults();
    f.donations.polar = true;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Polar"));
}

#[test]
fn format_summary_donations_give_lively() {
    let mut f = defaults();
    f.donations.give_lively = true;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("GiveLively"));
}

#[test]
fn format_summary_donations_liberapay() {
    let mut f = defaults();
    f.donations.liberapay = true;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Liberapay"));
}

#[test]
fn format_summary_donations_pledge_crypto() {
    let mut f = defaults();
    f.donations.pledge_crypto = true;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("PledgeCrypto"));
}

#[test]
fn format_summary_payments_hyperswitch() {
    let mut f = defaults();
    f.payments = PaymentChoice::HyperSwitch;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("HyperSwitch"));
}

#[test]
fn format_summary_forum_flarum() {
    let mut f = defaults();
    f.forum = ForumChoice::Flarum;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Flarum"));
}

#[test]
fn format_summary_forum_discourse() {
    let mut f = defaults();
    f.forum = ForumChoice::Discourse;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Discourse"));
}

#[test]
fn format_summary_search_meilisearch() {
    let mut f = defaults();
    f.search = SearchChoice::Meilisearch;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Meilisearch"));
}

#[test]
fn format_summary_search_typesense() {
    let mut f = defaults();
    f.search = SearchChoice::Typesense;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Typesense"));
}
