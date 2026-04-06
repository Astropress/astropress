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
const urlAttributes = new Set(["href", "src"]);
const srcsetAttributes = new Set(["srcset"]);
const allowedSchemes = new Set(["http", "https", "mailto", "tel"]);

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

export async function sanitizeHtml(html: string): Promise<string> {
  const rewriter = new HTMLRewriter()
    .on("*", {
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
