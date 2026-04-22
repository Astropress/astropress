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
    let err = parse_command(&strings(&["auth", "emergency-revoke"])).unwrap_err();
    assert!(
        err.contains("--all") && err.contains("--sessions-only") && err.contains("--tokens-only"),
        "expected error listing all scope flags, got: {err}"
    );
}
