import {
	AuditReport,
	fromRoot,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

// Verifies that every provider ID in the TypeScript type system has a corresponding
// entry in tooling/verified-providers.json. This prevents hallucinated providers
// from entering the codebase — any new provider must be added to verified-providers.json
// first, with a real URL, before it can appear in the type system.

type VerifiedProvider = { id: string; url: string | null };
type VerifiedProviders = {
	appHosts: VerifiedProvider[];
	dataServices: VerifiedProvider[];
};

async function extractTypeUnionValues(
	filePath: string,
	typeName: string,
): Promise<string[]> {
	const src = await readText(filePath);
	const typeRegex = new RegExp(`export type ${typeName}\\s*=[^;]+;`, "s");
	const match = src.match(typeRegex);
	if (!match) return [];
	return [...match[0].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

async function main() {
	const report = new AuditReport("provider");
	const verified: VerifiedProviders = JSON.parse(
		await readText(fromRoot("tooling/verified-providers.json")),
	);

	const verifiedHostIds = new Set(verified.appHosts.map((p) => p.id));
	const verifiedServiceIds = new Set(verified.dataServices.map((p) => p.id));

	const appHostValues = await extractTypeUnionValues(
		fromRoot("packages/astropress/src/app-host-targets.ts"),
		"AstropressAppHost",
	);
	const dataServiceValues = await extractTypeUnionValues(
		fromRoot("packages/astropress/src/data-service-targets.ts"),
		"AstropressDataServices",
	);

	for (const id of appHostValues) {
		if (!verifiedHostIds.has(id)) {
			report.add(
				`AstropressAppHost: "${id}" is not in tooling/verified-providers.json — verify it exists before adding`,
			);
		}
	}

	for (const id of dataServiceValues) {
		if (!verifiedServiceIds.has(id)) {
			report.add(
				`AstropressDataServices: "${id}" is not in tooling/verified-providers.json — verify it exists before adding`,
			);
		}
	}

	// ── AGENTS.md must contain the no-speculative-features rule ──
	const agentsSrc = await readText(fromRoot("AGENTS.md"));
	if (
		!agentsSrc.includes("No speculative features") &&
		!agentsSrc.includes("no-speculative-features")
	) {
		report.add(
			'AGENTS.md: "No speculative features" rule is missing — contributors must be instructed never to add unverified providers',
		);
	}

	report.finish(
		`provider audit passed — ${appHostValues.length} app hosts, ${dataServiceValues.length} data services, all verified. AGENTS.md no-speculative-features rule present.`,
	);
}

runAudit("provider", main);
