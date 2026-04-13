//! Unit tests for `astropress add`. Extracted from `add.rs` to keep that file
//! under the 300-line arch-lint warning.

use super::*;
use crate::features::{
    ChatChoice, CommerceChoice, DocsChoice, EmailChoice, ForumChoice, NotifyChoice,
    ScheduleChoice,
};

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

// ── docs-site generators (Starlight / VitePress / mdBook) ────────────────

#[test]
fn add_docs_starlight_parses() {
    let f = parse_add_features(&args(&["--docs", "starlight"])).unwrap();
    assert_eq!(f.docs, DocsChoice::Starlight);
}

#[test]
fn add_docs_vitepress_parses() {
    let f = parse_add_features(&args(&["--docs", "vitepress"])).unwrap();
    assert_eq!(f.docs, DocsChoice::VitePress);
}

#[test]
fn add_docs_mdbook_parses() {
    let f = parse_add_features(&args(&["--docs", "mdbook"])).unwrap();
    assert_eq!(f.docs, DocsChoice::MdBook);
}

#[test]
fn add_docs_unknown_returns_error_listing_options() {
    let result = parse_add_features(&args(&["--docs", "bigtech"]));
    assert!(result.is_err(), "expected error for unknown docs generator");
    let err = result.unwrap_err();
    for expected in ["starlight", "vitepress", "mdbook"] {
        assert!(
            err.contains(expected),
            "expected `{expected}` in error listing available generators, got: {err}"
        );
    }
}

#[test]
fn add_docs_starlight_generates_config_files() {
    // Starlight integrates inline into the existing Astro project — no separate
    // docs/ subproject. The CLI emits the first docs page + a setup guide.
    let f = parse_add_features(&args(&["--docs", "starlight"])).unwrap();
    let stubs = feature_config_stubs(&f);
    let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
    assert!(paths.contains(&"src/content/docs/index.mdx"), "{paths:?}");
    assert!(paths.contains(&"DOCS.md"), "{paths:?}");
    // DOCS.md must carry the bun add command and astro.config.mjs snippet
    let docs_md = stubs.iter().find(|(p, _)| *p == "DOCS.md").unwrap().1;
    assert!(docs_md.contains("@astrojs/starlight"), "DOCS.md missing @astrojs/starlight: {docs_md}");
    assert!(docs_md.contains("astro.config.mjs"), "DOCS.md missing astro.config.mjs instructions: {docs_md}");
    assert!(docs_md.contains("bun add"), "DOCS.md missing bun add command: {docs_md}");
    // Must NOT create a separate docs/package.json — that implies a subproject
    assert!(!paths.contains(&"docs/package.json"), "Starlight must not scaffold a separate docs/ package: {paths:?}");
}

#[test]
fn add_docs_vitepress_generates_config_files() {
    let f = parse_add_features(&args(&["--docs", "vitepress"])).unwrap();
    let stubs = feature_config_stubs(&f);
    let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
    assert!(paths.contains(&"docs/package.json"), "{paths:?}");
    assert!(paths.contains(&"docs/.vitepress/config.mjs"), "{paths:?}");
    assert!(paths.contains(&"docs/index.md"), "{paths:?}");
    let pkg = stubs.iter().find(|(p, _)| *p == "docs/package.json").unwrap().1;
    assert!(pkg.contains("vitepress"), "package.json missing vitepress dep: {pkg}");
}

#[test]
fn add_docs_mdbook_generates_config_files() {
    let f = parse_add_features(&args(&["--docs", "mdbook"])).unwrap();
    let stubs = feature_config_stubs(&f);
    let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
    assert!(paths.contains(&"docs/book.toml"), "{paths:?}");
    assert!(paths.contains(&"docs/src/SUMMARY.md"), "{paths:?}");
    assert!(paths.contains(&"docs/src/introduction.md"), "{paths:?}");
}

#[test]
fn add_docs_none_generates_no_docs_files() {
    let f = AllFeatures::defaults();
    let stubs = feature_config_stubs(&f);
    for (path, _) in &stubs {
        assert!(
            !path.starts_with("docs/"),
            "default AllFeatures should not emit docs/ stubs, got `{path}`"
        );
    }
}
