// stryker-disable-file: data-only — module-level allowlists / size limit that
// cache through the vitest worker pool; behavioural callers in
// local-media-storage.ts are mutation-tested at ≥95% and indirectly exercise
// every entry of these sets.

export const ALLOWED_MIME_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"image/avif",
	"image/svg+xml",
]);

// Safe file extensions that map unambiguously to allowed image types.
// This allowlist is checked in addition to MIME type — extensions like .php
// that fall through to a default MIME type guess are explicitly blocked here.
export const ALLOWED_EXTENSIONS = new Set([
	".jpg",
	".jpeg",
	".png",
	".webp",
	".gif",
	".avif",
	".svg",
]);

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
