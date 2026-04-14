# Compatibility

This matrix tracks the operating systems and workflow paths Astropress actively verifies today.

## OS support

| Platform | Support tier | Evidence | Notes |
|---|---|---|---|
| Linux | Verified | Main CI, release binaries, install script, Playwright and build pipelines | Reference platform |
| macOS | Verified | CLI release binaries, install script, CI smoke job | Browser E2E still Linux-primary |
| Windows | Verified | PowerShell installer, CLI release binaries, CI smoke job, PowerShell completions | Prefer PowerShell for setup instructions |
| FreeBSD | Best effort | POSIX installer support, `--plain` CLI fallback, upstream-tracked terminal gaps | No hosted CI runner in this repo |
| OpenBSD | Best effort | POSIX installer support, `--plain` CLI fallback, upstream-tracked terminal gaps | No hosted CI runner in this repo |
| NetBSD | Best effort | POSIX installer support, `--plain` CLI fallback, upstream-tracked terminal gaps | No hosted CI runner in this repo |

## Verified commands

The cross-platform smoke lane exercises:

- `bun install --frozen-lockfile`
- `bun run test:cli`
- `bun run --filter astropress test tests/project-env.test.ts tests/content-services-ops.test.ts tests/hosted-provider.contract.test.ts tests/provider-targets.test.ts`
- `bun run docs:api:check`
- `bun run docs:check`
- `bun run test:example`

## Shell support

- `bash`, `zsh`, `fish`, and `powershell` completion scripts are available through `astropress completions <shell>`.
- Windows users should prefer `tooling/scripts/install.ps1`.
- BSD users should prefer `--plain` / `--no-tui` until raw-mode support is verified on native runners.

## What is not verified yet

- Native BSD CI execution
- Browser E2E on macOS or Windows
- Prebuilt BSD release artifacts

Those gaps are tracked in [docs/UPSTREAM_CONTRIBUTIONS.md](./UPSTREAM_CONTRIBUTIONS.md).
