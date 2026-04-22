import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type TruthSource = {
	crypto: {
		passwordHash: string;
		tokenDigest: string;
		webhookSignature: string;
	};
	docs: {
		readmeSecurityNote: string;
		hostedE2EGap: string;
	};
	bannedPhrases: string[];
};

const root = process.cwd();
const truthPath = join(root, "tooling/readiness-truth.json");
const requiredFiles = ["README.md", "docs/reference/EVALUATION.md"];
const auditableExtensions = new Set([
	".md",
	".mdx",
	".ts",
	".tsx",
	".astro",
	".feature",
	".rs",
	".yml",
	".yaml",
]);

// Files that legitimately reference SHA-256 as an external webhook HMAC protocol
// (Formbricks / Typebot use HMAC-SHA256 for their outbound webhook signatures —
// Astropress must verify using the algorithm they specify; this is not an internal
// crypto choice and is not subject to the Argon2id/KMAC256/ML-DSA-65 rules).
const bannedPhraseAllowlist = new Set([
	"tooling/scripts/audit-honesty.ts", // defines the allowlist itself
	"AGENTS.md", // describes the audit rules themselves
	"docs/guides/TESTIMONIALS.md", // documents third-party webhook HMAC
	"docs/reference/SPEC.md", // API spec includes third-party webhook endpoints
	"packages/astropress/pages/ap-api/v1/testimonials/ingest.ts", // WebCrypto HMAC verification (can't change algo name)
	"packages/astropress/src/config-service-types.ts", // JSDoc for webhook secret config
	"packages/astropress/tests/zta-invariants.test.ts", // test comment describing webhook auth
]);

function isAuditableFile(file: string) {
	return [...auditableExtensions].some((ext) => file.endsWith(ext));
}

async function main() {
	const truth = JSON.parse(await readFile(truthPath, "utf8")) as TruthSource;
	const trackedFiles = execFileSync("git", ["ls-files"], {
		cwd: root,
		encoding: "utf8",
	})
		.split("\n")
		.map((file) => file.trim())
		.filter((file) => file.length > 0)
		.filter(
			(file) => !file.startsWith("node_modules/") && isAuditableFile(file),
		);

	const violations: string[] = [];

	for (const file of trackedFiles) {
		if (bannedPhraseAllowlist.has(file)) {
			continue;
		}
		const body = await readFile(join(root, file), "utf8");

		for (const phrase of truth.bannedPhrases) {
			if (!body.includes(phrase)) {
				continue;
			}
			violations.push(`${file}: banned phrase "${phrase}"`);
		}
	}

	for (const file of requiredFiles) {
		const body = await readFile(join(root, file), "utf8");
		for (const required of [
			truth.crypto.passwordHash,
			truth.crypto.tokenDigest,
			truth.crypto.webhookSignature,
		]) {
			if (!body.includes(required)) {
				violations.push(`${file}: missing required truth marker "${required}"`);
			}
		}
	}

	const readme = await readFile(join(root, "README.md"), "utf8");
	if (!readme.includes(truth.docs.readmeSecurityNote)) {
		violations.push(
			"README.md: security note drifted from tooling/readiness-truth.json",
		);
	}

	const evaluation = await readFile(
		join(root, "docs/reference/EVALUATION.md"),
		"utf8",
	);
	if (!evaluation.includes(truth.docs.hostedE2EGap)) {
		violations.push(
			"docs/EVALUATION.md: hosted-provider gap wording drifted from tooling/readiness-truth.json",
		);
	}

	if (violations.length > 0) {
		console.error("honesty audit failed:\n");
		for (const violation of violations) {
			console.error(`- ${violation}`);
		}
		process.exit(1);
	}

	console.log("honesty audit passed.");
}

main().catch((error) => {
	console.error("honesty audit failed:", error);
	process.exit(1);
});
