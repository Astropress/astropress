use std::env;
use std::path::PathBuf;

use crate::cli_config::args::Command;

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub(crate) enum AuthRevokeScope {
    All,
    Sessions,
    Tokens,
}

impl AuthRevokeScope {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::All => "all",
            Self::Sessions => "sessions",
            Self::Tokens => "tokens",
        }
    }
}

pub(in crate::cli_config::args) fn parse_auth_emergency_revoke_command(
    args: &[String],
) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut user_email: Option<String> = None;
    let mut all = false;
    let mut sessions_only = false;
    let mut tokens_only = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--user" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--user`.".to_string())?;
                user_email = Some(value.clone());
            }
            "--all" => {
                all = true;
            }
            "--sessions-only" => {
                sessions_only = true;
            }
            "--tokens-only" => {
                tokens_only = true;
            }
            other => {
                return Err(format!(
                    "Unsupported astropress auth emergency-revoke option: `{other}`."
                ))
            }
        }
        index += 1;
    }

    // Exactly one scope flag is required
    let scope_count = usize::from(all) + usize::from(sessions_only) + usize::from(tokens_only);
    if scope_count == 0 {
        return Err(
            "Specify a scope: `--all`, `--sessions-only`, or `--tokens-only`.".into(),
        );
    }
    if scope_count > 1 {
        return Err(
            "`--all`, `--sessions-only`, and `--tokens-only` are mutually exclusive.".into(),
        );
    }

    let scope = if all {
        AuthRevokeScope::All
    } else if sessions_only {
        AuthRevokeScope::Sessions
    } else {
        AuthRevokeScope::Tokens
    };

    Ok(Command::AuthEmergencyRevoke {
        project_dir,
        scope,
        user_email,
    })
}
