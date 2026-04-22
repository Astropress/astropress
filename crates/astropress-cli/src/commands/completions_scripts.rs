//! Shell-specific completion script strings. Kept in a sibling module to
//! keep `completions.rs` under the 300-line arch-lint warning.

// ---------------------------------------------------------------------------
// Bash completion
// ---------------------------------------------------------------------------

pub(super) const BASH_COMPLETION: &str = r#"# astropress bash completion
# Add to ~/.bashrc or source directly:
#   source <(astropress completions bash)

_astropress_completions() {
  local cur prev words cword
  _init_completion || return

  local subcommands="new init dev import backup restore doctor sync services config db deploy upgrade completions --help --version"

  if [[ $cword -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${subcommands}" -- "$cur") )
    return
  fi

  case "${words[1]}" in
    new|init)
      COMPREPLY=( $(compgen -W "--provider --app-host --data-services --analytics --ab-testing --heatmap --enable-api --yes --defaults --use-local-package --use-published-package --plain --no-tui" -- "$cur") )
      ;;
    import)
      if [[ $cword -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "wordpress wix" -- "$cur") )
      else
        COMPREPLY=( $(compgen -W "--source --url --credentials-file --username --password --artifact-dir --download-media --apply-local --resume --crawl-pages --project-dir --plain --no-tui" -- "$cur") )
      fi
      ;;
    backup)
      COMPREPLY=( $(compgen -W "--project-dir --out --plain --no-tui" -- "$cur") )
      ;;
    restore)
      COMPREPLY=( $(compgen -W "--from --project-dir --plain --no-tui" -- "$cur") )
      ;;
    doctor)
      COMPREPLY=( $(compgen -W "--project-dir --strict --json --plain --no-tui" -- "$cur") )
      ;;
    sync)
      if [[ $cword -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "export import" -- "$cur") )
      else
        COMPREPLY=( $(compgen -W "--project-dir --out --from --plain --no-tui" -- "$cur") )
      fi
      ;;
    services)
      if [[ $cword -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "bootstrap verify" -- "$cur") )
      else
        COMPREPLY=( $(compgen -W "--project-dir --plain --no-tui" -- "$cur") )
      fi
      ;;
    config)
      if [[ $cword -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "migrate" -- "$cur") )
      else
        COMPREPLY=( $(compgen -W "--project-dir --dry-run --plain --no-tui" -- "$cur") )
      fi
      ;;
    db)
      if [[ $cword -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "migrate rollback" -- "$cur") )
      else
        COMPREPLY=( $(compgen -W "--project-dir --migrations-dir --dry-run --plain --no-tui" -- "$cur") )
      fi
      ;;
    deploy)
      COMPREPLY=( $(compgen -W "--project-dir --target --app-host --plain --no-tui" -- "$cur") )
      ;;
    upgrade)
      COMPREPLY=( $(compgen -W "--check --apply --project-dir --plain --no-tui" -- "$cur") )
      ;;
    completions)
      COMPREPLY=( $(compgen -W "bash zsh fish powershell" -- "$cur") )
      ;;
  esac
}

complete -F _astropress_completions astropress
"#;

// ---------------------------------------------------------------------------
// Zsh completion
// ---------------------------------------------------------------------------

pub(super) const ZSH_COMPLETION: &str = r#"#compdef astropress
# astropress zsh completion
# Add to your ~/.zshrc:
#   autoload -Uz compinit && compinit
#   source <(astropress completions zsh)

_astropress() {
  local state

  _arguments \
    '(-V --version)'{-V,--version}'[Print version]' \
    '(-h --help)'{-h,--help}'[Show help]' \
    '--plain[Disable interactive UI (CI mode)]' \
    '--no-tui[Alias for --plain]' \
    '1: :_astropress_commands' \
    '*:: :->args'

  case $state in
    args)
      case $words[1] in
        new|init)
          _arguments \
            '--provider[Local provider (sqlite|d1|supabase|...)]' \
            '--app-host[App host (github-pages|cloudflare-pages|...)]' \
            '--data-services[Hosted data services]' \
            '--analytics[Analytics provider]' \
            '--ab-testing[A/B testing provider]' \
            '--heatmap[Heatmap provider]' \
            '--enable-api[Enable REST API]' \
            '--yes[Use defaults, skip prompts]' \
            '--defaults[Alias for --yes]' \
            '--use-local-package[Use local package]' \
            '--use-published-package[Use published package]'
          ;;
        import)
          _arguments \
            '1: :(wordpress wix)' \
            '--source[Local export file path]' \
            '--url[Live site URL]' \
            '--credentials-file[Credentials file path]' \
            '--artifact-dir[Output artifact directory]' \
            '--download-media[Download media assets]' \
            '--apply-local[Apply to local SQLite]' \
            '--resume[Resume previous import]' \
            '--crawl-pages[Enable page crawler]'
          ;;
        doctor)
          _arguments \
            '--strict[Exit 1 on warnings]' \
            '--json[Machine-readable JSON output]'
          ;;
        db)
          _arguments \
            '1: :(migrate rollback)' \
            '--dry-run[Preview without writing]' \
            '--migrations-dir[Migrations directory]'
          ;;
        sync)
          _arguments \
            '1: :(export import)'
          ;;
        services)
          _arguments \
            '1: :(bootstrap verify)'
          ;;
        config)
          _arguments \
            '1: :(migrate)' \
            '--dry-run[Preview without writing]'
          ;;
        upgrade)
          _arguments \
            '--check[Check compatibility only]' \
            '--apply[Apply pending upgrades]'
          ;;
        completions)
          _arguments \
            '1: :(bash zsh fish powershell)'
          ;;
      esac
      ;;
  esac
}

