import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

function listFiles(root: string, files: string[] = []) {
	for (const entry of readdirSync(root)) {
		const fullPath = path.join(root, entry);
		const stats = statSync(fullPath);
		if (stats.isDirectory()) {
			listFiles(fullPath, files);
			continue;
		}
		files.push(fullPath);
	}
	return files.sort();
}

function listHtmlFiles(root: string) {
	return listFiles(root).filter((file) => file.endsWith(".html"));
}

function resolveInternalTarget(root: string, href: string, sourceFile: string) {
	const [pathPart, fragment = ""] = href.split("#");
	if (!pathPart || pathPart === "/") {
		return {
			filePath: path.join(root, "index.html"),
			fragment,
		};
	}

	const relativeTarget = pathPart.startsWith("/")
		? pathPart.slice(1)
		: path.normalize(
				path.join(path.relative(root, path.dirname(sourceFile)), pathPart),
			);
	const normalized = relativeTarget.replace(/\\/g, "/").replace(/^\.\/+/, "");
	const directFile = path.join(root, normalized);
	const indexFile = path.join(root, normalized, "index.html");

	if (normalized.endsWith(".html")) {
		return { filePath: directFile, fragment };
	}

	return { filePath: indexFile, fragment };
}

const targetRoot = process.argv[2];
if (!targetRoot) {
	throw new Error(
		"Usage: bun run tooling/scripts/static-site-audit.ts <built-static-directory>",
	);
}

const resolvedRoot = path.resolve(targetRoot);
const files = listFiles(resolvedRoot);
if (files.length === 0) {
	throw new Error(`No files found under ${resolvedRoot}.`);
}

const htmlFiles = listHtmlFiles(resolvedRoot);
if (htmlFiles.length === 0) {
	throw new Error(`No HTML files found under ${resolvedRoot}.`);
}

const failures: string[] = [];
const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
const jsFiles = files.filter((file) => file.endsWith(".js"));
const cssFiles = files.filter((file) => file.endsWith(".css"));
const cssBytes = cssFiles.reduce((sum, file) => sum + statSync(file).size, 0);

for (const htmlFile of htmlFiles) {
	const html = readFileSync(htmlFile, "utf8");
	const dom = new JSDOM(html);
	const relativeSource = path.relative(resolvedRoot, htmlFile) || "index.html";

	for (const anchor of [...dom.window.document.querySelectorAll("a[href]")]) {
		const href = anchor.getAttribute("href");
		if (
			!href ||
			href.startsWith("http://") ||
			href.startsWith("https://") ||
			href.startsWith("mailto:") ||
			href.startsWith("tel:")
		) {
			continue;
		}

		if (href.startsWith("#")) {
			const fragmentTarget = href.slice(1);
			if (
				fragmentTarget &&
				!dom.window.document.getElementById(fragmentTarget)
			) {
				failures.push(
					`${relativeSource}: missing fragment target #${fragmentTarget}`,
				);
			}
			continue;
		}

		const { filePath, fragment } = resolveInternalTarget(
			resolvedRoot,
			href,
			htmlFile,
		);
		try {
			const targetHtml = readFileSync(filePath, "utf8");
			if (fragment) {
				const targetDom = new JSDOM(targetHtml);
				if (!targetDom.window.document.getElementById(fragment)) {
					failures.push(
						`${relativeSource}: ${href} points to missing fragment #${fragment}`,
					);
				}
			}
		} catch {
			failures.push(`${relativeSource}: broken internal link ${href}`);
		}
	}
}

if (totalBytes > 80 * 1024) {
	failures.push(
		`Static site budget exceeded: ${totalBytes} bytes > 81920 bytes.`,
	);
}

if (cssBytes > 16 * 1024) {
	failures.push(`CSS budget exceeded: ${cssBytes} bytes > 16384 bytes.`);
}

if (jsFiles.length > 0) {
	failures.push(
		`Unexpected public JavaScript emitted: ${jsFiles.map((file) => path.relative(resolvedRoot, file)).join(", ")}`,
	);
}

if (failures.length > 0) {
	console.error("Static site audit failed:");
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log(
	`Static site audit passed for ${htmlFiles.length} HTML files. Total size ${totalBytes} bytes, CSS ${cssBytes} bytes, JS files ${jsFiles.length}.`,
);
