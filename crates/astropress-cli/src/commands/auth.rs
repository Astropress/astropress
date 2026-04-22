use std::path::Path;

use crate::cli_config::args::AuthRevokeScope;
use crate::js_bridge::loaders::{resolve_admin_db_path, resolve_local_provider, run_auth_emergency_revoke_operation};

pub(crate) fn run_emergency_revoke(
    project_dir: &Path,
    scope: AuthRevokeScope,
    user_email: Option<&str>,
) -> Result<(), String> {
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

    if scope == AuthRevokeScope::All && user_email.is_none() {
        eprintln!();
        eprintln!("Warning: the bootstrap password (if set) remains active.");
        eprintln!("Set ADMIN_BOOTSTRAP_DISABLED=1 and restart to disable bootstrap access.");
    }

    Ok(())
}
