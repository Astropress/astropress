import { parseDocument } from "htmlparser2";

const allowedTags = new Set([
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

const allowedAttributes = new Map<string, Set<string>>([
  ["*", new Set(["class"])],
  ["a", new Set(["href", "name", "target", "rel"])],
  ["img", new Set(["src", "srcset", "sizes", "alt", "title", "width", "height", "loading", "decoding", "fetchpriority"])],
  ["th", new Set(["colspan", "rowspan", "scope"])],
  ["td", new Set(["colspan", "rowspan"])],
]);

const dropContentTags = new Set(["script", "style", "textarea", "option", "iframe"]);
const voidTags = new Set(["br", "hr", "img"]);
const urlAttributes = new Set(["href", "src"]);
const srcsetAttributes = new Set(["srcset"]);
const allowedSchemes = new Set(["http", "https", "mailto", "tel"]);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

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
  const isAllowed =
    allowedForTag?.has(attributeName) ||
    allowedGlobally?.has(attributeName);

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

function serializeAttributes(tagName: string, attribs: Record<string, string | undefined>) {
  const renderedAttributes = new Map<string, string>();

  for (const [attributeName, attributeValue] of Object.entries(attribs)) {
    if (typeof attributeValue !== "string") {
      continue;
    }

    const sanitizedValue = sanitizeAttribute(tagName, attributeName, attributeValue);
    if (sanitizedValue) {
      renderedAttributes.set(attributeName, sanitizedValue);
    }
  }

  if (tagName === "a") {
    renderedAttributes.set("rel", "noopener noreferrer");
  }

  return [...renderedAttributes.entries()]
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join("");
}

function sanitizeChildren(children: Array<Record<string, unknown>> | undefined) {
  return (children ?? []).map((child) => sanitizeNode(child)).join("");
}

function sanitizeNode(node: Record<string, unknown>): string {
  const nodeType = typeof node.type === "string" ? node.type : "";

  if (nodeType === "text") {
    return escapeHtml(typeof node.data === "string" ? node.data : "");
  }

  if (nodeType === "comment" || nodeType === "directive" || nodeType === "cdata") {
    return "";
  }

  const tagName = typeof node.name === "string" ? node.name : "";
  const children = Array.isArray(node.children) ? (node.children as Array<Record<string, unknown>>) : [];

  if (!tagName) {
    return sanitizeChildren(children);
  }

  if (!allowedTags.has(tagName)) {
    if (dropContentTags.has(tagName)) {
      return "";
    }

    return sanitizeChildren(children);
  }

  const attribs =
    node.attribs && typeof node.attribs === "object"
      ? (node.attribs as Record<string, string | undefined>)
      : {};
  const serializedAttributes = serializeAttributes(tagName, attribs);

  if (voidTags.has(tagName)) {
    return `<${tagName}${serializedAttributes}>`;
  }

  return `<${tagName}${serializedAttributes}>${sanitizeChildren(children)}</${tagName}>`;
}

export function sanitizeHtml(html: string): string {
  const document = parseDocument(html, {
    decodeEntities: false,
    lowerCaseTags: true,
    lowerCaseAttributeNames: true,
  });

  return sanitizeChildren(document.children as unknown as Array<Record<string, unknown>>);
}
