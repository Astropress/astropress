import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const ALLOWED_CONTENT_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/avif",
	"image/svg+xml",
	"image/bmp",
	"image/tiff",
	"video/mp4",
	"video/webm",
	"audio/mpeg",
	"audio/ogg",
	"audio/wav",
	"application/pdf",
];

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

const PRIVATE_HOST_RE =
	/^(localhost|127\.\d+\.\d+\.\d+|::1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|fd[0-9a-f]{2}:|fc[0-9a-f]{2}:)/i;

// Image types sharp can decode and re-encode at pixel level.
// Re-encoding validates format integrity, strips metadata, and defeats polyglot files.
// Non-image types (SVG, PDF, video, audio) pass through untransformed.
const TRANSCODABLE_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/avif",
	"image/bmp",
	"image/tiff",
]);

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
		throw new Error(
			`Blocked request to private/loopback host: ${parsed.hostname}`,
		);
	}
	return parsed;
}

async function transcodeImageBytes(
	bytes: Uint8Array,
	mimeType: string,
): Promise<Uint8Array> {
	if (!TRANSCODABLE_TYPES.has(mimeType)) {
		return bytes;
	}
	const buf = await sharp(Buffer.from(bytes)).toBuffer();
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
	if (
		!ALLOWED_CONTENT_TYPES.some(
			(t) => contentType === t || contentType.startsWith("image/"),
		)
	) {
		throw new Error(`Blocked: unexpected media content-type "${contentType}"`);
	}
	const contentLength = Number(response.headers.get("content-length") ?? 0);
	if (contentLength > MAX_MEDIA_BYTES) {
		throw new Error(
			`Blocked: content-length ${contentLength} exceeds ${MAX_MEDIA_BYTES} bytes`,
		);
	}
	const bytes = new Uint8Array(await response.arrayBuffer());
	if (bytes.length > MAX_MEDIA_BYTES) {
		throw new Error(
			`Blocked: download size ${bytes.length} exceeds ${MAX_MEDIA_BYTES} bytes`,
		);
	}
	return transcodeImageBytes(bytes, contentType);
}

export async function downloadMediaToFile(
	rawUrl: string,
	targetPath: string,
): Promise<void> {
	const bytes = await downloadMedia(rawUrl);
	await writeFile(targetPath, bytes);
}
