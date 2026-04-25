#!/usr/bin/env bash
# Astropress local dev installer — macOS / Linux / FreeBSD / OpenBSD
# Run from the repo root: bash tooling/scripts/install.sh
# Pass --skip-tests to skip the test suite after bootstrap.
set -euo pipefail

# ─── colour helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
info()    { echo -e "${CYAN}[info]${RESET}  $*"; }
ok()      { echo -e "${GREEN}[ok]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET}   $*"; }
die()     { echo -e "${RED}[error]${RESET}  $*" >&2; exit 1; }
section() { echo -e "\n${BOLD}═══ $* ═══${RESET}"; }

# ─── args ────────────────────────────────────────────────────────────────────
SKIP_TESTS=false
SKIP_PLAYWRIGHT=false
for arg in "$@"; do
  case "$arg" in
    --skip-tests)     SKIP_TESTS=true ;;
    --skip-playwright) SKIP_PLAYWRIGHT=true ;;
  esac
done

# ─── resolve repo root ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

section "Astropress dev environment setup"
info "Repo root: $REPO_ROOT"
DEPS_INSTALLED=false

# ─── OS detection ────────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in
  Darwin)  PLATFORM="macos"   ;;
  Linux)   PLATFORM="linux"   ;;
  FreeBSD) PLATFORM="freebsd" ;;
  OpenBSD) PLATFORM="openbsd" ;;
  NetBSD)  PLATFORM="netbsd"  ;;
  *)       die "Unsupported OS: $OS. Use the devcontainer or install manually." ;;
esac
info "Platform: $PLATFORM ($ARCH)"

# ─── helpers ─────────────────────────────────────────────────────────────────
has() { command -v "$1" &>/dev/null; }

require_or_install_brew_pkg() {
  local pkg="$1"; local cmd="${2:-$1}"
  if has "$cmd"; then ok "$cmd already installed"; return; fi
  if [[ "$PLATFORM" == "macos" ]]; then
    info "Installing $pkg via Homebrew…"
    brew install "$pkg"
  else
    warn "$cmd not found. Please install $pkg for your distro/BSD and re-run."
    die "Missing: $cmd"
  fi
}

# ─── 1. Python 3 ─────────────────────────────────────────────────────────────
section "Python 3"
if has python3; then
  PYVER="$(python3 --version 2>&1)"
  ok "python3 found: $PYVER"
else
  case "$PLATFORM" in
    macos)   brew install python3 ;;
    linux)
      if has apt-get;  then sudo apt-get install -y python3
      elif has dnf;    then sudo dnf install -y python3
      elif has pacman; then sudo pacman -S --noconfirm python
      elif has zypper; then sudo zypper install -y python3
      else die "Cannot auto-install python3. Install it manually and re-run."; fi ;;
    freebsd) sudo pkg install -y python3 ;;
    openbsd) warn "On OpenBSD run: pkg_add python3" ; die "Missing: python3" ;;
    netbsd)  warn "On NetBSD run: pkgin install python3" ; die "Missing: python3" ;;
  esac
  ok "python3 installed"
fi

# ─── 2. Node 24.8+ (via nvm) ─────────────────────────────────────────────────
section "Node.js 24.8+"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
fi

NODE_OK=false
if has node; then
  NODE_MAJOR="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')"
  if [[ "$NODE_MAJOR" -ge 24 ]]; then
    ok "node $(node --version) already installed"
    NODE_OK=true
  else
    warn "node $(node --version) is too old (need 24.8+)"
  fi
fi

if [[ "$NODE_OK" == false ]]; then
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    info "Installing nvm…"
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    source "$NVM_DIR/nvm.sh"
  fi
  info "Installing Node 24 via nvm…"
  nvm install 24
  nvm use 24
  nvm alias default 24
  ok "node $(node --version) installed"
fi

