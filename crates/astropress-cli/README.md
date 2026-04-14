# astropress-cli

Command-line tool for [Astropress](https://astropress.diy) — scaffold new sites, import from WordPress or Wix, manage databases, trigger deployments, and more.

## Installation

### From crates.io

```bash
cargo install astropress-cli
```

### Pre-built binaries

Download from the [Releases](https://github.com/astropress/astropress/releases) page — no Rust toolchain required:

| Platform | File |
|---|---|
| Linux x64 | `astropress-linux-x64` |
| Linux arm64 | `astropress-linux-arm64` |
| macOS x64 | `astropress-macos-x64` |
| macOS arm64 | `astropress-macos-arm64` |
| Windows x64 | `astropress-windows-x64.exe` |

## Quick start

```bash
astropress new my-site
cd my-site
astropress dev
```

Open `http://localhost:4321/ap-admin` and log in.

## Commands

### `new` / `init`

Scaffold a new Astropress project. Runs an interactive wizard to choose your app host and content services.

```bash
astropress new my-site
astropress new my-site --app-host cloudflare-pages --content-services cloudflare
astropress new my-site --yes   # skip prompts, use defaults
```

### `dev`

Start the development server for an existing project.

```bash
astropress dev
astropress dev --project-dir ./my-site --app-host github-pages
```

### `import wordpress`

Import content from a WordPress site. Two modes:

```bash
# From a WXR export file
astropress import wordpress --source export.xml --apply-local

# Live crawl (fetch-based)
astropress import wordpress --url https://mysite.com --download-media --apply-local

# Live crawl (full browser, for JS-rendered pages)
astropress import wordpress --url https://mysite.com --crawl-pages=playwright --apply-local
```

### `import wix`

Import content from a Wix site.

```bash
# From a Wix CSV export
astropress import wix --source export.csv --apply-local

# Live crawl
astropress import wix --url https://username.wixsite.com/mysite --crawl-pages=playwright --apply-local
```

### `doctor`

Check the health of a project — validates configuration, env vars, and service connectivity.

```bash
astropress doctor
astropress doctor --strict   # treat warnings as errors (for CI)
astropress doctor --json     # machine-readable output
```

### `deploy`

Generate and run deployment scripts for the configured target.

```bash
astropress deploy
astropress deploy --target github-pages
astropress deploy --target cloudflare
```

Supported targets: `github-pages`, `cloudflare`, `vercel`, `netlify`, `render-static`, `render-web`, `gitlab-pages`, `fly-io`, `coolify`, `digitalocean`, `railway`, `runway`, `custom`.

### `backup` / `restore`

Snapshot and restore the local SQLite database and content.

```bash
astropress backup --out ./snapshots/$(date +%Y%m%d)
astropress restore --from ./snapshots/20250101
```

### `db migrate` / `db rollback`

Run or roll back schema migrations against the local SQLite database or Cloudflare D1.

```bash
astropress db migrate
astropress db migrate --target d1 --dry-run
astropress db rollback --target local
```

### `sync export` / `sync import`

Export and import content snapshots for syncing between environments.

```bash
astropress sync export --out ./sync-snapshot
astropress sync import --from ./sync-snapshot
```

### `services bootstrap` / `services verify`

Bootstrap required external services (email, search, etc.) and verify connectivity.

```bash
astropress services bootstrap
astropress services verify
```

### `add`

Add optional features (analytics, A/B testing, forms, donations) to an existing project.

```bash
astropress add . --analytics plausible
astropress add . --ab-testing growthbook
```

### `migrate`

Generate a migration guide when switching between third-party tools.

```bash
astropress migrate --from mailchimp --to listmonk
```

### `config migrate`

Migrate an existing project's configuration format to the current version.

```bash
astropress config migrate
astropress config migrate --dry-run
```

### `list`

```bash
astropress list tools       # all available tools by category
astropress list providers   # supported hosts and data services with valid pairings
```

### `completions`

Print shell completion scripts.

```bash
astropress completions bash   >> ~/.bashrc
astropress completions zsh    >> ~/.zshrc
astropress completions fish   > ~/.config/fish/completions/astropress.fish
astropress completions powershell >> $PROFILE
```

### `telemetry`

Astropress collects anonymous usage data to understand which features are used. It is opt-in by default.

```bash
astropress telemetry status
astropress telemetry enable
astropress telemetry disable
```

## Global flags

| Flag | Description |
|---|---|
| `--version` / `-V` | Print the CLI version and exit |
| `--plain` / `--no-tui` | Disable interactive prompts and progress bars (for CI or AI agent use) |

## CI usage

Pass `--yes` to skip interactive prompts and `--plain` to disable TUI progress bars:

```bash
astropress new my-site --yes --plain --app-host github-pages --content-services none
```

## Documentation

- [Quick start](https://astropress.diy/docs/guides/quick-start)
- [CLI reference](https://astropress.diy/docs/reference/cli)
- [Operations guide](https://astropress.diy/docs/guides/operations)

## License

MIT — see the [Astropress repository](https://github.com/astropress/astropress).
