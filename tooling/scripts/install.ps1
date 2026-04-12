# Astropress local dev installer — Windows (PowerShell 5.1 / 7+)
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File scripts\install.ps1
# Pass -SkipTests to bypass the test suite after bootstrap.
[CmdletBinding()]
param(
    [switch]$SkipTests,
    [switch]$SkipPlaywright
)
$ErrorActionPreference = "Stop"

# ─── colour helpers ──────────────────────────────────────────────────────────
function info($msg)    { Write-Host "[info]  $msg" -ForegroundColor Cyan }
function ok($msg)      { Write-Host "[ok]    $msg" -ForegroundColor Green }
function warn($msg)    { Write-Host "[warn]  $msg" -ForegroundColor Yellow }
function section($msg) { Write-Host "`n=== $msg ===" -ForegroundColor White }
function die($msg)     { Write-Host "[error] $msg" -ForegroundColor Red; exit 1 }

function has($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

# ─── resolve repo root ───────────────────────────────────────────────────────
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptDir
Set-Location $RepoRoot

section "Astropress dev environment setup"
info "Repo root: $RepoRoot"
info "PowerShell: $($PSVersionTable.PSVersion)"

# ─── check winget ────────────────────────────────────────────────────────────
$HasWinget = has winget
$HasScoop  = has scoop
$HasChoco  = has choco

if (-not $HasWinget -and -not $HasScoop -and -not $HasChoco) {
    warn "No package manager found (winget / scoop / choco)."
    warn "Node.js will fall back to a direct .msi download; Rust uses its own installer."
    warn "Python must be installed manually if not already present (https://python.org)."
    warn "For a smoother setup, install winget from the Microsoft Store (App Installer)."
}

# ─── helper: install via best available package manager ──────────────────────
function Install-Package {
    param($WingetId, $ScoopPkg, $ChocoPkg, $DisplayName)
    info "Installing $DisplayName..."
    if ($HasWinget) {
        winget install --id $WingetId --silent --accept-source-agreements --accept-package-agreements
    } elseif ($HasScoop) {
        scoop install $ScoopPkg
    } elseif ($HasChoco) {
        choco install $ChocoPkg -y
    } else {
        die "Cannot auto-install $DisplayName. Install it manually and re-run."
    }
}

# ─── 1. Python 3 ─────────────────────────────────────────────────────────────
section "Python 3"
if (has python) {
    $pyver = python --version 2>&1
    ok "python found: $pyver"
} elseif (has python3) {
    $pyver = python3 --version 2>&1
    ok "python3 found: $pyver"
} else {
    Install-Package "Python.Python.3.12" "python" "python3" "Python 3.12"
    # Refresh PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH","User")
    ok "Python installed"
}

# ─── 2. Node 20+ ─────────────────────────────────────────────────────────────
$NodeMsiVersion = "22.14.0"   # Node 22 LTS (Active LTS; required for node:sqlite)

function Install-NodeViaMsi {
    param($Version)
    $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    $msiName = "node-v$Version-$arch.msi"
    $msiUrl  = "https://nodejs.org/dist/v$Version/$msiName"
    $msiPath = Join-Path $env:TEMP $msiName
    info "Downloading $msiUrl..."
    Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath -UseBasicParsing
    info "Running msiexec /i $msiName /qn (silent install)..."
    $proc = Start-Process msiexec.exe -ArgumentList "/i","`"$msiPath`"","/qn","/norestart" -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        die "msiexec failed with exit code $($proc.ExitCode). Install Node.js manually from https://nodejs.org/"
    }
    Remove-Item $msiPath -ErrorAction SilentlyContinue
}

section "Node.js 20+"
$NodeOk = $false
if (has node) {
    $nodever = node -e "process.stdout.write(process.version)"
    $nodeMajor = [int]($nodever.TrimStart("v").Split(".")[0])
    if ($nodeMajor -ge 22) {
        ok "node $nodever already installed"
        $NodeOk = $true
    } else {
        warn "node $nodever is too old (need 22+ for node:sqlite)"
    }
}
if (-not $NodeOk) {
    if ($HasWinget -or $HasScoop -or $HasChoco) {
        Install-Package "OpenJS.NodeJS.LTS" "nodejs-lts" "nodejs-lts" "Node.js 22 LTS"
    } else {
        info "No package manager found — falling back to direct .msi download"
        Install-NodeViaMsi $NodeMsiVersion
    }
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH","User")
    if (-not (has node)) {
        die "Node.js installed but not yet on PATH. Open a new PowerShell window and re-run."
    }
    ok "Node.js installed: $(node --version)"
}

# ─── 3. Bun 1.3.x ────────────────────────────────────────────────────────────
section "Bun 1.3.x"
$TargetBun = "1.3.10"
$BunOk = $false
if (has bun) {
    $bunver = bun --version
    $bunMinor = ($bunver -split "\.")[0..1] -join "."
    if ($bunMinor -eq "1.3") {
        ok "bun $bunver already installed"
        $BunOk = $true
    } else {
        warn "bun $bunver installed but 1.3.x required"
    }
}
if (-not $BunOk) {
    # Bun official Windows install
    if ($HasWinget) {
        winget install --id Oven-sh.Bun --version $TargetBun --silent `
              --accept-source-agreements --accept-package-agreements
    } else {
        # Fallback: npm global install (slower but works without winget)
        info "winget not available — installing bun via npm..."
        if (-not (has npm)) { die "npm not found. Install Node.js first." }
        npm install -g "bun@$TargetBun"
    }
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH","User")
    if (has bun) { ok "bun $(bun --version) installed" }
    else { warn "bun may need a new terminal session to appear on PATH" }
}

