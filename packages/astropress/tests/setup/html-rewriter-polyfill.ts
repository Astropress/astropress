/**
 * HTMLRewriter polyfill for Vitest (Node.js-compatible test environment).
 *
 * Bun exposes HTMLRewriter as a global in its runtime. Vitest runs in a
 * Node.js-compatible pool that does not have Bun's globals. This setup file
 * installs a minimal polyfill so html-sanitization tests can run under Vitest.
 *
 * Production code uses the native Bun global — no runtime dependency needed.
 * htmlparser2 is a devDependency used only here.
 */
import { parseDocument } from "htmlparser2";

type ElementHandlerCallback = {
  element?: (el: PolyfillElement) => void;
  text?: (chunk: { text: string }) => void;
};

class PolyfillElement {
  tagName: string;
  private _attribs: Map<string, string>;
  _removed = false;
  _keepContent = false;

  constructor(tagName: string, attribs: Record<string, string>) {
    this.tagName = tagName.toLowerCase();
    this._attribs = new Map(Object.entries(attribs));
  }

  get attributes(): Iterable<[string, string]> {
    return this._attribs.entries();
  }

  remove() {
    this._removed = true;
    this._keepContent = false;
  }

  removeAndKeepContent() {
    this._removed = true;
    this._keepContent = true;
  }

  removeAttribute(name: string) {
    this._attribs.delete(name);
  }

  setAttribute(name: string, value: string) {
    this._attribs.set(name, value);
  }

  serializeOpenTag(): string {
    const attrs = [...this._attribs.entries()]
      .map(([k, v]) => ` ${k}="${v.replaceAll('"', "&quot;")}"`)
      .join("");
    return `<${this.tagName}${attrs}>`;
  }
}

const voidTagSet = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr"]);

function escapeText(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function walkNode(
  node: Record<string, unknown>,
  handlers: ElementHandlerCallback[],
): string {
  const type = node.type as string | undefined;

  if (type === "text") {
    const text = (node.data as string) ?? "";
    if (handlers.some((h) => h.text)) {
      // text handlers are informational in our sanitizer; we don't use them
    }
    return escapeText(text);
  }

  if (type === "comment" || type === "directive" || type === "cdata") {
    return "";
  }

  const children = (Array.isArray(node.children)
    ? (node.children as Array<Record<string, unknown>>)
    : []);

  if (!node.name) {
    // Root / document node
    return children.map((c) => walkNode(c, handlers)).join("");
  }

  const attribs = (node.attribs && typeof node.attribs === "object"
    ? (node.attribs as Record<string, string>)
    : {});

  const el = new PolyfillElement(node.name as string, attribs);

  for (const handler of handlers) {
    handler.element?.(el);
  }

  if (el._removed && !el._keepContent) {
    return "";
  }

  const innerHtml = children.map((c) => walkNode(c, handlers)).join("");

  if (el._removed && el._keepContent) {
    return innerHtml;
  }

  const tag = el.tagName;
  if (voidTagSet.has(tag)) {
    return el.serializeOpenTag();
  }

  return `${el.serializeOpenTag()}${innerHtml}</${tag}>`;
}

class PolyfillHTMLRewriter {
  private _handlers: ElementHandlerCallback[] = [];

  on(_selector: string, handler: ElementHandlerCallback): this {
    this._handlers.push(handler);
    return this;
  }

  transform(response: Response): { text(): Promise<string> } {
    const handlers = this._handlers;
    return {
      text: async () => {
        const html = await response.text();
        const doc = parseDocument(html, {
          decodeEntities: false,
          lowerCaseTags: true,
          lowerCaseAttributeNames: true,
        });
        return walkNode(doc as unknown as Record<string, unknown>, handlers);
      },
    };
  }
}

// Install the polyfill only when HTMLRewriter isn't already available (i.e. not in Bun)
if (typeof globalThis.HTMLRewriter === "undefined") {
  (globalThis as unknown as Record<string, unknown>).HTMLRewriter = PolyfillHTMLRewriter;
}
