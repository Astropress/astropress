import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
	AuditReport,
	fromRoot,
	readText,
	ROOT,
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
