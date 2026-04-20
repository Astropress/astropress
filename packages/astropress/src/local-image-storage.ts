import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const workspaceRoot = process.cwd();
const defaultImageRoot = path.join(
	tmpdir(),
	"astropress",
	"local-images",
	path.basename(workspaceRoot),
);

export function getLocalImageRoot() {
	return (
		process.env.ASTROPRESS_LOCAL_IMAGE_ROOT?.trim() ||
		process.env.LOCAL_IMAGE_ROOT?.trim() ||
		defaultImageRoot
	);
}

export function getLocalUploadsDir() {
	return path.join(getLocalImageRoot(), "uploads");
}

export function ensureLocalUploadsDir() {
	mkdirSync(getLocalUploadsDir(), { recursive: true });
}

export function guessImageMimeType(pathname: string) {
	const lower = pathname.toLowerCase();
	if (lower.endsWith(".svg")) return "image/svg+xml";
	if (lower.endsWith(".png")) return "image/png";
	if (lower.endsWith(".webp")) return "image/webp";
	if (lower.endsWith(".gif")) return "image/gif";
	if (lower.endsWith(".avif")) return "image/avif";
	return "image/jpeg";
}

export function resolveLocalImageDiskPath(publicPath: string) {
	if (!publicPath.startsWith("/images/")) {
		throw new Error(`Expected image path under /images/: ${publicPath}`);
	}

	const relativePath = publicPath.slice("/images/".length);
	return path.join(getLocalImageRoot(), relativePath);
}

export function readLocalImageAsset(publicPath: string) {
	const diskPath = resolveLocalImageDiskPath(publicPath);
	if (!existsSync(diskPath)) {
		return { ok: false as const, error: "Image not found." };
	}

	const bytes = readFileSync(diskPath);
	const arrayBuffer = bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	);

	return {
		ok: true as const,
		asset: {
			diskPath,
			bytes: arrayBuffer,
			mimeType: guessImageMimeType(diskPath),
		},
	};
}

/**
 * Generate responsive srcset variants (400, 800, 1200px WebP) for an image using Sharp.
 *
 * The `storeVariant` callback handles persistence — it receives a filename and bytes and
 * returns the public URL string, or null when storage fails. This abstraction lets the
 * caller use local disk, R2, or any other backend without this function knowing the
 * difference.
 *
 * Uses `withoutEnlargement: true` so images narrower than a breakpoint skip that variant.
 * Returns null when Sharp is unavailable (e.g. Cloudflare Workers) or on error.
 */
export async function generateSrcset(
	bytes: Uint8Array,
	originalPublicPath: string,
	storeVariant: (
		filename: string,
		variantBytes: Uint8Array,
	) => Promise<string | null>,
): Promise<string | null> {
	try {
		const sharp = (await import("sharp")).default;
		const widths = [400, 800, 1200] as const;
		const parts: string[] = [];

		const basename = originalPublicPath
			.replace(/\.[^.]+$/, "") // lgtm[js/polynomial-redos] [^.]+$ is a negated class — cannot overlap with ., so no backtracking
			.replace(/^\/images\/uploads\//, "")
			.replace(/^\/images\//, "");

		for (const w of widths) {
			const variantBuffer = await sharp(Buffer.from(bytes))
				.resize({ width: w, withoutEnlargement: true })
				.webp()
				.toBuffer();
			const variantFilename = `${basename}-${w}w.webp`;
			const variantPath = await storeVariant(
				variantFilename,
				new Uint8Array(variantBuffer),
			);
			if (variantPath) {
				parts.push(`${variantPath} ${w}w`);
			}
		}

		return parts.length > 0 ? parts.join(", ") : null;
	} catch {
		return null;
	}
}
