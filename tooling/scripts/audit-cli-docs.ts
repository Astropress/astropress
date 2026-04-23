import {
	AuditReport,
	fromRoot,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

// Verifies that every command documented in crates/astropress-cli/README.md
// has a corresponding Command::* match arm in main.rs. Prevents documented
// commands from drifting ahead of (or behind) the implementation.

const CLI_README = fromRoot("crates/astropress-cli/README.md");
const MAIN_RS = fromRoot("crates/astropress-cli/src/main.rs");

// Known aliases: a documented name that is handled by the same variant as the
// canonical name. The audit passes if the canonical variant is present.
const ALIAS_CANONICAL: Record<string, string> = {
	init: "new",
};

// Commands whose documented name maps to more than one variant. The audit
// passes if ANY of the listed variants is present in main.rs.
const MULTI_VARIANT: Record<string, string[]> = {
	list: ["ListTools", "ListProviders"],
};

// Words that require custom PascalCase conversion (not just capitalize-first).
const WORD_MAP: Record<string, string> = {
	wordpress: "WordPress",
	wix: "Wix",
};

function toVariantName(cmd: string): string {
	return cmd
		.split(" ")
		.map((w) => WORD_MAP[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
		.join("");
}

function extractDocumentedCommands(readme: string): string[] {
	const commands: string[] = [];
	for (const line of readme.split("\n")) {
		if (!line.startsWith("### ")) continue;
		const matches = [...line.matchAll(/`([^`]+)`/g)];
		for (const m of matches) {
			const name = m[1].trim();
			if (name) commands.push(name);
		}
	}
	return commands;
}

function extractCommandVariants(mainRs: string): Set<string> {
	const variants = new Set<string>();
	for (const m of mainRs.matchAll(/Command::(\w+)/g)) {
		variants.add(m[1]);
	}
	return variants;
}

async function main() {
	const report = new AuditReport("cli-docs");
	const [readme, mainRs] = await Promise.all([
		readText(CLI_README),
		readText(MAIN_RS),
	]);

	const documented = extractDocumentedCommands(readme);
	const variants = extractCommandVariants(mainRs);

	for (const cmd of documented) {
		const canonical = ALIAS_CANONICAL[cmd] ?? cmd;

		if (MULTI_VARIANT[canonical]) {
			const expected = MULTI_VARIANT[canonical];
			const found = expected.some((v) => variants.has(v));
			if (!found) {
				report.add(
					`"${cmd}" (documented) — expected at least one of Command::${expected.join(" | Command::")} in main.rs, found none`,
				);
			}
			continue;
		}

		const variant = toVariantName(canonical);
		if (!variants.has(variant)) {
			report.add(
				`"${cmd}" (documented) — expected Command::${variant} in main.rs, not found`,
			);
		}
	}

	report.finish(
		`cli-docs audit passed — ${documented.length} documented commands, all have Command::* handlers.`,
	);
}

runAudit("cli-docs", main);
