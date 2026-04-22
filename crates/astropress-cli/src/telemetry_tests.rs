use super::*;
use std::sync::Mutex;

// Serialize env-var tests so they don't interfere with each other.
static ENV_MUTEX: Mutex<()> = Mutex::new(());

#[test]
fn suppressed_by_astropress_telemetry_0() {
    let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    std::env::remove_var("DO_NOT_TRACK");
    std::env::remove_var("CI");
    std::env::remove_var("GITHUB_ACTIONS");
    std::env::remove_var("GITLAB_CI");
    std::env::remove_var("CIRCLECI");
    std::env::set_var("ASTROPRESS_TELEMETRY", "0");
    assert!(is_telemetry_suppressed());
    std::env::remove_var("ASTROPRESS_TELEMETRY");
}

#[test]
fn suppressed_by_astropress_telemetry_false() {
    let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    std::env::remove_var("DO_NOT_TRACK");
    std::env::remove_var("CI");
    std::env::remove_var("GITHUB_ACTIONS");
    std::env::remove_var("GITLAB_CI");
    std::env::remove_var("CIRCLECI");
    std::env::set_var("ASTROPRESS_TELEMETRY", "false");
    assert!(is_telemetry_suppressed());
    std::env::remove_var("ASTROPRESS_TELEMETRY");
}

#[test]
fn suppressed_by_astropress_telemetry_disabled() {
    let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    std::env::remove_var("DO_NOT_TRACK");
    std::env::remove_var("CI");
    std::env::remove_var("GITHUB_ACTIONS");
    std::env::remove_var("GITLAB_CI");
    std::env::remove_var("CIRCLECI");
    std::env::set_var("ASTROPRESS_TELEMETRY", "disabled");
    assert!(is_telemetry_suppressed());
    std::env::remove_var("ASTROPRESS_TELEMETRY");
}

#[test]
fn suppressed_by_do_not_track() {
    let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    std::env::remove_var("ASTROPRESS_TELEMETRY");
    std::env::remove_var("CI");
    std::env::remove_var("GITHUB_ACTIONS");
    std::env::remove_var("GITLAB_CI");
    std::env::remove_var("CIRCLECI");
    std::env::set_var("DO_NOT_TRACK", "1");
    assert!(is_telemetry_suppressed());
    std::env::remove_var("DO_NOT_TRACK");
}

#[test]
fn suppressed_by_ci() {
    let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    std::env::remove_var("ASTROPRESS_TELEMETRY");
    std::env::remove_var("DO_NOT_TRACK");
    std::env::remove_var("GITHUB_ACTIONS");
    std::env::remove_var("GITLAB_CI");
    std::env::remove_var("CIRCLECI");
    std::env::set_var("CI", "true");
    assert!(is_telemetry_suppressed());
    std::env::remove_var("CI");
}

#[test]
fn suppressed_by_github_actions() {
    let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    std::env::remove_var("ASTROPRESS_TELEMETRY");
    std::env::remove_var("DO_NOT_TRACK");
    std::env::remove_var("CI");
    std::env::remove_var("GITLAB_CI");
    std::env::remove_var("CIRCLECI");
    std::env::set_var("GITHUB_ACTIONS", "true");
    assert!(is_telemetry_suppressed());
    std::env::remove_var("GITHUB_ACTIONS");
}

#[test]
fn suppressed_by_gitlab_ci() {
    let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    std::env::remove_var("ASTROPRESS_TELEMETRY");
    std::env::remove_var("DO_NOT_TRACK");
    std::env::remove_var("CI");
    std::env::remove_var("GITHUB_ACTIONS");
    std::env::remove_var("CIRCLECI");
    std::env::set_var("GITLAB_CI", "true");
    assert!(is_telemetry_suppressed());
    std::env::remove_var("GITLAB_CI");
}

#[test]
fn suppressed_by_circleci() {
    let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    std::env::remove_var("ASTROPRESS_TELEMETRY");
    std::env::remove_var("DO_NOT_TRACK");
    std::env::remove_var("CI");
    std::env::remove_var("GITHUB_ACTIONS");
    std::env::remove_var("GITLAB_CI");
    std::env::set_var("CIRCLECI", "true");
    assert!(is_telemetry_suppressed());
    std::env::remove_var("CIRCLECI");
}

#[test]
fn not_suppressed_when_no_env_vars_set() {
    let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    std::env::remove_var("ASTROPRESS_TELEMETRY");
    std::env::remove_var("DO_NOT_TRACK");
    std::env::remove_var("CI");
    std::env::remove_var("GITHUB_ACTIONS");
    std::env::remove_var("GITLAB_CI");
    std::env::remove_var("CIRCLECI");
    assert!(!is_telemetry_suppressed());
}

#[test]
fn config_path_uses_home_env_var() {
    let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    std::env::remove_var("USERPROFILE");
    std::env::set_var("HOME", "/tmp/ap_test_home");
    let path = astropress_config_path().expect("should return Some when HOME is set");
    assert!(path.ends_with(".astropress/config.json"),
        "expected path ending in .astropress/config.json, got: {}", path.display());
    std::env::remove_var("HOME");
}

#[test]
fn read_telemetry_config_returns_stored_preference() {
    let _lock = ENV_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    let tmp = std::env::temp_dir().join("ap_telemetry_test");
    let cfg_dir = tmp.join(".astropress");
    std::fs::create_dir_all(&cfg_dir).unwrap();
    std::fs::write(cfg_dir.join("config.json"), r#"{"telemetry":true}"#).unwrap();
    std::env::remove_var("USERPROFILE");
    std::env::set_var("HOME", &tmp);
    let config = read_telemetry_config();
    std::env::remove_var("HOME");
    assert_eq!(config.telemetry, Some(true),
        "expected telemetry=Some(true) from stored config, got: {:?}", config.telemetry);
}
