import { writeFile } from "node:fs/promises";
import sanitizeHtml from "sanitize-html";
import { transcodeViaSharp } from "./sharp-transcode.js";

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

// Raster image types that sharp can decode and re-encode at pixel level.
const TRANSCODABLE_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/avif",
	"image/bmp",
	"image/tiff",
]);

// Safe SVG elements — explicitly excludes script, foreignObject, iframe, object, embed.
const SVG_ALLOWED_TAGS = [
	"svg",
	"g",
	"defs",
	"symbol",
	"use",
	"switch",
	"path",
	"circle",
	"rect",
	"line",
	"polyline",
	"polygon",
	"ellipse",
	"text",
	"tspan",
	"textPath",
	"linearGradient",
	"radialGradient",
	"stop",
	"pattern",
	"clipPath",
	"mask",
	"marker",
	"image",
	"a",
	"title",
	"desc",
	"metadata",
	"animate",
	"animateTransform",
	"animateMotion",
	"set",
	"filter",
	"feBlend",
	"feColorMatrix",
	"feFlood",
	"feGaussianBlur",
	"feComposite",
	"feMerge",
	"feMergeNode",
	"feOffset",
	"feTurbulence",
	"feDisplacementMap",
	"feDiffuseLighting",
	"feSpecularLighting",
	"fePointLight",
	"feSpotLight",
	"feDistantLight",
	"feFuncA",
	"feFuncR",
	"feFuncG",
	"feFuncB",
	"feComponentTransfer",
	"feMorphology",
	"feConvolveMatrix",
	"feImage",
	"feTile",
];

// Safe SVG attributes — no on* event handlers, no srcdoc.
// sanitize-html blocks javascript:/data: in href/src by default (allowedSchemes).
const SVG_ALLOWED_ATTRS = [
	// Core
	"id",
	"class",
	"style",
	"lang",
	"tabindex",
	// Presentation
	"fill",
	"fill-opacity",
	"fill-rule",
	"stroke",
	"stroke-dasharray",
	"stroke-dashoffset",
	"stroke-linecap",
	"stroke-linejoin",
	"stroke-miterlimit",
	"stroke-opacity",
	"stroke-width",
	"opacity",
	"visibility",
	"display",
	"overflow",
	"clip-rule",
	"clip-path",
	"mask",
	"filter",
	"color",
	"color-interpolation",
	"color-interpolation-filters",
	"color-rendering",
	"image-rendering",
	"shape-rendering",
	"text-rendering",
	"vector-effect",
	"paint-order",
	// Geometry
	"d",
	"cx",
	"cy",
	"r",
	"rx",
	"ry",
	"x",
	"y",
	"x1",
	"y1",
	"x2",
	"y2",
	"width",
	"height",
	"points",
	"pathLength",
	// Transform
	"transform",
	"transform-origin",
	// SVG structural
	"viewBox",
	"xmlns",
	"version",
	"preserveAspectRatio",
	"baseProfile",
	"contentScriptType",
	"contentStyleType",
	// Links (schemes restricted to http/https by allowedSchemes)
	"href",
	"xlink:href",
	"xlink:title",
	"xlink:type",
	// Referencing
	"clip-path",
	"mask",
	"marker",
	"marker-start",
	"marker-mid",
	"marker-end",
	"markerWidth",
	"markerHeight",
	"markerUnits",
	"orient",
	"refX",
	"refY",
	// Gradient / pattern
	"gradientUnits",
	"gradientTransform",
	"spreadMethod",
	"patternUnits",
	"patternTransform",
	"patternContentUnits",
	"offset",
	"stop-color",
	"stop-opacity",
	// Text
	"text-anchor",
	"dominant-baseline",
	"baseline-shift",
	"font-size",
	"font-family",
	"font-weight",
	"font-style",
	"font-variant",
	"font-stretch",
	"letter-spacing",
	"word-spacing",
	"text-decoration",
	"writing-mode",
	"glyph-orientation-horizontal",
	"glyph-orientation-vertical",
	"dy",
	"dx",
	"rotate",
	"lengthAdjust",
	"textLength",
	"startOffset",
	"method",
	"spacing",
	// Clip / mask
	"clipPathUnits",
	"maskUnits",
	"maskContentUnits",
	// Filter
	"in",
	"in2",
	"result",
	"type",
	"values",
	"mode",
	"operator",
	"stdDeviation",
	"k1",
	"k2",
	"k3",
	"k4",
	"order",
	"kernelMatrix",
	"bias",
	"divisor",
	"edgeMode",
	"kernelUnitLength",
	"preserveAlpha",
	"radius",
	"baseFrequency",
	"numOctaves",
	"seed",
	"stitchTiles",
	"xChannelSelector",
	"yChannelSelector",
	"scale",
	"amplitude",
	"exponent",
	"intercept",
	"slope",
	"tableValues",
	"azimuth",
	"elevation",
	"pointsAtX",
	"pointsAtY",
	"pointsAtZ",
	"specularExponent",
	"specularConstant",
	"limitingConeAngle",
	"diffuseConstant",
	"surfaceScale",
	"primitiveUnits",
	"x",
	"y",
	"width",
	"height",
	// Animation
	"attributeName",
	"attributeType",
	"from",
	"to",
	"by",
	"dur",
	"begin",
	"end",
	"repeatCount",
	"repeatDur",
	"calcMode",
	"keyTimes",
	"keySplines",
	"keyPoints",
	"path",
	"additive",
	"accumulate",
	"restart",
	"fill",
	"min",
	"max",
	"syncBase",
	"syncOffset",
	"syncTolerance",
	"syncMaster",
	"currentSyncPoint",
	"type",
	// Symbol / use
	"symbol",
	"use",
	"href",
];

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

async function transcodeImageBytes(
	bytes: Uint8Array,
	mimeType: string,
): Promise<Uint8Array> {
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
	await writeFile(targetPath, bytes); // lgtm[js/http-to-file-access]
}
