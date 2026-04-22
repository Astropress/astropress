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
 * Requires: gh CLI authenticated (gh auth login)
 */

import { execFileSync } from "node:child_process";

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
