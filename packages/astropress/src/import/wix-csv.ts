// RFC 4180 CSV parser with quoted field support
export function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let i = 0;
	while (i < line.length) {
		if (line[i] === '"') {
			let value = "";
			i++;
			while (i < line.length) {
				if (line[i] === '"' && line[i + 1] === '"') {
					value += '"';
					i += 2;
				} else if (line[i] === '"') {
					i++;
					break;
				} else {
					value += line[i++];
				}
			}
			fields.push(value);
			if (line[i] === ",") i++;
		} else {
			const end = line.indexOf(",", i);
			if (end === -1) {
				fields.push(line.slice(i));
				break;
			}
			fields.push(line.slice(i, end));
			i = end + 1;
		}
	}
	return fields;
}

export function splitCsvRows(text: string): string[][] {
	const rows: string[][] = [];
	let current = "";
	let inQuotes = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i] as string;
		if (ch === '"') {
			inQuotes = !inQuotes;
			current += ch;
		} else if (
			!inQuotes &&
			(ch === "\n" || (ch === "\r" && text[i + 1] === "\n"))
		) {
			if (ch === "\r") i++;
			if (current.trim()) rows.push(parseCsvLine(current));
			current = "";
		} else {
			current += ch;
		}
	}
	if (current.trim()) rows.push(parseCsvLine(current));
	return rows;
}

export function slugify(text: string): string {
	return (
		text
			.toLowerCase()
			.replace(/[^\w\s-]/g, "")
			.replace(/[\s_]+/g, "-")
			// codeql[js/polynomial-redos] anchored /^-+/ and /-+$/ are linear — anchors prevent overlap
			.replace(/^-+|-+$/g, "") || "unknown"
	);
}

export function lastPathSegment(url: string): string {
	try {
		const parsed = new URL(url);
		const segments = parsed.pathname.split("/").filter(Boolean);
		return segments[segments.length - 1] ?? slugify(url);
	} catch {
		const parts = url.split("/").filter(Boolean);
		return parts[parts.length - 1] ?? slugify(url);
	}
}

export function normalizeWixImageUrl(url: string): string {
	if (!url) return url;
	const base = url.includes("?") ? url.slice(0, url.indexOf("?")) : url;
	const v1Idx = base.indexOf("/v1/");
	return v1Idx >= 0 ? base.slice(0, v1Idx) : base;
}

export function scrapeImageUrls(html: string): string[] {
	const urls: string[] = [];
	const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
	let match = imgRegex.exec(html);
	while (match !== null) {
		if (match[1]) urls.push(match[1]);
		match = imgRegex.exec(html);
	}
	return urls;
}

export function cleanWixHtml(html: string): string {
	let cleaned = html.replace(
		/(<(?:p|div|figure|section|article|h[1-6]|blockquote|li|ul|ol)[^>]*)\sstyle="[^"]*"/gi,
		"$1",
	);
	cleaned = cleaned.replace(/\sdata-[a-z][a-z0-9-]*="[^"]*"/gi, "");
	cleaned = cleaned.replace(
		/(src=["'])(https?:\/\/(?:static\.)?wixstatic\.com\/[^"']+)(["'])/gi,
		(_, pre, url, post) => pre + normalizeWixImageUrl(url) + post,
	);
	return cleaned;
}

export function guessExtension(url: string): string {
	const name = lastPathSegment(url);
	const dotIdx = name.lastIndexOf(".");
	return dotIdx >= 0 ? name.slice(dotIdx) : ".jpg";
}

export function guessMimeTypeWix(url: string): string {
	const ext = guessExtension(url).toLowerCase();
	const map: Record<string, string> = {
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".png": "image/png",
		".gif": "image/gif",
		".webp": "image/webp",
		".svg": "image/svg+xml",
		".mp4": "video/mp4",
		".pdf": "application/pdf",
	};
	return map[ext] ?? "application/octet-stream";
}

export function splitTermList(value: string): string[] {
	return value
		.split(/[;,]/)
		.map((s) => s.trim())
		.filter(Boolean);
}