_astropress_commands() {
  local commands
  commands=(
    'new:Scaffold a new Astropress project'
    'init:Alias for new'
    'dev:Start local dev server'
    'import:Import content from WordPress or Wix'
    'backup:Export a SQLite snapshot'
    'restore:Restore from a SQLite snapshot'
    'doctor:Project health check'
    'sync:Alias for backup/restore'
    'services:Bootstrap or verify content services'
    'config:Migrate project config files'
    'db:Run or roll back schema migrations'
    'deploy:Trigger deployment'
    'upgrade:Check or apply version upgrades'
    'completions:Print shell completion script'
  )
  _describe 'astropress commands' commands
}

_astropress
"#;

// ---------------------------------------------------------------------------
// Fish completion
// ---------------------------------------------------------------------------

pub(super) const FISH_COMPLETION: &str = r#"# astropress fish completion
# Add to ~/.config/fish/completions/astropress.fish or:
#   astropress completions fish > ~/.config/fish/completions/astropress.fish

set -l subcommands new init dev import backup restore doctor sync services config db deploy upgrade completions

complete -c astropress -f
complete -c astropress -n __fish_use_subcommand -a "$subcommands"
complete -c astropress -s V -l version -d "Print version"
complete -c astropress -s h -l help    -d "Show help"
complete -c astropress -l plain        -d "Disable interactive UI (CI mode)"
complete -c astropress -l no-tui       -d "Alias for --plain"

# new / init
for cmd in new init
  complete -c astropress -n "__fish_seen_subcommand_from $cmd" -l provider        -d "Local provider"
  complete -c astropress -n "__fish_seen_subcommand_from $cmd" -l app-host        -d "App host"
  complete -c astropress -n "__fish_seen_subcommand_from $cmd" -l data-services   -d "Hosted data services"
  complete -c astropress -n "__fish_seen_subcommand_from $cmd" -l analytics       -d "Analytics provider"
  complete -c astropress -n "__fish_seen_subcommand_from $cmd" -l ab-testing      -d "A/B testing provider"
  complete -c astropress -n "__fish_seen_subcommand_from $cmd" -l heatmap         -d "Heatmap provider"
  complete -c astropress -n "__fish_seen_subcommand_from $cmd" -l enable-api      -d "Enable REST API"
  complete -c astropress -n "__fish_seen_subcommand_from $cmd" -l yes             -d "Use defaults, skip prompts"
  complete -c astropress -n "__fish_seen_subcommand_from $cmd" -l defaults        -d "Alias for --yes"
  complete -c astropress -n "__fish_seen_subcommand_from $cmd" -l use-local-package     -d "Use local package"
  complete -c astropress -n "__fish_seen_subcommand_from $cmd" -l use-published-package -d "Use published package"
end

# import
complete -c astropress -n "__fish_seen_subcommand_from import" -a "wordpress wix" -d "Import source"
complete -c astropress -n "__fish_seen_subcommand_from import" -l source           -d "Local export file"
complete -c astropress -n "__fish_seen_subcommand_from import" -l url              -d "Live site URL"
complete -c astropress -n "__fish_seen_subcommand_from import" -l credentials-file -d "Credentials file"
complete -c astropress -n "__fish_seen_subcommand_from import" -l artifact-dir     -d "Output directory"
complete -c astropress -n "__fish_seen_subcommand_from import" -l download-media   -d "Download media assets"
complete -c astropress -n "__fish_seen_subcommand_from import" -l apply-local      -d "Apply to local SQLite"
complete -c astropress -n "__fish_seen_subcommand_from import" -l resume           -d "Resume previous import"

# doctor
complete -c astropress -n "__fish_seen_subcommand_from doctor" -l strict -d "Exit 1 on warnings"
complete -c astropress -n "__fish_seen_subcommand_from doctor" -l json   -d "JSON output"

# db
complete -c astropress -n "__fish_seen_subcommand_from db" -a "migrate rollback" -d "DB subcommand"
complete -c astropress -n "__fish_seen_subcommand_from db" -l dry-run        -d "Preview without writing"
complete -c astropress -n "__fish_seen_subcommand_from db" -l migrations-dir -d "Migrations directory"

# completions
complete -c astropress -n "__fish_seen_subcommand_from completions" -a "bash zsh fish powershell" -d "Shell"
"#;

#[path = "completions_powershell.rs"]
mod completions_powershell;
pub(super) use completions_powershell::POWERSHELL_COMPLETION;
