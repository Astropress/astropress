import {
	WP_DEFAULT_MIME,
	WP_MIME_BY_EXTENSION,
	WP_STATUS_INPUT,
	XML_ENTITY_LOOKUP,
} from "./wordpress-xml-tags-data";

export { XML_ENTITY_LOOKUP };

export function countMatches(source: string, pattern: RegExp) {
	const matches = source.match(pattern);
	return matches ? matches.length : 0;
}

export function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripCdata(value: string) {
	return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

export function decodeXml(value: string) {
	return stripCdata(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
		if (code[0] === "#") {
			const numeric =
				code[1]?.toLowerCase() === "x"
					? Number.parseInt(code.slice(2), 16)
					: Number.parseInt(code.slice(1), 10);
			return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity;
		}
		return XML_ENTITY_LOOKUP[code.toLowerCase()] ?? entity;
	});
}

export function getTagText(block: string, tagName: string) {
	const match = block.match(
		new RegExp(
			`<${escapeRegExp(tagName)}(?:\\b[^>]*)?>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`,
			"i",
		),
	);
	return match ? decodeXml(match[1].trim()) : "";
}

export function getBlocks(block: string, tagName: string) {
	return [
		...block.matchAll(
			new RegExp(
				`<${escapeRegExp(tagName)}(?:\\b[^>]*)?>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`,
				"gi",
			),
		),
	].map((match) => match[1]);
}

export function parseCategoryBlocks(block: string) {
	return [...block.matchAll(/<category\b([^>]*)>([\s\S]*?)<\/category>/gi)].map((match) => ({
		attributes: match[1],
		value: decodeXml(match[2].trim()),
	}));
}

export function getAttributeValue(attributes: string, attributeName: string) {
	const match = attributes.match(new RegExp(`${escapeRegExp(attributeName)}="([^"]*)"`, "i"));
	return match ? decodeXml(match[1].trim()) : "";
}

export function normalizeSlug(value: string, fallback: string) {
	const sanitized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9/_-]+/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^[-/]+|[-/]+$/g, "");
	return sanitized || fallback;
}

export function normalizePathname(value: string, fallbackSlug: string) {
	if (!value) return `/${fallbackSlug}/`;
	try {
		const url = new URL(value, "https://wordpress.invalid");
		const pathname = url.pathname.replace(/\/{2,}/g, "/");
		return pathname.endsWith("/") ? pathname : `${pathname}/`;
	} catch {
		return `/${fallbackSlug}/`;
	}
}

export function normalizeContentStatus(value: string): "draft" | "published" | "archived" {
	switch (value.trim().toLowerCase()) {
		case WP_STATUS_INPUT.PUBLISH:
			return "published";
		case WP_STATUS_INPUT.DRAFT:
		case WP_STATUS_INPUT.PENDING:
		case WP_STATUS_INPUT.FUTURE:
			return "draft";
		default:
			return "archived";
	}
}

export function inferMimeType(filename: string) {
	const extension = filename.toLowerCase().split(".").pop() ?? "";
	return WP_MIME_BY_EXTENSION[extension] ?? WP_DEFAULT_MIME;
}

export function filenameFromUrl(sourceUrl: string, fallback: string) {
	try {
		const url = new URL(sourceUrl);
		const candidate = url.pathname.split("/").pop() ?? "";
		return candidate || fallback;
	} catch {
		return fallback;
	}
}

export function safeArtifactFilename(filename: string, fallback: string) {
	const sanitized = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-{2,}/g, "-");
	return sanitized || fallback;
}
