//! Shell completion script generation for `astropress completions <shell>`.
//!
//! Prints a static completion script to stdout. Users source the script in
//! their shell profile to enable tab completion for all astropress subcommands
//! and flags. Scripts themselves live in `completions_scripts.rs`.

#[path = "completions_scripts.rs"]
mod completions_scripts;

use completions_scripts::{
    BASH_COMPLETION, FISH_COMPLETION, POWERSHELL_COMPLETION, ZSH_COMPLETION,
};

pub(crate) fn print_completions(shell: &str) -> Result<(), String> {
    match shell.to_ascii_lowercase().as_str() {
        "bash" => {
            print!("{}", BASH_COMPLETION);
            Ok(())
        }
        "zsh" => {
            print!("{}", ZSH_COMPLETION);
            Ok(())
        }
        "fish" => {
            print!("{}", FISH_COMPLETION);
            Ok(())
        }
        "powershell" => {
            print!("{}", POWERSHELL_COMPLETION);
            Ok(())
        }
        other => Err(format!(
            "Unknown shell `{other}`. Supported shells: bash, zsh, fish, powershell.\n\
             Usage: astropress completions <bash|zsh|fish|powershell>"
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn completions_prints_bash() {
        assert!(print_completions("bash").is_ok());
    }

    #[test]
    fn completions_prints_zsh() {
        assert!(print_completions("zsh").is_ok());
    }

    #[test]
    fn completions_prints_fish() {
        assert!(print_completions("fish").is_ok());
    }

    #[test]
    fn completions_prints_powershell() {
        assert!(print_completions("powershell").is_ok());
    }

    #[test]
    fn completions_rejects_unknown_shell() {
        let result = print_completions("unknown");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Supported shells"));
    }
}
