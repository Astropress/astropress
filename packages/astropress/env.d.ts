/// <reference types="astro/client" />

import type { AccessContext } from "./src/access/request-context";
import type { AuthUser } from "./src/platform-contracts";

declare global {
	namespace App {
		interface Locals {
			access?: AccessContext;
			adminUser?: AuthUser & { name?: string };
			csrfToken?: string;
		}
	}

	/**
	 * Minimal ambient declaration of the Cloudflare Workers `HTMLRewriter`
	 * streaming-HTML API — only the surface `sanitizeHtml()` uses. Declared
	 * locally instead of pulling the full `@cloudflare/workers-types` package so
	 * the type stays scoped to what we call. The runtime guards on
	 * `typeof globalThis.HTMLRewriter === "undefined"` and falls back to
	 * `sanitize-html` off-Workers.
	 */
	interface AstropressHTMLRewriterElement {
		readonly tagName: string;
		readonly attributes: IterableIterator<[string, string]>;
		remove(): void;
		removeAndKeepContent(): void;
		removeAttribute(name: string): void;
		setAttribute(name: string, value: string): void;
	}
	interface AstropressHTMLRewriter {
		on(
			selector: string,
			handlers: { element(element: AstropressHTMLRewriterElement): void },
		): AstropressHTMLRewriter;
		transform(response: Response): Response;
	}
	// `var` (not `class`) so the binding is a property of `globalThis` — the
	// runtime feature-detects via `typeof globalThis.HTMLRewriter`.
	var HTMLRewriter: { new (): AstropressHTMLRewriter };
}
