//! Unit tests for `astropress add`. Extracted from `add.rs` to keep that file
//! under the 300-line arch-lint warning.

use super::*;
use crate::features::{
    ChatChoice, CommerceChoice, EmailChoice, ForumChoice, NotifyChoice,
    ScheduleChoice,
};
use crate::providers::AnalyticsProvider;

fn args(s: &[&str]) -> Vec<String> {
    s.iter().map(|s| s.to_string()).collect()
}

#[test]
fn add_analytics_umami_parses() {
    let f = parse_add_features(&args(&["--analytics", "umami"])).unwrap();
    assert_eq!(f.analytics, AnalyticsProvider::Umami);
}

#[test]
fn add_email_listmonk_parses() {
    let f = parse_add_features(&args(&["--email", "listmonk"])).unwrap();
    assert_eq!(f.email, EmailChoice::Listmonk);
}

#[test]
fn add_transactional_email_smtp_parses() {
    let f = parse_add_features(&args(&["--transactional-email", "smtp"])).unwrap();
    assert!(matches!(f.transactional_email, crate::features::TransactionalEmailChoice::Smtp));
}

#[test]
fn add_forum_flarum_parses() {
    let f = parse_add_features(&args(&["--forum", "flarum"])).unwrap();
    assert_eq!(f.forum, ForumChoice::Flarum);
}

#[test]
fn add_notify_gotify_parses() {
    let f = parse_add_features(&args(&["--notify", "gotify"])).unwrap();
    assert_eq!(f.notify, NotifyChoice::Gotify);
}

#[test]
fn add_schedule_calcom_parses() {
    let f = parse_add_features(&args(&["--schedule", "calcom"])).unwrap();
    assert_eq!(f.schedule, ScheduleChoice::CalCom);
}

#[test]
fn add_commerce_vendure_parses() {
    let f = parse_add_features(&args(&["--commerce", "vendure"])).unwrap();
    assert_eq!(f.commerce, CommerceChoice::Vendure);
}

#[test]
fn add_chat_tiledesk_parses() {
    let f = parse_add_features(&args(&["--chat", "tiledesk"])).unwrap();
    assert_eq!(f.chat, ChatChoice::Tiledesk);
}

#[test]
fn add_unknown_flag_returns_error() {
    let result = parse_add_features(&args(&["--unknown-flag", "value"]));
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(
        err.contains("Unknown flag"),
        "expected 'Unknown flag' in error, got: {err}"
    );
}

#[test]
fn add_analytics_umami_appends_env_stubs() {
    let f = parse_add_features(&args(&["--analytics", "umami"])).unwrap();
    let stubs = provider_env_stubs(f.analytics, f.ab_testing, f.heatmap);
    assert!(
        stubs.contains("PUBLIC_UMAMI_SCRIPT_URL"),
        "expected PUBLIC_UMAMI_SCRIPT_URL in stubs, got: {stubs}"
    );
}

#[test]
fn add_email_listmonk_generates_config_files() {
    let f = parse_add_features(&args(&["--email", "listmonk"])).unwrap();
    let config_stubs = feature_config_stubs(&f);
    let paths: Vec<_> = config_stubs.iter().map(|(p, _)| *p).collect();
    assert!(
        paths.iter().any(|p| p.contains("listmonk")),
        "expected listmonk config files, got: {paths:?}"
    );
}

#[test]
fn add_forum_flarum_appends_env_stubs() {
    let f = parse_add_features(&args(&["--forum", "flarum"])).unwrap();
    let stubs = feature_env_stubs(&f);
    assert!(stubs.contains("FLARUM_URL"), "expected FLARUM_URL in stubs, got: {stubs}");
    assert!(stubs.contains("FLARUM_API_KEY"), "expected FLARUM_API_KEY in stubs, got: {stubs}");
}

#[test]
fn add_notify_gotify_appends_env_stubs() {
    let f = parse_add_features(&args(&["--notify", "gotify"])).unwrap();
    let stubs = feature_env_stubs(&f);
    assert!(stubs.contains("GOTIFY_URL"), "expected GOTIFY_URL in stubs, got: {stubs}");
    assert!(stubs.contains("GOTIFY_APP_TOKEN"), "expected GOTIFY_APP_TOKEN in stubs, got: {stubs}");
}

#[test]
fn add_schedule_calcom_appends_env_stubs() {
    let f = parse_add_features(&args(&["--schedule", "calcom"])).unwrap();
    let stubs = feature_env_stubs(&f);
    assert!(stubs.contains("CALCOM_API_URL"), "expected CALCOM_API_URL in stubs, got: {stubs}");
    assert!(stubs.contains("CALCOM_API_KEY"), "expected CALCOM_API_KEY in stubs, got: {stubs}");
}

#[test]
fn add_commerce_vendure_appends_env_stubs() {
    let f = parse_add_features(&args(&["--commerce", "vendure"])).unwrap();
    let stubs = feature_env_stubs(&f);
    assert!(stubs.contains("VENDURE_API_URL"), "expected VENDURE_API_URL in stubs, got: {stubs}");
    assert!(stubs.contains("VENDURE_ADMIN_API_URL"), "expected VENDURE_ADMIN_API_URL in stubs, got: {stubs}");
}

#[test]
fn add_chat_tiledesk_appends_env_stubs() {
    let f = parse_add_features(&args(&["--chat", "tiledesk"])).unwrap();
    let stubs = feature_env_stubs(&f);
    assert!(stubs.contains("TILEDESK_API_URL"), "expected TILEDESK_API_URL in stubs, got: {stubs}");
    assert!(stubs.contains("TILEDESK_PROJECT_ID"), "expected TILEDESK_PROJECT_ID in stubs, got: {stubs}");
    assert!(stubs.contains("TILEDESK_TOKEN"), "expected TILEDESK_TOKEN in stubs, got: {stubs}");
}

#[test]
fn add_to_nonexistent_dir_returns_error() {
    let f = AllFeatures::defaults();
    let result = add_integrations(Path::new("/nonexistent/dir/that/does/not/exist"), f);
    match result {
        Err(err) => assert!(
            err.contains("does not exist"),
            "expected 'does not exist' in error, got: {err}"
        ),
        Ok(()) => panic!("expected an error but got Ok"),
    }
}

