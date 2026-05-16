import type { AdminLocale } from "./admin-labels";

export const ADMIN_LOCALE_COOKIE = "astropress_admin_locale";

export function isRtlLocale(locale: AdminLocale): boolean {
	return locale === "ar";
}

export function localeDirection(locale: AdminLocale): "ltr" | "rtl" {
	return isRtlLocale(locale) ? "rtl" : "ltr";
}

function isAdminLocale(value: string): value is AdminLocale {
	switch (value) {
		case "en":
		case "es":
		case "fr":
		case "de":
		case "pt":
		case "ja":
		case "te":
		case "hi":
		case "ny":
		case "ar":
			return true;
		default:
			return false;
	}
}

/**
 * Pick the best supported admin locale for a given Accept-Language header
 * value. Returns null when nothing matches so the caller can fall back to
 * its own default (typically "en").
 */
export function pickAdminLocaleFromAcceptLanguage(
	header: string | null | undefined,
): AdminLocale | null {
	if (!header) return null;
	const entries = header
		.split(",")
		.map((entry) => {
			const [tag, ...params] = entry.trim().split(";");
			const qParam = params.find((p) => p.trim().startsWith("q="));
			const q = qParam ? Number.parseFloat(qParam.split("=")[1]) : 1;
			return { tag: tag.toLowerCase(), q: Number.isFinite(q) ? q : 1 };
		})
		.sort((a, b) => b.q - a.q);
	for (const { tag } of entries) {
		const primary = tag.split("-")[0];
		if (isAdminLocale(primary)) return primary;
	}
	return null;
}

interface AdminLocaleSource {
	cookies?: { get: (name: string) => { value?: string } | undefined };
	request: { headers: { get: (name: string) => string | null } };
}

/**
 * Resolve the admin locale for a server-rendered admin page:
 *   1. cookie (set by the locale picker)
 *   2. browser Accept-Language (so a fresh visitor sees their system language)
 *   3. fallback "en"
 */
export function resolveAdminLocale(astro: AdminLocaleSource): AdminLocale {
	const cookieValue = astro.cookies?.get(ADMIN_LOCALE_COOKIE)?.value;
	if (cookieValue && isAdminLocale(cookieValue)) return cookieValue;
	const fromHeader = pickAdminLocaleFromAcceptLanguage(
		astro.request.headers.get("accept-language"),
	);
	return fromHeader ?? "en";
}
