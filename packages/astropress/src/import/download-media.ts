import { writeFile } from "node:fs/promises";
import sanitizeHtml from "sanitize-html";
import {
	ALLOWED_CONTENT_TYPES,
	MAX_MEDIA_BYTES,
	PRIVATE_HOST_RE,
	SVG_ALLOWED_ATTRS,
	SVG_ALLOWED_TAGS,
	TRANSCODABLE_TYPES,
} from "./download-media-data.js";
import { transcodeViaSharp } from "./sharp-transcode.js";

export function validateMediaSourceUrl(rawUrl: string): URL {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		throw new Error(`Invalid URL: ${rawUrl}`);
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error(`Blocked non-HTTP URL scheme: ${parsed.protocol}`);
	}
	if (PRIVATE_HOST_RE.test(parsed.hostname)) {
		throw new Error(`Blocked request to private/loopback host: ${parsed.hostname}`);
	}
	return parsed;
}

function sanitizeSvgBytes(bytes: Uint8Array): Uint8Array {
	const text = new TextDecoder().decode(bytes);
	const sanitized = sanitizeHtml(text, {
		allowedTags: SVG_ALLOWED_TAGS,
		allowedAttributes: { "*": SVG_ALLOWED_ATTRS },
		allowedSchemes: ["http", "https"],
		disallowedTagsMode: "discard",
	});
	return new TextEncoder().encode(sanitized);
}

async function transcodeImageBytes(bytes: Uint8Array, mimeType: string): Promise<Uint8Array> {
	if (mimeType === "image/svg+xml") {
		return sanitizeSvgBytes(bytes);
	}
	if (!TRANSCODABLE_TYPES.has(mimeType)) {
		return bytes;
	}
	const buf = await transcodeViaSharp(Buffer.from(bytes));
	return new Uint8Array(buf);
}

export async function downloadMedia(rawUrl: string): Promise<Uint8Array> {
	validateMediaSourceUrl(rawUrl);
	const response = await fetch(rawUrl);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const contentType = (response.headers.get("content-type") ?? "")
		.split(";")[0]
		.trim()
		.toLowerCase();
	if (!ALLOWED_CONTENT_TYPES.some((t) => contentType === t || contentType.startsWith("image/"))) {
		throw new Error(`Blocked: unexpected media content-type "${contentType}"`);
	}
	const contentLength = Number(response.headers.get("content-length") ?? 0);
	if (contentLength > MAX_MEDIA_BYTES) {
		throw new Error(`Blocked: content-length ${contentLength} exceeds ${MAX_MEDIA_BYTES} bytes`);
	}
	const bytes = new Uint8Array(await response.arrayBuffer());
	if (bytes.length > MAX_MEDIA_BYTES) {
		throw new Error(`Blocked: download size ${bytes.length} exceeds ${MAX_MEDIA_BYTES} bytes`);
	}
	return transcodeImageBytes(bytes, contentType);
}

export async function downloadMediaToFile(rawUrl: string, targetPath: string): Promise<void> {
	const bytes = await downloadMedia(rawUrl);
	await writeFile(targetPath, bytes); // lgtm[js/http-to-file-access]
}
