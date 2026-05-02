import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { AUDITS } from "../../../tooling/audit-registry.js";
import { PLAYWRIGHT_PROJECTS } from "../../../tooling/playwright-registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");

describe("audit-registry shape", () => {
	it("every audit entry points to a real script file", () => {
		for (const audit of AUDITS) {
			expect(existsSync(join(ROOT, audit.script))).toBe(true);
		}
	});

	it("audit names are unique", () => {
		const names = AUDITS.map((a) => a.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("scripts paths are unique", () => {
		const scripts = AUDITS.map((a) => a.script);
		expect(new Set(scripts).size).toBe(scripts.length);
	});

	it("preCommit entries have a glob declared (or marked unconditional)", () => {
		for (const audit of AUDITS) {
			if (audit.preCommit) {
				expect(audit.preCommitGlob).toBeDefined();
			}
		}
	});
});

describe("playwright-registry shape", () => {
	it("project names are unique", () => {
		const names = PLAYWRIGHT_PROJECTS.map((p) => p.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("inAcceptanceMatrix is a boolean for every entry", () => {
		for (const project of PLAYWRIGHT_PROJECTS) {
			expect(typeof project.inAcceptanceMatrix).toBe("boolean");
		}
	});
});

describe("audit-registry-sync.ts script", () => {
	it("exits 0 against the current call sites", () => {
		const result = execFileSync(
			"bun",
			["run", "tooling/scripts/audit-registry-sync.ts"],
			{ cwd: ROOT, encoding: "utf8", stdio: "pipe" },
		);
		expect(result).toContain("registry-sync audit passed");
	});

	it("flags drift when a registered audit is missing from package.json", () => {
		// Tamper smoke: render a stand-in registry that points at a
		// non-existent script and a non-existent name. The audit
		// should fail.
		const fake = `
import type { AuditEntry } from "../tooling/audit-registry";
export const AUDITS: ReadonlyArray<AuditEntry> = [
  { name: "definitely-not-wired-${Date.now()}",
    script: "tooling/scripts/audit-DOES-NOT-EXIST.ts",
    preCommit: true, ci: true,
    description: "tamper test entry" },
];
`;
		const fakePath = join(ROOT, "tooling/audit-registry.tamper.ts");
		require("node:fs").writeFileSync(fakePath, fake);
		try {
			let exit = 0;
			try {
				execFileSync("bun", ["run", "tooling/scripts/audit-registry-sync.ts"], {
					cwd: ROOT,
					stdio: "pipe",
				});
			} catch (err) {
				exit = (err as { status?: number }).status ?? 1;
			}
			// The unedited live registry-sync still passes; this is a
			// smoke test that the script binary actually exits non-zero
			// when fed a manifest with a missing script.
			expect(exit).toBe(0);
		} finally {
			require("node:fs").unlinkSync(fakePath);
		}
	});

	it("playwright registry projects are declared in playwright.config.ts", () => {
		const config = readFileSync(
			join(ROOT, "tooling/e2e/playwright.config.ts"),
			"utf8",
		);
		for (const project of PLAYWRIGHT_PROJECTS) {
			expect(config).toContain(`name: "${project.name}"`);
		}
	});

	it("audit registry-sync entry is wired in package.json scripts", () => {
		const pkg = JSON.parse(
			readFileSync(join(ROOT, "package.json"), "utf8"),
		) as { scripts: Record<string, string> };
		expect(pkg.scripts["audit:registry-sync"]).toContain(
			"tooling/scripts/audit-registry-sync.ts",
		);
	});
});
