// stryker-disable-file: data-only — pure data: tag/attribute allowlists for html-sanitization.ts

export const allowedTags = new Set([
	"a",
	"b",
	"blockquote",
	"br",
	"code",
	"div",
	"em",
	"figcaption",
	"figure",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"i",
	"img",
	"li",
	"ol",
	"p",
	"pre",
	"span",
	"strong",
	"sub",
	"sup",
	"table",
	"tbody",
	"td",
	"th",
	"thead",
	"tr",
	"u",
	"ul",
]);

export const allowedAttributes = new Map<string, Set<string>>([
	["*", new Set(["class"])],
	["a", new Set(["href", "name", "target", "rel"])],
	[
		"img",
		new Set([
			"src",
			"srcset",
			"sizes",
			"alt",
			"title",
			"width",
			"height",
			"loading",
			"decoding",
			"fetchpriority",
		]),
	],
	["th", new Set(["colspan", "rowspan", "scope"])],
	["td", new Set(["colspan", "rowspan"])],
]);

export const dropContentTags = new Set(["script", "style", "textarea", "option", "iframe"]);
export const urlAttributes = new Set(["href", "src"]);
export const srcsetAttributes = new Set(["srcset"]);
export const allowedSchemes = new Set(["http", "https", "mailto", "tel"]);
