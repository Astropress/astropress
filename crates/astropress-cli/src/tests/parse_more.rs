//! Continuation of CLI argument-parsing tests. Split from `parse.rs` to keep
//! both files under the 600-line arch-lint cap.

use super::*;
use commands::add::parse_add_features;

#[test]
fn parse_add_features_commerce_medusa() {
    use features::CommerceChoice;
    let args = strings(&["--commerce", "medusa"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.commerce, CommerceChoice::Medusa);
}

#[test]
fn parse_add_features_commerce_vendure() {
    use features::CommerceChoice;
    let args = strings(&["--commerce", "vendure"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.commerce, CommerceChoice::Vendure);
}

#[test]
fn parse_add_features_search_meilisearch() {
    use features::SearchChoice;
    let args = strings(&["--search", "meilisearch"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.search, SearchChoice::Meilisearch);
}

#[test]
fn parse_add_features_search_pagefind() {
    use features::SearchChoice;
    let args = strings(&["--search", "pagefind"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.search, SearchChoice::Pagefind);
}

#[test]
fn parse_add_features_forum_flarum() {
    use features::ForumChoice;
    let args = strings(&["--forum", "flarum"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.forum, ForumChoice::Flarum);
}

#[test]
fn parse_add_features_forum_discourse() {
    use features::ForumChoice;
    let args = strings(&["--forum", "discourse"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.forum, ForumChoice::Discourse);
}

#[test]
fn parse_add_features_chat_tiledesk() {
    use features::ChatChoice;
    let args = strings(&["--chat", "tiledesk"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.chat, ChatChoice::Tiledesk);
}

#[test]
fn parse_add_features_notify_ntfy() {
    use features::NotifyChoice;
    let args = strings(&["--notify", "ntfy"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.notify, NotifyChoice::Ntfy);
}

#[test]
fn parse_add_features_notify_gotify() {
    use features::NotifyChoice;
    let args = strings(&["--notify", "gotify"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.notify, NotifyChoice::Gotify);
}

#[test]
fn parse_add_features_schedule_rallly() {
    use features::ScheduleChoice;
    let args = strings(&["--schedule", "rallly"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.schedule, ScheduleChoice::Rallly);
}

#[test]
fn parse_add_features_schedule_calcom() {
    use features::ScheduleChoice;
    let args = strings(&["--schedule", "calcom"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.schedule, ScheduleChoice::CalCom);
}

#[test]
fn parse_add_features_video_peertube() {
    use features::VideoChoice;
    let args = strings(&["--video", "peertube"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.video, VideoChoice::PeerTube);
}

#[test]
fn parse_add_features_podcast_castopod() {
    use features::PodcastChoice;
    let args = strings(&["--podcast", "castopod"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.podcast, PodcastChoice::Castopod);
}

#[test]
fn parse_add_features_events_hievents() {
    use features::EventChoice;
    let args = strings(&["--events", "hievents"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.events, EventChoice::HiEvents);
}

#[test]
fn parse_add_features_events_pretix() {
    use features::EventChoice;
    let args = strings(&["--events", "pretix"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.events, EventChoice::Pretix);
}

#[test]
fn parse_add_features_sso_authentik() {
    use features::SsoChoice;
    let args = strings(&["--sso", "authentik"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.sso, SsoChoice::Authentik);
}

#[test]
fn parse_add_features_sso_zitadel() {
    use features::SsoChoice;
    let args = strings(&["--sso", "zitadel"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.sso, SsoChoice::Zitadel);
}

#[test]
fn parse_add_features_social_postiz() {
    use features::SocialChoice;
    let args = strings(&["--social", "postiz"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.social, SocialChoice::Postiz);
}

#[test]
fn parse_add_features_social_mixpost() {
    use features::SocialChoice;
    let args = strings(&["--social", "mixpost"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.social, SocialChoice::Mixpost);
}

#[test]
fn parse_add_features_cms_keystatic() {
    use features::CmsChoice;
    let args = strings(&["--cms", "keystatic"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.cms, CmsChoice::Keystatic);
}

#[test]
fn parse_add_features_cms_payload() {
    use features::CmsChoice;
    let args = strings(&["--cms", "payload"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.cms, CmsChoice::Payload);
}

#[test]
fn parse_add_features_community_giscus() {
    use features::CommunityChoice;
    let args = strings(&["--community", "giscus"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.community, CommunityChoice::Giscus);
}

#[test]
fn parse_add_features_community_remark42() {
    use features::CommunityChoice;
    let args = strings(&["--community", "remark42"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.community, CommunityChoice::Remark42);
}

#[test]
fn parse_add_features_courses_frappe_lms() {
    use features::CourseChoice;
    let args = strings(&["--courses", "frappe-lms"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.courses, CourseChoice::FrappeLms);
}

#[test]
fn parse_add_features_forms_formbricks() {
    use features::FormsChoice;
    let args = strings(&["--forms", "formbricks"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.forms, FormsChoice::Formbricks);
}

#[test]
fn parse_add_features_forms_typebot() {
    use features::FormsChoice;
    let args = strings(&["--forms", "typebot"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.forms, FormsChoice::Typebot);
}

#[test]
fn parse_add_features_transactional_email_resend() {
    use features::TransactionalEmailChoice;
    let args = strings(&["--transactional-email", "resend"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.transactional_email, TransactionalEmailChoice::Resend);
}

#[test]
fn parse_add_features_transactional_email_smtp() {
    use features::TransactionalEmailChoice;
    let args = strings(&["--transactional-email", "smtp"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.transactional_email, TransactionalEmailChoice::Smtp);
}

#[test]
fn parse_add_features_status_uptime_kuma() {
    use features::StatusChoice;
    let args = strings(&["--status", "uptime-kuma"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.status, StatusChoice::UptimeKuma);
}

#[test]
fn parse_add_features_knowledge_base_bookstack() {
    use features::KnowledgeBaseChoice;
    let args = strings(&["--knowledge-base", "bookstack"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.knowledge_base, KnowledgeBaseChoice::BookStack);
}

#[test]
fn parse_add_features_crm_twenty() {
    use features::CrmChoice;
    let args = strings(&["--crm", "twenty"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.crm, CrmChoice::Twenty);
}

#[test]
fn parse_add_features_docs_starlight() {
    use features::DocsChoice;
    let args = strings(&["--docs", "starlight"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.docs, DocsChoice::Starlight);
}

#[test]
fn parse_add_features_docs_vitepress() {
    use features::DocsChoice;
    let args = strings(&["--docs", "vitepress"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.docs, DocsChoice::VitePress);
}

#[test]
fn parse_add_features_docs_mdbook() {
    use features::DocsChoice;
    let args = strings(&["--docs", "mdbook"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.docs, DocsChoice::MdBook);
}

#[test]
fn parse_add_features_heatmap_posthog() {
    let args = strings(&["--heatmap", "posthog"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.heatmap, providers::HeatmapProvider::PostHog);
}

#[test]
fn parse_add_features_ab_testing_growthbook() {
    let args = strings(&["--ab-testing", "growthbook"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.ab_testing, providers::AbTestingProvider::GrowthBook);
}

#[test]
fn parse_add_features_ab_testing_unleash() {
    let args = strings(&["--ab-testing", "unleash"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.ab_testing, providers::AbTestingProvider::Unleash);
}

#[test]
fn parse_add_features_payments_hyperswitch() {
    use features::PaymentChoice;
    let args = strings(&["--payments", "hyperswitch"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.payments, PaymentChoice::HyperSwitch);
}

#[test]
fn parse_add_features_polar_donation() {
    let args = strings(&["--polar", "true"]);
    let f = parse_add_features(&args).unwrap();
    assert!(f.donations.polar);
}

#[test]
fn parse_add_features_give_lively_donation() {
    let args = strings(&["--give-lively", "1"]);
    let f = parse_add_features(&args).unwrap();
    assert!(f.donations.give_lively);
}

#[test]
fn parse_add_features_liberapay_donation() {
    let args = strings(&["--liberapay", "yes"]);
    let f = parse_add_features(&args).unwrap();
    assert!(f.donations.liberapay);
}

#[test]
fn parse_add_features_pledge_crypto_donation() {
    let args = strings(&["--pledge-crypto", "true"]);
    let f = parse_add_features(&args).unwrap();
    assert!(f.donations.pledge_crypto);
}

#[test]
fn help_aliases_all_return_help() {
    assert_eq!(parse_command(&strings(&["-h"])), Ok(Command::Help));
    assert_eq!(parse_command(&strings(&["help"])), Ok(Command::Help));
}

#[test]
fn import_unknown_subcommand_error_mentions_import_sources() {
    let err = parse_command(&strings(&["import", "unknown"])).unwrap_err();
    assert!(err.contains("import wordpress"), "error should mention import wordpress: {err}");
}

#[test]
fn sync_unknown_subcommand_error_mentions_sync_export() {
    let err = parse_command(&strings(&["sync", "unknown"])).unwrap_err();
    assert!(err.contains("sync export"), "error should mention sync export: {err}");
}

#[test]
fn db_unknown_subcommand_error_mentions_db_migrate() {
    let err = parse_command(&strings(&["db", "unknown"])).unwrap_err();
    assert!(err.contains("db migrate"), "error should mention db migrate: {err}");
}

#[test]
fn list_unknown_subcommand_error_mentions_list_tools() {
    let err = parse_command(&strings(&["list", "unknown"])).unwrap_err();
    assert!(err.contains("list tools"), "error should mention list tools: {err}");
}

#[test]
fn services_unknown_subcommand_error_mentions_services() {
    let err = parse_command(&strings(&["services", "unknown"])).unwrap_err();
    // Must match the services fallback arm, not the wildcard ("Unsupported astropress command: `services`")
    assert!(err.contains("services bootstrap"), "error should mention services bootstrap: {err}");
}

#[test]
fn config_unknown_subcommand_error_mentions_config() {
    let err = parse_command(&strings(&["config", "unknown"])).unwrap_err();
    // Must match the config fallback arm, not the wildcard ("Unsupported astropress command: `config`")
    assert!(err.contains("config migrate"), "error should mention config migrate: {err}");
}

#[test]
fn non_list_command_with_providers_arg_is_not_list_providers() {
    // If the `(command == "list" || command == "ls") && subcommand == "providers"` guard
    // were changed to `||`, arbitrary commands with "providers" as 2nd arg would match.
    let err = parse_command(&strings(&["db", "providers"])).unwrap_err();
    assert!(err.contains("db"), "should be a db error: {err}");
}

#[test]
fn wants_version_detects_double_dash_version() {
    assert!(crate::wants_version(&strings(&["--version"])));
}

#[test]
fn wants_version_detects_short_v_flag() {
    assert!(crate::wants_version(&strings(&["-V"])));
}

#[test]
fn wants_version_false_for_other_args() {
    assert!(!crate::wants_version(&strings(&["new", "foo"])));
    assert!(!crate::wants_version(&strings(&[])));
}

#[test]
fn wants_version_false_requires_exact_match() {
    // Mutation `replace == with !=` would make --version mean "NOT --version"
    assert!(!crate::wants_version(&strings(&["--version-check"])));
}

#[test]
fn strip_tui_flags_removes_plain_flag() {
    let (plain, args) = crate::strip_tui_flags(strings(&["new", "--plain", "foo"]));
    assert!(plain);
    assert_eq!(args, strings(&["new", "foo"]));
}

#[test]
fn strip_tui_flags_removes_no_tui_flag() {
    let (plain, args) = crate::strip_tui_flags(strings(&["dev", "--no-tui"]));
    assert!(plain);
    assert_eq!(args, strings(&["dev"]));
}

#[test]
fn strip_tui_flags_plain_false_when_absent() {
    let (plain, args) = crate::strip_tui_flags(strings(&["new", "foo"]));
    assert!(!plain);
    assert_eq!(args, strings(&["new", "foo"]));
}

#[test]
fn strip_tui_flags_both_flags_removed() {
    // If && were replaced with || in the filter, only one flag would be removed.
    let (_, args) = crate::strip_tui_flags(strings(&["--plain", "--no-tui", "dev"]));
    assert_eq!(args, strings(&["dev"]));
}

#[test]
fn doctor_strict_exit_code_fails_when_strict_and_warnings() {
    let code = crate::doctor_strict_exit_code(true, &["a warning".to_string()]);
    assert_eq!(code, std::process::ExitCode::from(1));
}

#[test]
fn doctor_strict_exit_code_succeeds_when_no_warnings() {
    let code = crate::doctor_strict_exit_code(true, &[]);
    assert_eq!(code, std::process::ExitCode::SUCCESS);
}

#[test]
fn doctor_strict_exit_code_succeeds_when_not_strict() {
    let code = crate::doctor_strict_exit_code(false, &["a warning".to_string()]);
    assert_eq!(code, std::process::ExitCode::SUCCESS);
}

#[test]
fn services_verify_exit_code_fails_for_missing_config() {
    let code = crate::services_verify_exit_code("missing-config");
    assert_eq!(code, std::process::ExitCode::from(1));
}

#[test]
fn services_verify_exit_code_succeeds_for_other_levels() {
    assert_eq!(crate::services_verify_exit_code("configured"), std::process::ExitCode::SUCCESS);
    assert_eq!(crate::services_verify_exit_code("partial"), std::process::ExitCode::SUCCESS);
}

#[test]
fn dev_unknown_flag_returns_error() {
    // Kills `replace match guard value.starts_with("--") with false` at dev_deploy.rs:41.
    // With false, unknown flags like "--bogus" are silently treated as project_dir.
    // Original: guard true → Err("Unsupported..."). Mutation: guard false → Ok(New{..}).
    let result = parse_command(&strings(&["dev", "--bogus-unknown-flag"]));
    assert!(result.is_err(), "unknown dev flag must return an error, got: {result:?}");
    assert!(result.unwrap_err().contains("Unsupported"));
}

#[test]
fn new_unknown_flag_returns_error() {
    // Kills `replace match guard value.starts_with("--") with false` at new.rs:70.
    // Same pattern: unknown flags must error, not silently become project_dir.
    let result = parse_command(&strings(&["new", "--bogus-unknown-flag"]));
    assert!(result.is_err(), "unknown new flag must return an error, got: {result:?}");
    assert!(result.unwrap_err().contains("Unsupported"));
}