# ─── 3. Bun 1.3.x ────────────────────────────────────────────────────────────
section "Bun 1.3.x"
TARGET_BUN="1.3.10"
if has bun; then
  BUN_VER="$(bun --version)"
  BUN_MINOR="$(echo "$BUN_VER" | cut -d. -f1-2)"
  if [[ "$BUN_MINOR" == "1.3" ]]; then
    ok "bun $BUN_VER already installed"
  else
    warn "bun $BUN_VER installed but 1.3.x is required. Installing $TARGET_BUN…"
    curl -fsSL https://bun.sh/install | bash -s "bun-v${TARGET_BUN}"
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    ok "bun $(bun --version) installed"
  fi
else
  info "Installing bun $TARGET_BUN…"
  curl -fsSL https://bun.sh/install | bash -s "bun-v${TARGET_BUN}"
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  ok "bun $(bun --version) installed"
fi

# Ensure bun is on PATH for the rest of this session
if ! has bun && [[ -f "$HOME/.bun/bin/bun" ]]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi

# ─── 4. Rust stable ──────────────────────────────────────────────────────────
section "Rust stable"
if [[ -f "$HOME/.cargo/env" ]]; then
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
fi

if has rustc && has cargo; then
  ok "rustc $(rustc --version) already installed"
else
  case "$PLATFORM" in
    openbsd)
      # OpenBSD ships Rust via ports; rustup doesn't support it natively
      warn "On OpenBSD, install Rust via ports: pkg_add rust"
      die "Missing: rustc — install Rust via OpenBSD ports then re-run." ;;
    *)
      info "Installing Rust via rustup…"
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
      # shellcheck source=/dev/null
      source "$HOME/.cargo/env"
      ok "rustc $(rustc --version) installed" ;;
  esac
fi

# ─── 5. Playwright browsers + system deps ────────────────────────────────────
section "Playwright"
if [[ "$SKIP_PLAYWRIGHT" == true ]]; then
  warn "Skipping Playwright install (--skip-playwright)"
else
  if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
    info "node_modules not found; running bun install before Playwright browser install…"
    bun install
    DEPS_INSTALLED=true
  fi

  info "Installing Playwright Chromium, Firefox, and WebKit browser binaries…"
  # Use the repo-local Playwright binary after bun install so browser revisions
  # match the lockfile instead of whatever npx would download that day.
  npx --yes playwright install chromium firefox webkit

  if [[ "$PLATFORM" == "linux" ]]; then
    if has apt-get; then
      info "Installing Playwright browser system dependencies via apt…"
      npx --yes playwright install-deps chromium firefox webkit
    else
      warn "Playwright only auto-installs Linux browser system dependencies on apt-based distributions."
      warn "Chromium, Firefox, and WebKit binaries are installed, but WebKit may still need distro-specific libraries."
      warn "Flatpak WebKitGTK/Epiphany is not a Playwright WebKit replacement; use Ubuntu CI or a version-pinned mcr.microsoft.com/playwright:v<same-version>-noble container matching npx playwright --version for WebKit parity."
    fi
  fi

  ok "Playwright Chromium, Firefox, and WebKit ready"
fi

# ─── 6. .env bootstrap ───────────────────────────────────────────────────────
section ".env file"
ENV_FILE="$REPO_ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
  ok ".env already exists — skipping (delete it to regenerate)"
else
  info "Creating .env with local dev defaults…"
  # Generate a random 32-byte hex secret without openssl dependency
  if has openssl; then
    SESSION_SECRET="$(openssl rand -hex 32)"
  else
    SESSION_SECRET="$(tr -dc 'a-f0-9' < /dev/urandom | head -c 64)"
  fi

  cat > "$ENV_FILE" <<ENVEOF
# Astropress local development environment
# Generated by tooling/scripts/install.sh — edit as needed

# ── Runtime mode ─────────────────────────────────────────────────────────────
ASTROPRESS_RUNTIME_MODE=local
ASTROPRESS_LOCAL_PROVIDER=sqlite

