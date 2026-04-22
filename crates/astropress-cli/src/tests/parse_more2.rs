//! Continuation of CLI argument-parsing tests (part 2). Split from `parse_more.rs`.

use super::*;
use commands::add::parse_add_features;

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
