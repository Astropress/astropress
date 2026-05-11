import {
	allowedAttributes,
	allowedSchemes,
	allowedTags,
	dropContentTags,
	srcsetAttributes,
	urlAttributes,
} from "./html-sanitization-data.js";

function isAllowedUrl(value: string) {
	const trimmed = value.trim();
	if (!trimmed || trimmed.startsWith("//")) {
		return false;
	}

	const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
	if (!schemeMatch) {
		return true;
	}

	return allowedSchemes.has(schemeMatch[1].toLowerCase());
}

function sanitizeSrcset(value: string) {
	const candidates = value
		.split(",")
		.map((candidate) => candidate.trim())
		.filter(Boolean)
		.filter((candidate) => {
			const [url] = candidate.split(/\s+/, 1);
			return Boolean(url) && isAllowedUrl(url);
		});

	return candidates.length > 0 ? candidates.join(", ") : null;
}

function sanitizeAttribute(tagName: string, attributeName: string, attributeValue: string) {
	const allowedForTag = allowedAttributes.get(tagName);
	const allowedGlobally = allowedAttributes.get("*");
	const isAllowed = allowedForTag?.has(attributeName) || allowedGlobally?.has(attributeName);

	if (!isAllowed) {
		return null;
	}

	const trimmedValue = attributeValue.trim();
	if (!trimmedValue && attributeName !== "class") {
		return null;
	}

	if (urlAttributes.has(attributeName)) {
		return isAllowedUrl(trimmedValue) ? trimmedValue : null;
	}

	if (srcsetAttributes.has(attributeName)) {
		return sanitizeSrcset(trimmedValue);
	}

	return trimmedValue;
}

export async function sanitizeHtml(html: string): Promise<string> {
	if (typeof globalThis.HTMLRewriter === "undefined") {
		return sanitizeHtmlLibrary(html, {
			allowedTags: [...allowedTags],
			allowedAttributes: Object.fromEntries(
				[...allowedAttributes.entries()].map(([tagName, attributes]) => [tagName, [...attributes]]),
			),
			allowedSchemes: [...allowedSchemes],
			allowProtocolRelative: false,
			nonBooleanAttributes: ["class"],
			transformTags: {
				a: (tagName, attribs) => ({
					tagName,
					attribs: {
						...attribs,
						rel: "noopener noreferrer",
					},
				}),
			},
		});
	}

	const rewriter = new HTMLRewriter().on("*", {
		element(el) {
			const tag = el.tagName.toLowerCase();

			if (dropContentTags.has(tag)) {
				el.remove();
				return;
			}

			if (!allowedTags.has(tag)) {
				el.removeAndKeepContent();
				return;
			}

			for (const [name, value] of el.attributes) {
				const sanitized = sanitizeAttribute(tag, name, value);
				if (sanitized === null) {
					el.removeAttribute(name);
				} else if (sanitized !== value) {
					el.setAttribute(name, sanitized);
				}
			}

			if (tag === "a") {
				el.setAttribute("rel", "noopener noreferrer");
			}
		},
	});

	return rewriter.transform(new Response(html)).text();
}

import sanitizeHtmlLibrary from "sanitize-html";
