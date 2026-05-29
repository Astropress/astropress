/**
 * audit-secret-in-url.ts
 *
 * Forbids high-entropy secret material from being carried in a URL (redirect
 * Location or query string) anywhere under `pages/**`. This is the class behind
 * #113 (raw API token in `?rawToken=`), #115 (webhook public key in
 * `?publicKey=`) and #133 (reset/invite links in `?reset_link=`/`?invite_link=`).
 * Secrets in URLs leak via browser history, the `Referer` header, and server
 * access logs.
 *
 * The fix for the class is the one-time server-side flash store
 * (`resolveFlashStore`): the action `put`s the secret and redirects carrying
 * only an opaque `flash=<id>`; the destination page `consume`s it once. This
 * audit fails if any forbidden secret param name reappears as a URL parameter —
 * whether it is written (`searchParams.set` / `?name=` / `&name=`) or read back
 * (`searchParams.get`).
 *
 * The opaque hand-off params (`flash`, `reset_flash`) and the inherent
 * emailed-link token param (`token`, used by the public accept-invite /
 * reset-password entry pages) are intentionally NOT forbidden — the former
 * carry no secret, the latter is how the user arrives at the page.
 *
 * Exit 0 — no secret param names appear in any URL under pages/**.
 * Exit 1 — a secret is being carried in a URL again.
 */

import { relative } from "node:path";
import { AuditReport, fromRoot, listFiles, readText, runAudit } from "../lib/audit-utils.js";

const PAGES_ROOT = fromRoot("packages/astropress/pages");

/** URL parameter names that must never carry secret material. */
const FORBIDDEN_PARAMS = [
	"rawToken",
	"raw_token",
	"publicKey",
	"public_key",
	"privateKey",
	"private_key",
	"reset_link",
	"resetLink",
	"invite_link",
	"inviteLink",
	"apiKey",
	"api_key",
	"accessToken",
	"refreshToken",
	"secret",
] as const;

/**
 * Builds the URL-parameter detectors for a name. We match only contexts that
 * are unambiguously a URL parameter — `searchParams.{set,get,append}("name"`
 * and a query-string `?name=` / `&name=` — so plain JS identifiers (e.g.
 * `verification.publicKey`, `{ publicKey }`) are not false positives.
 */
function detectorsFor(name: string): RegExp[] {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return [
		new RegExp(`searchParams\\.(?:set|get|append)\\(\\s*["'\`]${escaped}["'\`]`),
		new RegExp(`[?&]${escaped}=`),
	];
}

async function main(): Promise<void> {
	const report = new AuditReport("secret-in-url");

	const files = await listFiles(PAGES_ROOT, {
		recursive: true,
		extensions: [".ts", ".astro"],
	});

	for (const file of files) {
		const abs = `${PAGES_ROOT}/${file}`;
		const rel = relative(fromRoot(), abs);
		const src = await readText(abs);
		for (const name of FORBIDDEN_PARAMS) {
			if (detectorsFor(name).some((re) => re.test(src))) {
				report.add(
					`${rel}: carries the secret-bearing parameter "${name}" in a URL. Hand the secret ` +
						`off through the one-time flash store (resolveFlashStore → flash.put / consume) ` +
						`and redirect with only an opaque flash=<id> (#113/#115/#133).`,
				);
			}
		}
	}

	report.finish("✓ audit:secret-in-url — no secret material is carried in any pages/** URL");
}

runAudit("secret-in-url", main);