# ─── 4. Rust stable ──────────────────────────────────────────────────────────
section "Rust stable"
if (has rustc) {
    ok "rustc $(rustc --version) already installed"
} else {
    info "Downloading rustup-init.exe..."
    $rustupUrl  = "https://win.rustup.rs/x86_64"
    $rustupExe  = "$env:TEMP\rustup-init.exe"
    Invoke-WebRequest -Uri $rustupUrl -OutFile $rustupExe -UseBasicParsing
    info "Running rustup-init (this takes a few minutes)..."
    & $rustupExe -y --default-toolchain stable
    # Add cargo bin to current session
    $cargoBin = "$env:USERPROFILE\.cargo\bin"
    if ($env:PATH -notlike "*$cargoBin*") {
        $env:PATH = "$cargoBin;$env:PATH"
    }
    ok "rustc $(rustc --version) installed"
}

# ─── 5. Playwright ───────────────────────────────────────────────────────────
section "Playwright"
if ($SkipPlaywright) {
    warn "Skipping Playwright install (-SkipPlaywright)"
} else {
    info "Installing Playwright Chromium and system dependencies..."
    npx --yes playwright install --with-deps chromium
    ok "Playwright Chromium ready"
}

# ─── 6. .env bootstrap ───────────────────────────────────────────────────────
section ".env file"
$EnvFile = Join-Path $RepoRoot ".env"
if (Test-Path $EnvFile) {
    ok ".env already exists — skipping (delete it to regenerate)"
} else {
    info "Creating .env with local dev defaults..."
    # Generate a random 32-byte hex secret
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $SessionSecret = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""

    $envContent = @"
# Astropress local development environment
# Generated by scripts\install.ps1 — edit as needed

# ── Runtime mode ─────────────────────────────────────────────────────────────
ASTROPRESS_RUNTIME_MODE=local
ASTROPRESS_LOCAL_PROVIDER=sqlite

# ── Session + auth ───────────────────────────────────────────────────────────
# IMPORTANT: change before deploying to any shared/hosted environment
ASTROPRESS_SESSION_SECRET=$SessionSecret
ASTROPRESS_ADMIN_PASSWORD=admin123
ASTROPRESS_EDITOR_PASSWORD=editor123

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
# See docs/ARCHITECTURE.md for details.
"@
    Set-Content -Path $EnvFile -Value $envContent -Encoding UTF8
    ok ".env created (session secret generated)"
    warn "Admin password is set to 'admin123' — change it before any real deployment."
}

# ─── 7. bun install ──────────────────────────────────────────────────────────
section "Installing dependencies"
info "Running bun install..."
bun install
ok "Dependencies installed"

# ─── 8. Cargo build ──────────────────────────────────────────────────────────
section "Building Rust CLI"
info "Running cargo build (debug)..."
cargo build --bin astropress-cli
$CliBin = Join-Path $RepoRoot "target\debug\astropress-cli.exe"
if (Test-Path $CliBin) { ok "CLI built: $CliBin" }
else { warn "CLI binary not found after build — check cargo output above." }

# ─── 9. Test suite ───────────────────────────────────────────────────────────
section "Test suite"
if ($SkipTests) {
    warn "Skipping tests (-SkipTests)"
} else {
    info "Running Rust CLI tests..."
    cargo test
    info "Running Vitest suite..."
    bun run --filter astropress test
    info "Running coverage gate..."
    bun run test:coverage
    if (-not $SkipPlaywright) {
        info "Running Playwright acceptance suite..."
        bun run test:acceptance
    }
    ok "All tests passed"
}

# ─── done ────────────────────────────────────────────────────────────────────
section "Setup complete"
Write-Host @"

Astropress dev environment is ready.

  Next steps:
    1. Scaffold a site:
         cargo run --bin astropress-cli -- new my-site --provider sqlite
         cd my-site
         bun install
         ..\target\debug\astropress-cli.exe dev --project-dir .

    2. Open the admin: http://localhost:4321/ap-admin
       Admin user:     admin / admin123   (change in .env)

    3. Read the architecture note in .env about 'local-runtime-modules'
       before writing any host-app Vite config.

  Docs:
    SETUP.md             - operator workflows (backup, restore, import)
    docs\ARCHITECTURE.md - Vite alias seam and runtime model
    docs\EVALUATION.md   - full framework evaluation

"@ -ForegroundColor Green
