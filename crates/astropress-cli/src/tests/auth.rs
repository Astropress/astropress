use super::*;
use cli_config::args::{parse_command, Command, AuthRevokeScope};

#[test]
fn auth_emergency_revoke_all_parses() {
    let cmd = parse_command(&strings(&["auth", "emergency-revoke", "--all"])).unwrap();
    assert!(matches!(
        cmd,
        Command::AuthEmergencyRevoke { scope: AuthRevokeScope::All, user_email: None, .. }
    ));
}

#[test]
fn auth_emergency_revoke_sessions_only_parses() {
    let cmd = parse_command(&strings(&["auth", "emergency-revoke", "--sessions-only"])).unwrap();
    assert!(matches!(
        cmd,
        Command::AuthEmergencyRevoke { scope: AuthRevokeScope::Sessions, .. }
    ));
}

#[test]
fn auth_emergency_revoke_tokens_only_parses() {
    let cmd = parse_command(&strings(&["auth", "emergency-revoke", "--tokens-only"])).unwrap();
    assert!(matches!(
        cmd,
        Command::AuthEmergencyRevoke { scope: AuthRevokeScope::Tokens, .. }
    ));
}

#[test]
fn auth_emergency_revoke_user_scoping_parses() {
    let cmd = parse_command(&strings(&[
        "auth", "emergency-revoke", "--all", "--user", "admin@example.com",
    ])).unwrap();
    assert!(matches!(
        cmd,
        Command::AuthEmergencyRevoke {
            scope: AuthRevokeScope::All,
            user_email: Some(ref email),
            ..
        } if email == "admin@example.com"
    ));
}

#[test]
fn auth_emergency_revoke_bootstrap_warning_scope() {
    // --all without --user is the scope that triggers the bootstrap password warning.
    // Verify it parses to All with no user_email.
    let cmd = parse_command(&strings(&["auth", "emergency-revoke", "--all"])).unwrap();
    assert!(matches!(
        cmd,
        Command::AuthEmergencyRevoke { scope: AuthRevokeScope::All, user_email: None, .. }
    ));
}

#[test]
fn auth_emergency_revoke_no_scope_returns_error() {
    let err = parse_command(&strings(&["auth", "emergency-revoke"])).unwrap_err().to_string();
    assert!(
        err.contains("Specify a scope")
            && err.contains("--all")
            && err.contains("--sessions-only")
            && err.contains("--tokens-only"),
        "expected `Specify a scope` error listing all scope flags, got: {err}"
    );
}

#[test]
fn auth_emergency_revoke_multiple_scopes_returns_mutually_exclusive_error() {
    // scope_count > 1 path. Distinguishes from the scope_count == 0 case
    // (`Specify a scope` error) so the `>` vs `<` mutation is killed.
    let err = parse_command(&strings(&[
        "auth",
        "emergency-revoke",
        "--all",
        "--sessions-only",
    ]))
    .unwrap_err()
    .to_string();
    assert!(
        err.contains("mutually exclusive"),
        "expected `mutually exclusive` error, got: {err}"
    );
}

#[test]
fn auth_revoke_scope_as_str_returns_expected_values() {
    assert_eq!(AuthRevokeScope::All.as_str(), "all");
    assert_eq!(AuthRevokeScope::Sessions.as_str(), "sessions");
    assert_eq!(AuthRevokeScope::Tokens.as_str(), "tokens");
}

#[test]
fn auth_emergency_revoke_with_project_dir_parses() {
    // Exercises the --project-dir advancement (`index += 1`). A `-=` mutation
    // would underflow usize and surface as an error before the value is read.
    let cmd = parse_command(&strings(&[
        "auth",
        "emergency-revoke",
        "--project-dir",
        "/tmp",
        "--all",
    ]))
    .unwrap();
    assert!(matches!(
        cmd,
        Command::AuthEmergencyRevoke {
            scope: AuthRevokeScope::All,
            ref project_dir,
            ..
        } if project_dir.to_string_lossy() == "/tmp"
    ));
}

#[test]
fn auth_emergency_revoke_user_email_is_distinct_from_user_flag() {
    // Exercises the --user advancement (`index += 1`). With `-=` the second
    // arg ("admin@example.com") would never be read, so user_email would be
    // wrong (or the test would fail outright).
    let cmd = parse_command(&strings(&[
        "auth",
        "emergency-revoke",
        "--all",
        "--user",
        "admin@example.com",
    ]))
    .unwrap();
    let user_email = match cmd {
        Command::AuthEmergencyRevoke { user_email, .. } => user_email,
        _ => panic!("expected AuthEmergencyRevoke"),
    };
    assert_eq!(user_email.as_deref(), Some("admin@example.com"));
}

#[test]
fn unknown_auth_subcommand_returns_specific_error() {
    // Distinguishes the `command == "auth"` match arm from the catch-all.
    let err = parse_command(&strings(&["auth", "totally-bogus"])).unwrap_err().to_string();
    assert!(
        err.contains("Unsupported auth subcommand"),
        "expected auth-specific error, got: {err}"
    );
}