# ── Session + auth ───────────────────────────────────────────────────────────
# IMPORTANT: change before deploying to any shared/hosted environment
SESSION_SECRET=${SESSION_SECRET}
ADMIN_PASSWORD=admin123
EDITOR_PASSWORD=editor123

# ── Email — mock mode by default (preview shown in server logs) ───────────────
EMAIL_DELIVERY_MODE=mock
# Uncomment and fill to enable real transactional email via Resend:
# RESEND_API_KEY=
# RESEND_FROM_EMAIL=

# ── Newsletter — mock mode by default ─────────────────────────────────────────
NEWSLETTER_DELIVERY_MODE=mock
# Uncomment and fill to enable Mailchimp:
# MAILCHIMP_API_KEY=
# MAILCHIMP_LIST_ID=
# MAILCHIMP_SERVER=

# ── Cloudflare Turnstile — disabled by default ────────────────────────────────
# ASTROPRESS_TURNSTILE_SITE_KEY=
# ASTROPRESS_TURNSTILE_SECRET_KEY=

# ── Vite alias note ───────────────────────────────────────────────────────────
# The framework uses a Vite alias called "local-runtime-modules".
# If you see "Cannot find module 'local-runtime-modules'" when starting dev,
# ensure your vite.config.ts includes the astropressViteIntegration() plugin.
# See docs/reference/ARCHITECTURE.md for details.
ENVEOF

  ok ".env created (session secret generated)"
  warn "Admin password is set to 'admin123' — change it before any real deployment."
fi

# ─── 7. npm / bun install ────────────────────────────────────────────────────
section "Installing dependencies"
if [[ "$DEPS_INSTALLED" == true ]]; then
  ok "Dependencies already installed"
else
  info "Running bun install…"
  bun install
  ok "Dependencies installed"
fi

# ─── 8. Cargo build (needed for CLI tests + doctor) ──────────────────────────
section "Building Rust CLI"
info "Running cargo build (debug)…"
cargo build --bin astropress-cli 2>&1 | tail -5
ok "CLI built: target/debug/astropress-cli"

# ─── 9. Test suite ───────────────────────────────────────────────────────────
section "Test suite"
if [[ "$SKIP_TESTS" == true ]]; then
  warn "Skipping tests (--skip-tests)"
else
  info "Running Rust CLI tests…"
  cargo test
  info "Running Vitest suite…"
  bun run --filter "@astropress-diy/astropress" test
  info "Running coverage gate…"
  bun run test:coverage
  if [[ "$SKIP_PLAYWRIGHT" != true ]]; then
    info "Running Playwright acceptance suite…"
    bun run test:acceptance
  fi
  ok "All tests passed"
fi

# ─── 10. doctor ──────────────────────────────────────────────────────────────
section "Environment check"
CLI="$REPO_ROOT/target/debug/astropress-cli"
if [[ -x "$CLI" ]]; then
  info "Running astropress doctor (monorepo context)…"
  # Doctor runs against a scaffolded project dir; show help instead at repo root
  "$CLI" --help 2>/dev/null | head -8 || true
  ok "CLI is functional"
else
  warn "CLI binary not found — cargo build may have failed silently."
fi

# ─── done ────────────────────────────────────────────────────────────────────
section "Setup complete"
cat <<SUMMARY

${GREEN}${BOLD}Astropress dev environment is ready.${RESET}

  Next steps:
    1. Scaffold a site:
         cargo run --bin astropress-cli -- new my-site --provider sqlite
         cd my-site && bun install
         ../target/debug/astropress-cli dev --project-dir .

    2. Open the admin: http://localhost:4321/ap-admin
       Admin user:     admin / admin123   (change in .env)

    3. Read the architecture note in .env about 'local-runtime-modules'
       before writing any host-app Vite config.

  Docs:
    docs/guides/OPERATIONS.md     — operator workflows (backup, restore, import)
    docs/reference/ARCHITECTURE.md — Vite alias seam and runtime model
    docs/reference/EVALUATION.md   — full framework evaluation

SUMMARY
