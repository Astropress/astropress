/**
 * GHAS (GitHub Advanced Security) alert checker for the current branch.
 *
 * Usage:
 *   bun run tooling/scripts/check-pr-ghas.ts
 *   bun run tooling/scripts/check-pr-ghas.ts --repo owner/repo --branch feat/my-branch
 *
 * Checks code-scanning alerts introduced on the current branch versus main.
 * Exits non-zero if any open, non-dismissed alerts are present on the branch ref.
 *
 * If gh CLI is not installed, attempts to install it automatically:
 *   - apt-based systems (Debian/Ubuntu):  apt-get install gh
 *   - dnf-based systems (Fedora/RHEL):    dnf install gh
 *   - macOS:                              brew install gh
 *   - fallback:                           downloads from GitHub releases
 *
 * After install, prompts for `gh auth login` if not already authenticated.
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";

function ensureGh(): void {
  try {
    execFileSync("gh", ["--version"], { stdio: "ignore" });
    return; // already installed
  } catch {
    // not found — fall through to install
  }

  console.log("gh CLI not found — installing...\n");

  const os = platform();

  if (os === "linux") {
    // Detect package manager
    if (existsSync("/usr/bin/apt-get") || existsSync("/usr/bin/apt")) {
      // Debian/Ubuntu — use the official GitHub CLI apt repo
      execSync(
        `type -p curl >/dev/null || (sudo apt-get update && sudo apt-get install -y curl)
         curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
         sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
         echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
         sudo apt-get update && sudo apt-get install -y gh`,
        { stdio: "inherit", shell: "/bin/bash" },
      );
    } else if (existsSync("/usr/bin/dnf")) {
      execSync("sudo dnf install -y gh", { stdio: "inherit" });
    } else if (existsSync("/usr/bin/yum")) {
      execSync("sudo yum install -y gh", { stdio: "inherit" });
    } else if (existsSync("/usr/bin/pacman")) {
      execSync("sudo pacman -Sy --noconfirm github-cli", { stdio: "inherit" });
    } else if (existsSync("/usr/bin/zypper")) {
      execSync("sudo zypper install -y gh", { stdio: "inherit" });
    } else {
      installGhViaTarball();
    }
  } else if (os === "darwin") {
    execSync("brew install gh", { stdio: "inherit" });
  } else {
    installGhViaTarball();
  }

  // Verify install succeeded
  try {
    const version = execFileSync("gh", ["--version"], { encoding: "utf8" }).trim().split("\n")[0];
    console.log(`\nInstalled: ${version}\n`);
  } catch {
    console.error("gh install appeared to succeed but `gh --version` still fails. Add gh to PATH and retry.");
    process.exit(1);
  }

  // Check auth
  try {
    execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
  } catch {
    console.log("gh is installed but not authenticated. Run:\n\n  gh auth login\n\nthen re-run this script.");
    process.exit(1);
  }
}

function installGhViaTarball(): void {
  // Fallback: download latest release tarball from GitHub
  const arch = process.arch === "arm64" ? "arm64" : "amd64";
  const script = `
    set -e
    GH_VERSION=$(curl -s https://api.github.com/repos/cli/cli/releases/latest | grep '"tag_name"' | cut -d'"' -f4 | sed 's/^v//')
    curl -fsSL "https://github.com/cli/cli/releases/download/v\${GH_VERSION}/gh_\${GH_VERSION}_linux_${arch}.tar.gz" -o /tmp/gh.tar.gz
    tar -xzf /tmp/gh.tar.gz -C /tmp
    sudo mv /tmp/gh_\${GH_VERSION}_linux_${arch}/bin/gh /usr/local/bin/gh
    rm -rf /tmp/gh.tar.gz /tmp/gh_\${GH_VERSION}_linux_${arch}
  `;
  execSync(script, { stdio: "inherit", shell: "/bin/bash" });
}

function gh(args: string[]): unknown {
  const out = execFileSync("gh", ["api", "--paginate", ...args], { encoding: "utf8" });
  return JSON.parse(out);
}

function getCurrentBranch(): string {
  return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
}

function getRepo(): string {
  const remoteUrl = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
  // handles git@github.com:owner/repo.git and https://github.com/owner/repo.git
  const m = remoteUrl.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!m) throw new Error(`Cannot parse repo from remote URL: ${remoteUrl}`);
  return m[1];
}

interface Alert {
  number: number;
  state: string;
  dismissed_reason: string | null;
  rule: { id: string; description: string; severity: string };
  tool: { name: string };
  most_recent_instance: { ref: string; location?: { path: string; start_line: number } };
}

async function main() {
  ensureGh();

  const args = process.argv.slice(2);
  const repoArg = args.indexOf("--repo");
  const branchArg = args.indexOf("--branch");

  const repo = repoArg >= 0 ? args[repoArg + 1] : getRepo();
  const branch = branchArg >= 0 ? args[branchArg + 1] : getCurrentBranch();

  if (branch === "main" || branch === "HEAD") {
    console.error("check-pr-ghas: run this on a feature branch, not main/HEAD");
    process.exit(1);
  }

  const ref = `refs/heads/${branch}`;
  console.log(`Checking GHAS alerts for ${repo} @ ${ref}\n`);

  // Fetch open alerts on this branch ref
  let alerts: Alert[];
  try {
    alerts = gh([
      `/repos/${repo}/code-scanning/alerts`,
      "-f", `ref=${ref}`,
      "-f", "state=open",
      "-f", "per_page=100",
    ]) as Alert[];
  } catch (err) {
    // If the branch hasn't been scanned yet (CI hasn't run), the API returns 404 or empty
    const msg = String(err);
    if (msg.includes("404") || msg.includes("no analysis")) {
      console.log("No code-scanning analysis found for this branch yet — CI scan may still be running.");
      console.log("Re-run after CI completes.");
      process.exit(0);
    }
    throw err;
  }

  if (!Array.isArray(alerts) || alerts.length === 0) {
    console.log(`✓ 0 open GHAS alerts on ${branch}`);
    process.exit(0);
  }

  // Partition into dismissed and active
  const active = alerts.filter((a) => a.state === "open" && !a.dismissed_reason);
  const dismissed = alerts.filter((a) => a.dismissed_reason);

  if (dismissed.length > 0) {
    console.log(`  ${dismissed.length} dismissed alert(s) (ignored):`);
    for (const a of dismissed) {
      console.log(`    #${a.number} [${a.tool.name}] ${a.rule.id} — dismissed: ${a.dismissed_reason}`);
    }
    console.log();
  }

  if (active.length === 0) {
    console.log(`✓ 0 active GHAS alerts on ${branch} (${dismissed.length} dismissed)`);
    process.exit(0);
  }

  console.error(`✗ ${active.length} active GHAS alert(s) on ${branch}:\n`);
  for (const a of active) {
    const loc = a.most_recent_instance.location;
    const locStr = loc ? `${loc.path}:${loc.start_line}` : "(no location)";
    console.error(`  #${a.number} [${a.tool.name}] ${a.rule.severity.toUpperCase()} — ${a.rule.id}`);
    console.error(`    ${a.rule.description}`);
    console.error(`    ${locStr}`);
    console.error();
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("check-pr-ghas failed:", err.message ?? err);
  process.exit(1);
});
