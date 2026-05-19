import { existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { AuditReport, fromRoot, readText, runAudit } from "../lib/audit-utils.js";

// Audits markdown link targets in README.md, CONTRIBUTING.md, and docs/**/*.md.
//
// Catches the regression class: a doc PR renames or moves a referenced file
// (or restructures a heading) and the link rots silently. CI does not load
// the rendered pages, so without this check broken doc links surface only
// when a reader clicks one — often weeks after merge.
//
// Scope:
//   - relative file paths (./guide.md, ../adr/0001.md, subdir/page.md):
//     resolved against the linking file's dir; must exist on disk.
//   - in-page anchors (#heading-slug): must match a heading slug in the
//     same file.
//   - cross-file anchors (./guide.md#section): the file must exist AND
//     the slug must match a heading in that file.
//   - external links (http://, https://, mailto:) are NOT checked — those
//     belong to a separate network-aware audit (out of scope here, the
//     issue asked for dead-link catches in our own tree).

const ROOT_DOCS = [fromRoot("README.md"), fromRoot("CONTRIBUTING.md")];
const DOCS_DIR = fromRoot("docs");

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HEADING_RE = /^#{1,6}\s+(.+?)\s*$/gm;
const CODE_FENCE_RE = /```[\s\S]*?```|`[^`]*`/g;

interface ParsedLink {
	text: string;
	target: string;
	file: string;
}

function stripCodeBlocks(md: string): string {
	return md.replace(CODE_FENCE_RE, "");
}

function extractLinks(md: string, file: string): ParsedLink[] {
	const links: ParsedLink[] = [];
	const stripped = stripCodeBlocks(md);
	for (const m of stripped.matchAll(LINK_RE)) {
		links.push({ text: m[1], target: m[2], file });
	}
	return links;
}

// GitHub-flavoured heading slug rules (close enough for our docs):
//   - lowercase
//   - spaces → dashes
//   - strip everything that isn't [a-z0-9_-]
//   - collapse repeated dashes
function slugify(heading: string): string {
	return heading
		.toLowerCase()
		.replace(/`/g, "")
		.replace(/[^\w\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
}

function extractHeadingSlugs(md: string): Set<string> {
	const slugs = new Set<string>();
	for (const m of md.matchAll(HEADING_RE)) {
		slugs.add(slugify(m[1]));
	}
	return slugs;
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
	const out: string[] = [];
	let entries: string[];
	try {
		entries = await readdir(dir, { recursive: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		if (!entry.endsWith(".md")) continue;
		const full = join(dir, entry);
		if (!statSync(full).isFile()) continue;
		out.push(full);
	}
	return out;
}

function isExternal(target: string): boolean {
	if (target.startsWith("#")) return false; // in-page anchor, checked below
	if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) return true; // http:, mailto:, // etc.
	if (target.startsWith("/")) return true; // absolute paths = in-app routes, not docs
	if (target.includes("?")) return true; // query strings = not file targets (e.g. GH issue templates)
	// GitHub repo-relative routing URLs (../../issues/..., ../../pull/...).
	// These resolve client-side on github.com; not file paths in our tree.
	if (
		/(^|\/)\.\.\/\.\.\/(issues|pull|compare|releases|wiki|tree|blob|discussions)(\/|$)/.test(target)
	) {
		return true;
	}
	return false;
}

async function main(): Promise<void> {
	const report = new AuditReport("doc-links");

	const files = [...ROOT_DOCS, ...(await listMarkdownFiles(DOCS_DIR))].filter((f) => existsSync(f));

	const slugCache = new Map<string, Set<string>>();
	const getSlugs = async (path: string): Promise<Set<string>> => {
		const cached = slugCache.get(path);
		if (cached) return cached;
		const slugs = extractHeadingSlugs(await readText(path));
		slugCache.set(path, slugs);
		return slugs;
	};

	for (const file of files) {
		const md = await readText(file);
		const links = extractLinks(md, file);
		const relFile = relative(process.cwd(), file);

		for (const { text, target } of links) {
			if (isExternal(target)) continue;

			// In-page anchor
			if (target.startsWith("#")) {
				const slug = target.slice(1).toLowerCase();
				const slugs = await getSlugs(file);
				if (!slugs.has(slug)) {
					report.add(`${relFile} → "${text}" → anchor #${slug} not found in same file`);
				}
				continue;
			}

			const [pathPart, anchor] = target.split("#", 2);
			const resolved = resolve(dirname(file), pathPart);

			if (!existsSync(resolved)) {
				report.add(`${relFile} → "${text}" → target not found: ${pathPart}`);
				continue;
			}

			if (anchor) {
				try {
					if (!statSync(resolved).isFile()) continue;
				} catch {
					continue;
				}
				if (!resolved.endsWith(".md")) continue;
				const slugs = await getSlugs(resolved);
				if (!slugs.has(anchor.toLowerCase())) {
					report.add(
						`${relFile} → "${text}" → anchor #${anchor} not found in ${relative(process.cwd(), resolved)}`,
					);
				}
			}
		}
	}

	report.finish(`doc-links audit passed — checked ${files.length} markdown files.`);
}

runAudit("doc-links", main);
