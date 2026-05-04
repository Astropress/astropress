use std::path::Path;

use crate::cli_config::args::AuthRevokeScope;
use crate::error::CliResult;
use crate::js_bridge::loaders::{resolve_admin_db_path, resolve_local_provider, run_auth_emergency_revoke_operation};

pub(crate) fn run_emergency_revoke(
    project_dir: &Path,
    scope: AuthRevokeScope,
    user_email: Option<&str>,
) -> CliResult<()> {
    let provider = resolve_local_provider(project_dir, None)?;
    let db_path = resolve_admin_db_path(project_dir, provider)?;
    let abs_db = project_dir.join(&db_path);

    let report = run_auth_emergency_revoke_operation(
        project_dir,
        &abs_db.to_string_lossy(),
        scope.as_str(),
        user_email,
    )?;

    println!(
        "Revoked {} session(s) and {} API token(s).",
        report.sessions_revoked, report.tokens_revoked
    );

    if should_warn_bootstrap(scope, user_email) {
        eprintln!();
        eprintln!("Warning: the bootstrap password (if set) remains active.");
        eprintln!("Set ADMIN_BOOTSTRAP_DISABLED=1 and restart to disable bootstrap access.");
    }

    Ok(())
}

/// Returns true when `auth emergency-revoke` should warn about a still-active
/// bootstrap password. Extracted as a pure function so the boundary is
/// testable; the warning side effect (eprintln!) sits in `run_emergency_revoke`.
pub(crate) fn should_warn_bootstrap(
    scope: AuthRevokeScope,
    user_email: Option<&str>,
) -> bool {
    scope == AuthRevokeScope::All && user_email.is_none()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn warns_when_scope_all_and_no_email() {
        assert!(should_warn_bootstrap(AuthRevokeScope::All, None));
    }

    #[test]
    fn no_warn_when_scope_is_sessions_only() {
        assert!(!should_warn_bootstrap(AuthRevokeScope::Sessions, None));
    }

    #[test]
    fn no_warn_when_scope_is_tokens_only() {
        assert!(!should_warn_bootstrap(AuthRevokeScope::Tokens, None));
    }

    #[test]
    fn no_warn_when_user_email_present() {
        assert!(!should_warn_bootstrap(
            AuthRevokeScope::All,
            Some("user@example.com"),
        ));
    }
}
