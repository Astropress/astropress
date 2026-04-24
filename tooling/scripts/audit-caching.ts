import {
	AuditReport,
	fromRoot,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

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

const CACHE_PURGE = fromRoot("packages/astropress/src/cache-purge.ts");
const SECURITY_HEADERS = fromRoot("packages/astropress/src/security-headers.ts");

async function main() {
	const report = new AuditReport("caching");

	// 1 + 2 + 3: cache-purge.ts
	const cachePurgeSrc = await readText(CACHE_PURGE);
	if (!cachePurgeSrc) {
		report.add(
			"src/cache-purge.ts: file not found — CDN cache purge implementation is missing",
		);
	} else {
		const hasCloudflareStrategy =
			cachePurgeSrc.includes("purge_cache") ||
			cachePurgeSrc.includes("CLOUDFLARE_API_TOKEN") ||
			cachePurgeSrc.includes("CLOUDFLARE_ZONE_ID");
		if (!hasCloudflareStrategy) {
			report.add(
				"src/cache-purge.ts: Cloudflare Cache API strategy not found — expected CLOUDFLARE_API_TOKEN + /purge_cache usage",
			);
		}

		const hasWebhookStrategy =
			cachePurgeSrc.includes("cdnPurgeWebhook") ||
			cachePurgeSrc.includes("purgeWebhook") ||
			cachePurgeSrc.includes("webhookUrl");
		if (!hasWebhookStrategy) {
			report.add(
				"src/cache-purge.ts: generic webhook purge strategy not found — expected config.cdnPurgeWebhook usage",
			);
		}

		if (!cachePurgeSrc.includes("console.warn")) {
			report.add(
				"src/cache-purge.ts: no console.warn found — CDN failures must be logged, not silently ignored",
			);
		}

		const hasThrowInCatch =
			/\.catch\s*\([^)]*\)\s*\{\s*throw/m.test(cachePurgeSrc) ||
			/catch\s*\([^)]*\)\s*\{\s*throw/m.test(cachePurgeSrc);
		if (hasThrowInCatch) {
			report.add(
				"src/cache-purge.ts: error path throws — CDN purge failures must be non-fatal (console.warn and continue)",
			);
		}
	}

	// 4. security-headers.ts exists (cache/response headers layer)
	const secHeadersSrc = await readText(SECURITY_HEADERS);
	if (!secHeadersSrc) {
		report.add(
			"src/security-headers.ts: file not found — response headers (including cache-control) must be configured here",
		);
	}

	report.finish(
		"caching audit passed — Cloudflare Cache API strategy, generic webhook strategy, non-fatal error handling, and security-headers layer all verified.",
	);
}

runAudit("caching", main);
