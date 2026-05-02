import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
	AuditReport,
	ROOT,
	fromRoot,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

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

const truthPath = fromRoot("tooling/readiness-truth.json");
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

const bannedPhraseAllowlist = new Set([
	"tooling/scripts/audit-honesty.ts",
	"AGENTS.md",
	"docs/guides/TESTIMONIALS.md",
	"docs/reference/SPEC.md",
	"packages/astropress/pages/ap-api/v1/testimonials/ingest.ts",
	"packages/astropress/src/config-service-types.ts",
	"packages/astropress/tests/zta-invariants.test.ts",
	// Phase 2 secret-store envelope: imports `sha256` from
	// @noble/hashes purely as the HKDF hash primitive. Not a marketing
	// claim about cryptographic strength; the project narrative still
	// names Argon2id / KMAC256 / ML-DSA-65 as the headline algorithms.
	"packages/astropress/src/integration-secret-envelope.ts",
	"tooling/docs/phase-2-secret-store-design.md",
	// Phase 6 OAuth state token + inbound webhook verifier:
	// references HMAC-SHA-256 / SHA-256 / sha256 only as the chosen
	// keyed-MAC primitive (state-token signature, GitHub-style
	// webhook header). Same rule as the envelope module — internal
	// crypto algorithm name, not a marketing claim about strength.
	"packages/astropress/src/integrations/oauth/state.ts",
	"packages/astropress/src/integrations/webhooks/inbound.ts",
	"packages/astropress/tests/integrations/webhooks/inbound.test.ts",
]);

function isAuditableFile(file: string) {
	return [...auditableExtensions].some((ext) => file.endsWith(ext));
}

async function main() {
	const report = new AuditReport("honesty");
	const truth = JSON.parse(await readText(truthPath)) as TruthSource;
	const trackedFiles = execFileSync("git", ["ls-files"], {
		cwd: ROOT,
		encoding: "utf8",
	})
		.split("\n")
		.map((file) => file.trim())
		.filter((file) => file.length > 0)
		.filter(
			(file) => !file.startsWith("node_modules/") && isAuditableFile(file),
		);

	for (const file of trackedFiles) {
		if (bannedPhraseAllowlist.has(file)) {
			continue;
		}
		const body = await readText(join(ROOT, file));

		for (const phrase of truth.bannedPhrases) {
			if (!body.includes(phrase)) {
				continue;
			}
			report.add(`${file}: banned phrase "${phrase}"`);
		}
	}

	for (const file of requiredFiles) {
		const body = await readText(join(ROOT, file));
		for (const required of [
			truth.crypto.passwordHash,
			truth.crypto.tokenDigest,
			truth.crypto.webhookSignature,
		]) {
			if (!body.includes(required)) {
				report.add(`${file}: missing required truth marker "${required}"`);
			}
		}
	}

	const readme = await readText(fromRoot("README.md"));
	if (!readme.includes(truth.docs.readmeSecurityNote)) {
		report.add(
			"README.md: security note drifted from tooling/readiness-truth.json",
		);
	}

	const evaluation = await readText(fromRoot("docs/reference/EVALUATION.md"));
	if (!evaluation.includes(truth.docs.hostedE2EGap)) {
		report.add(
			"docs/reference/EVALUATION.md: hosted-provider gap wording drifted from tooling/readiness-truth.json",
		);
	}

	report.finish("honesty audit passed.");
}

runAudit("honesty", main);
