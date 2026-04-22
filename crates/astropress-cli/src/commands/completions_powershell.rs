//! PowerShell completion script.
//! Extracted from `completions_scripts.rs` to keep that file under 300 lines.


pub(in crate::commands) const POWERSHELL_COMPLETION: &str = r#"# astropress PowerShell completion
# Add to your PowerShell profile:
#   astropress completions powershell | Out-String | Invoke-Expression

$AstropressCommands = @(
  'new',
  'init',
  'dev',
  'import',
  'backup',
  'restore',
  'doctor',
  'sync',
  'services',
  'config',
  'db',
  'deploy',
  'upgrade',
  'completions',
  '--help',
  '--version'
)

function Get-AstropressCompletionValues {
  param(
    [string[]] $CommandElements,
    [string] $WordToComplete
  )

  if ($CommandElements.Count -le 1) {
    return $AstropressCommands
  }

  switch ($CommandElements[1]) {
    'new' { return @('--provider', '--app-host', '--data-services', '--analytics', '--ab-testing', '--heatmap', '--enable-api', '--yes', '--defaults', '--use-local-package', '--use-published-package', '--plain', '--no-tui') }
    'init' { return @('--provider', '--app-host', '--data-services', '--analytics', '--ab-testing', '--heatmap', '--enable-api', '--yes', '--defaults', '--use-local-package', '--use-published-package', '--plain', '--no-tui') }
    'import' {
      if ($CommandElements.Count -eq 2) {
        return @('wordpress', 'wix')
      }
      return @('--source', '--url', '--credentials-file', '--username', '--password', '--artifact-dir', '--download-media', '--apply-local', '--resume', '--crawl-pages', '--project-dir', '--plain', '--no-tui')
    }
    'backup' { return @('--project-dir', '--out', '--plain', '--no-tui') }
    'restore' { return @('--from', '--project-dir', '--plain', '--no-tui') }
    'doctor' { return @('--project-dir', '--strict', '--json', '--plain', '--no-tui') }
    'sync' {
      if ($CommandElements.Count -eq 2) {
        return @('export', 'import')
      }
      return @('--project-dir', '--out', '--from', '--plain', '--no-tui')
    }
    'services' {
      if ($CommandElements.Count -eq 2) {
        return @('bootstrap', 'verify')
      }
      return @('--project-dir', '--plain', '--no-tui')
    }
    'config' {
      if ($CommandElements.Count -eq 2) {
        return @('migrate')
      }
      return @('--project-dir', '--dry-run', '--plain', '--no-tui')
    }
    'db' {
      if ($CommandElements.Count -eq 2) {
        return @('migrate', 'rollback')
      }
      return @('--project-dir', '--migrations-dir', '--dry-run', '--plain', '--no-tui')
    }
    'deploy' { return @('--project-dir', '--target', '--app-host', '--plain', '--no-tui') }
    'upgrade' { return @('--check', '--apply', '--project-dir', '--plain', '--no-tui') }
    'completions' { return @('bash', 'zsh', 'fish', 'powershell') }
    default { return @() }
  }
}

Register-ArgumentCompleter -Native -CommandName astropress -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)

  $commandElements = @()
  foreach ($element in $commandAst.CommandElements) {
    $text = $element.Extent.Text
    if (
      ($text.StartsWith("'") -and $text.EndsWith("'")) -or
      ($text.StartsWith('"') -and $text.EndsWith('"'))
    ) {
      $text = $text.Substring(1, $text.Length - 2)
    }
    if ($text.Length -gt 0) {
      $commandElements += $text
    }
  }

  foreach ($completion in Get-AstropressCompletionValues -CommandElements $commandElements -WordToComplete $wordToComplete) {
    if ($completion -like "$wordToComplete*") {
      [System.Management.Automation.CompletionResult]::new($completion, $completion, 'ParameterValue', $completion)
    }
  }
}
"#;
