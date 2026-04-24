import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export const ROOT = process.cwd();

export async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export async function readText(path: string, fallback = ""): Promise<string> {
	try {
		return await readFile(path, "utf8");
	} catch {
		return fallback;
	}
}

export async function fileContains(
	path: string,
	pattern: string | RegExp,
): Promise<boolean> {
	const src = await readText(path);
	if (!src) return false;
	return typeof pattern === "string" ? src.includes(pattern) : pattern.test(src);
}

export interface ListFilesOptions {
	recursive?: boolean;
	extensions?: readonly string[];
	exclude?: readonly string[];
}

export async function listFiles(
	dir: string,
	opts: ListFilesOptions = {},
): Promise<string[]> {
	let entries: string[];
	try {
		entries = await readdir(dir, { recursive: opts.recursive ?? false });
	} catch {
		return [];
	}
	const { extensions, exclude } = opts;
	return entries.filter((entry) => {
		if (extensions && !extensions.some((ext) => entry.endsWith(ext))) return false;
		if (exclude?.includes(entry)) return false;
		return true;
	});
}

export class AuditReport {
	private readonly violations: string[] = [];

	constructor(private readonly name: string) {}

	add(message: string): void {
		this.violations.push(message);
	}

	get failed(): boolean {
		return this.violations.length > 0;
	}

	get count(): number {
		return this.violations.length;
	}

	/**
	 * Prints violations (or success message) and exits with the appropriate code.
	 * Never returns.
	 */
	finish(successMessage: string): never {
		if (this.violations.length > 0) {
			console.error(`${this.name} audit failed — ${this.violations.length} issue(s):\n`);
			for (const v of this.violations) console.error(`  - ${v}`);
			process.exit(1);
		}
		console.log(successMessage);
		process.exit(0);
	}
}

/**
 * Wraps a main() function with uniform crash handling that matches the
 * established audit-script exit behavior (stderr prefix + exit 1).
 */
export function runAudit(name: string, main: () => Promise<void>): void {
	main().catch((err) => {
		console.error(`${name} audit failed:`, err);
		process.exit(1);
	});
}

/** Absolute path under the repo root. */
export function fromRoot(...segments: string[]): string {
	return join(ROOT, ...segments);
}
