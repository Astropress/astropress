/**
 * Backfill missing locale entries in admin-page-labels.ts (and similar
 * dictionaries shaped as `Record<string, Record<Locale, string>>`).
 *
 * The original auto-translate plan called for a Google/DeepL pipeline. In its
 * absence we copy the English value into the missing locale slot, marking it
 * with a `// TODO(i18n-<locale>):` comment so a native-speaker review pass
 * (tracked in issue #76) can replace each placeholder. This eliminates the
 * type-system gap and lets the audit:admin-i18n-leaks script enforce that
 * every label has every locale.
 *
 * Usage:
 *   bun run tooling/scripts/translate-locale.ts <file> <locale>
 *   bun run tooling/scripts/translate-locale.ts packages/astropress/src/admin-page-labels.ts ar
 */

import { readFile, writeFile } from "node:fs/promises";

async function main() {
	const [, , filePath, locale] = process.argv;
	if (!filePath || !locale) {
		console.error("Usage: bun run tooling/scripts/translate-locale.ts <file> <locale>");
		process.exit(1);
	}
	// `locale` is user-supplied — restrict to an allowlist of supported
	// admin locale codes so it never reaches a regex sink (CodeQL
	// js/regex-injection). The script is one-off tooling for the existing
	// dictionaries; the allowlist matches the SUPPORTED_LOCALES union
	// declared in packages/astropress/src/admin-locale.ts.
	const SUPPORTED: Record<string, true> = {
		en: true,
		es: true,
		fr: true,
		de: true,
		pt: true,
		ja: true,
		te: true,
		hi: true,
		ny: true,
		ar: true,
	};
	if (!Object.hasOwn(SUPPORTED, locale)) {
		console.error(
			`Invalid locale "${locale}" — must be one of: ${Object.keys(SUPPORTED).join(", ")}.`,
		);
		process.exit(1);
	}
	// `safeLocale` is now a known-static string from the allowlist above —
	// CodeQL recognises object-key lookup against a hardcoded record as a
	// taint sanitiser, breaking the user→regex chain entirely.
	const safeLocale: string = locale;
	const localePrefix = `${safeLocale}:`;
	const source = await readFile(filePath, "utf8");
	// Split into label blocks. Each block looks like:
	//   "<key>": {
	//     en: "...",
	//     es: "...",
	//     ...
	//   },
	// We match each block, check whether the target locale is present, and
	// if not, splice in `<locale>: <en value>,` directly after the `en:` line.
	const blockRe = /("[^"]+":\s*\{\n)([\s\S]*?)(\n\s*\},?\n)/g;
	let added = 0;
	const out = source.replace(blockRe, (full, head, body, tail) => {
		// Detect the locale via plain string scan so no regex is built
		// from the (now-allowlisted) locale value.
		const hasLocale = body
			.split("\n")
			.some((line: string) => line.trimStart().startsWith(localePrefix));
		if (hasLocale) return full;
		const enMatch = body.match(/^(\s*)en:\s*("(?:[^"\\]|\\.)*")\s*,?/m);
		if (!enMatch) return full;
		const indent = enMatch[1] ?? "\t\t";
		const enValue = enMatch[2];
		const insertion = `\n${indent}${safeLocale}: ${enValue}, // TODO(i18n-${safeLocale}): native-speaker review (issue #76)`;
		const newBody = body.replace(/^(\s*en:\s*"(?:[^"\\]|\\.)*"\s*,?)/m, `$1${insertion}`);
		added += 1;
		return `${head}${newBody}${tail}`;
	});
	if (added === 0) {
		console.log(`No missing ${locale} entries in ${filePath}.`);
		return;
	}
	await writeFile(filePath, out, "utf8");
	console.log(`Backfilled ${added} ${locale} entries in ${filePath}.`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
