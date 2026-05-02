import { getCmsConfig } from "./config";

interface TranslationStatusRecord {
	route: string;
	locale: string;
	englishSourceUrl: string;
	translationState: string;
}

export interface AdminLocalePair {
	currentLocale: "en" | "es";
	englishRoute: string;
	localizedRoute?: string;
	translationState?: string;
}

export function normalizeRoute(route: string) {
	let r = route;
	while (r.endsWith("/")) r = r.slice(0, -1);
	return r === "" ? "/" : r;
}

export function getAdminLocalePair(route: string): AdminLocalePair | null {
	const normalizedRoute = normalizeRoute(route);
	const entries = getCmsConfig().translationStatus as TranslationStatusRecord[];

	const localizedEntry = entries.find(
		(entry) => normalizeRoute(entry.route) === normalizedRoute,
	);
	if (localizedEntry) {
		return {
			currentLocale: "es",
			englishRoute: normalizeRoute(localizedEntry.englishSourceUrl),
			localizedRoute: normalizeRoute(localizedEntry.route),
			translationState: localizedEntry.translationState,
		};
	}

	const englishEntry = entries.find(
		(entry) => normalizeRoute(entry.englishSourceUrl) === normalizedRoute,
	);
	if (englishEntry) {
		return {
			currentLocale: "en",
			englishRoute: normalizeRoute(englishEntry.englishSourceUrl),
			localizedRoute: normalizeRoute(englishEntry.route),
			translationState: englishEntry.translationState,
		};
	}

	return null;
}
