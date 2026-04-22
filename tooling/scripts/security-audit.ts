import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

type Violation = {
	file: string;
	message: string;
};

async function walk(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(fullPath)));
			continue;
		}

		if (entry.isFile()) {
			files.push(fullPath);
		}
	}

	return files;
}

async function existingFiles(paths: string[]) {
	const found: string[] = [];
	for (const path of paths) {
		try {
			const details = await stat(path);
			if (details.isFile()) {
				found.push(path);
			}
		} catch {}
	}
	return found;
}

async function main() {
	const root = process.cwd();
	const auditedFiles = await existingFiles([
		...(await walk(join(root, "packages/astropress/pages/ap-admin"))).filter(
			(path) => path.endsWith(".astro") || path.endsWith(".ts"),
		),
		...(await walk(join(root, "packages/astropress/components"))).filter(
			(path) => path.endsWith(".astro"),
		),
		join(root, "packages/astropress/src/admin-action-utils.ts"),
		join(root, "packages/astropress/src/security-headers.ts"),
	]);

	const violations: Violation[] = [];

	for (const file of auditedFiles) {
		const content = await readFile(file, "utf8");
		const display = relative(root, file);

		if (/<script\s+is:inline\b/i.test(content)) {
			violations.push({
				file: display,
				message: "inline script remains; this weakens CSP enforcement",
			});
		}

		if (/\son[a-z]+=/i.test(content)) {
			violations.push({
				file: display,
				message: "inline event handler attribute found",
			});
		}

		if (/contenteditable=/i.test(content)) {
			violations.push({
				file: display,
				message: "contenteditable usage found in audited admin/auth surface",
			});
		}

		if (/set:html=\{pageRecord\.body\}/.test(content)) {
			violations.push({
				file: display,
				message: "unsafe post body preview render path found",
			});
		}

		if (/\binnerHTML\s*=/.test(content)) {
			violations.push({
				file: display,
				message: "direct innerHTML assignment found",
			});
		}
	}

	// Auth pages (login, reset-password, accept-invite) are covered centrally by
	// src/security-middleware-entrypoint.ts and must NOT call the helper directly
	// (ZTA P4 invariant in zta-invariants.test.ts). AdminLayout stays an exception.
	const securityHeaderEntrypoints = [
		"packages/astropress/components/AdminLayout.astro",
		"packages/astropress/src/admin-action-utils.ts",
		"packages/astropress/src/security-middleware-entrypoint.ts",
		"packages/astropress/pages/ap-admin/session.ts",
	];

	for (const file of securityHeaderEntrypoints) {
		const content = await readFile(join(root, file), "utf8");
		if (
			!/applyAstropressSecurityHeaders|createAstropressSecureRedirect|createAstropressSecurityMiddleware/.test(
				content,
			)
		) {
			violations.push({
				file,
				message: "security headers helper not applied in required entrypoint",
			});
		}
	}

	if (violations.length > 0) {
		console.error("Security audit failed:");
		for (const violation of violations) {
			console.error(`- ${violation.file}: ${violation.message}`);
		}
		process.exit(1);
	}

	console.log(`Security audit passed for ${auditedFiles.length} source files.`);
}

await main();
