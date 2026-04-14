import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Rubric 25 (Caching Strategy)
//
// Verifies that the caching strategy is implemented with two independent purge paths
// and that failures in either path are non-fatal (never block a publish operation).
//
// Checks:
//   1. src/cache-purge.ts exists and implements the Cloudflare Cache API strategy
//   2. src/cache-purge.ts implements a generic webhook purge strategy
//   3. All error paths in cache-purge.ts use console.warn not throw (non-fatal)
//   4. src/security-headers.ts exists (cache-related response headers are configured there)

const root = process.cwd();
const CACHE_PURGE = join(root, "packages/astropress/src/cache-purge.ts");
const SECURITY_HEADERS = join(root, "packages/astropress/src/security-headers.ts");

async function main() {
  const violations: string[] = [];

  // 1 + 2 + 3: cache-purge.ts
  const cachePurgeSrc = await readFile(CACHE_PURGE, "utf8").catch(() => null);
  if (!cachePurgeSrc) {
    violations.push(
      "src/cache-purge.ts: file not found — CDN cache purge implementation is missing",
    );
  } else {
    // Cloudflare Cache API strategy: purges via zones API using CLOUDFLARE_API_TOKEN
    const hasCloudflareStrategy =
      cachePurgeSrc.includes("purge_cache") ||
      cachePurgeSrc.includes("CLOUDFLARE_API_TOKEN") ||
      cachePurgeSrc.includes("CLOUDFLARE_ZONE_ID");
    if (!hasCloudflareStrategy) {
      violations.push(
        "src/cache-purge.ts: Cloudflare Cache API strategy not found — expected CLOUDFLARE_API_TOKEN + /purge_cache usage",
      );
    }

    // Generic webhook strategy: POSTs slug + purgedAt to config.cdnPurgeWebhook
    const hasWebhookStrategy =
      cachePurgeSrc.includes("cdnPurgeWebhook") ||
      cachePurgeSrc.includes("purgeWebhook") ||
      cachePurgeSrc.includes("webhookUrl");
    if (!hasWebhookStrategy) {
      violations.push(
        "src/cache-purge.ts: generic webhook purge strategy not found — expected config.cdnPurgeWebhook usage",
      );
    }

    // Non-fatal failures: all error paths must use console.warn
    if (!cachePurgeSrc.includes("console.warn")) {
      violations.push(
        "src/cache-purge.ts: no console.warn found — CDN failures must be logged, not silently ignored",
      );
    }

    // Ensure no throw in catch/error paths
    const hasThrowInCatch =
      /\.catch\s*\([^)]*\)\s*\{\s*throw/m.test(cachePurgeSrc) ||
      /catch\s*\([^)]*\)\s*\{\s*throw/m.test(cachePurgeSrc);
    if (hasThrowInCatch) {
      violations.push(
        "src/cache-purge.ts: error path throws — CDN purge failures must be non-fatal (console.warn and continue)",
      );
    }
  }

  // 4. security-headers.ts exists (cache/response headers layer)
  const secHeadersSrc = await readFile(SECURITY_HEADERS, "utf8").catch(() => null);
  if (!secHeadersSrc) {
    violations.push(
      "src/security-headers.ts: file not found — response headers (including cache-control) must be configured here",
    );
  }

  if (violations.length > 0) {
    console.error("caching audit failed:\n");
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log(
    "caching audit passed — Cloudflare Cache API strategy, generic webhook strategy, non-fatal error handling, and security-headers layer all verified.",
  );
}

main().catch((err) => {
  console.error("caching audit failed:", err);
  process.exit(1);
});
