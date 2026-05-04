import { getCmsConfig } from "./config";
import { loadLocalCmsRegistry } from "./local-runtime-modules";

export interface RuntimeSystemRouteRecord {
	path: string;
	title: string;
	summary?: string;
	bodyHtml?: string;
	renderStrategy: "structured_sections" | "generated_text" | "generated_xml";
	// audit-boundary: opaque-passthrough -- user CMS route-registry config; narrowed at consumer
	settings: Record<string, unknown> | null;
	updatedAt?: string;
}

export interface RuntimeArchiveRouteRecord {
	path: string;
	title: string;
	summary?: string;
	seoTitle?: string;
	metaDescription?: string;
	canonicalUrlOverride?: string;
	robotsDirective?: string;
	updatedAt?: string;
}

export interface RuntimeStructuredPageRouteRecord {
	path: string;
	title: string;
	summary?: string;
	seoTitle?: string;
	metaDescription?: string;
	canonicalUrlOverride?: string;
	robotsDirective?: string;
	ogImage?: string;
	templateKey: string;
	alternateLinks: Array<{ hreflang: string; href: string }>;
	// audit-boundary: opaque-passthrough -- user CMS route-registry config; narrowed at consumer
	sections: Record<string, unknown> | null;
	updatedAt?: string;
}

export async function loadSafeLocalCmsRegistry() {
	try {
		return await loadLocalCmsRegistry();
	} catch {
		return null;
	}
}

export async function withSafeRouteRegistryFallback<T>(
	fallback: (
		local: NonNullable<Awaited<ReturnType<typeof loadSafeLocalCmsRegistry>>>,
	) => Promise<T> | T,
	defaultValue: T,
	operation: () => Promise<T>,
) {
	try {
		return await operation();
	} catch {
		const local = await loadSafeLocalCmsRegistry();
		if (local) {
			return await fallback(local);
		}

		return defaultValue;
	}
}

export function parseSettings(value: string | null) {
	try {
		const parsed = JSON.parse(value ?? "null") as unknown;
		if (!parsed || typeof parsed !== "object") return null;
		// audit-boundary: opaque-passthrough -- user CMS route-registry config; narrowed at consumer
		return parsed as Record<string, unknown>;
	} catch {
		return null;
	}
}

export function localeFromPath(pathname: string): string {
	let locales: readonly string[];
	try {
		locales = getCmsConfig().locales ?? ["en", "es"];
	} catch {
		locales = ["en", "es"];
	}
	for (const locale of locales) {
		if (pathname.startsWith(`/${locale}/`)) return locale;
	}
	return locales[0] ?? "en";
}
